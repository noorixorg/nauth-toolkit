import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type CanActivateFn } from '@angular/router';
import { AuthService } from '../ngmodule/auth.service';
import { NAuthClientError, NAuthErrorCode, type AuthResponse } from '@nauth-toolkit/client';

/**
 * Social redirect callback route guard.
 *
 * This guard supports the redirect-first social flow where the backend redirects
 * back to the frontend with:
 * - `appState` (always optional)
 * - `exchangeToken` (present for json/hybrid flows, and for cookie flows that return a challenge)
 * - `error` / `error_description` (provider errors)
 *
 * Behavior:
 * - If `exchangeToken` exists: exchanges it via backend (SDK handles navigation automatically).
 * - If no `exchangeToken`: treat as cookie-success path (SDK handles navigation automatically).
 * - If `error` exists: redirects to oauthError route.
 * - If auto-redirect is disabled (redirectUrls set to null): returns true to activate the route.
 *
 * @example
 * ```typescript
 * import { socialRedirectCallbackGuard } from '@nauth-toolkit/client/angular';
 *
 * export const routes: Routes = [
 *   { path: 'auth/callback', canActivate: [socialRedirectCallbackGuard], component: CallbackComponent },
 * ];
 * ```
 */
export const socialRedirectCallbackGuard: CanActivateFn = async (): Promise<boolean> => {
  const auth = inject(AuthService);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  if (!isBrowser) {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const exchangeToken = params.get('exchangeToken');
  const appState = params.get('appState');

  const router = auth.getChallengeRouter();

  // ============================================================================
  // Extract and store appState if present
  // ============================================================================
  // WHY: appState is round-tripped from the OAuth flow and should be stored
  // for retrieval via getLastOauthState() and passed to the success route.
  if (appState) {
    await auth.getClient().storeOauthState(appState);
  }

  // Provider error: redirect to oauthError (or activate route if auto-redirect disabled)
  if (error) {
    await router.navigateToError('oauth');
    // Return true to activate route if oauthError redirect is disabled
    return router.isErrorRedirectDisabled('oauth');
  }

  // No exchangeToken: cookie success path; hydrate then navigate to success.
  //
  // Note: When auto-redirect is enabled, we do not "activate" the callback route to avoid
  // consumers needing to render a page. When disabled, we activate the route.
  if (!exchangeToken) {
    // ============================================================================
    // Cookies mode: hydrate user state before redirecting
    // ============================================================================
    // WHY: In cookie delivery, the OAuth callback completes via browser redirects, so the frontend
    // does not receive a JSON AuthResponse to populate the SDK's cached `currentUser`.
    //
    // Without this, sync guards (`authGuard`) can immediately redirect to /login because
    // `currentUser` is still null even though cookies were set successfully.
    try {
      const user = await auth.getProfile();

      // ============================================================================
      // Route through handleAuthResponse to ensure onAuthResponse is called
      // ============================================================================
      // WHY: onAuthResponse should be called consistently for all auth completions,
      // whether via exchange token or cookie success path. This allows apps to have
      // a single handler for all authentication outcomes (login, signup, social).
      //
      // We construct a synthetic AuthResponse with the user data. Tokens are omitted
      // because they're in httpOnly cookies, not accessible to the client.
      const syntheticResponse: AuthResponse = {
        user: {
          sub: user.sub,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          socialProviders: user.socialProviders,
          hasPasswordHash: user.hasPasswordHash,
        },
        authMethod: user.sessionAuthMethod ?? undefined,
      };

      // Call handleAuthResponse which respects onAuthResponse callback
      // Pass appState in context so onAuthResponse can access it
      await router.handleAuthResponse(syntheticResponse, {
        source: 'social',
        appState: appState ?? undefined,
      });
    } catch (error: unknown) {
      // Only treat auth failures (401/403) as OAuth errors
      // Network errors or other issues might be temporary - still try success route

      // Type guard: check if error is NAuthClientError
      if (error instanceof NAuthClientError) {
        const isAuthError =
          error.statusCode === 401 ||
          error.statusCode === 403 ||
          error.code === NAuthErrorCode.AUTH_TOKEN_INVALID ||
          error.code === NAuthErrorCode.AUTH_SESSION_EXPIRED ||
          error.code === NAuthErrorCode.AUTH_SESSION_NOT_FOUND;

        if (isAuthError) {
          // Cookies weren't set properly - OAuth failed
          await router.navigateToError('oauth');
          return router.isErrorRedirectDisabled('oauth');
        }
      }

      // For network errors or other non-auth issues, proceed to success route
      // The auth guard will handle authentication state on the next route
      await router.navigateToSuccess(appState ? { appState } : undefined);
    }

    // Return true if success redirect is disabled, allowing the callback component to render
    return router.isSuccessRedirectDisabled({ source: 'social', appState: appState ?? undefined });
  }

  // Exchange token - SDK handles navigation automatically
  // Note: appState will be passed via query params when navigateToSuccess is called
  // by the challenge router after successful exchange
  await auth.exchangeSocialRedirect(exchangeToken);

  // Return true if success redirect is disabled, allowing the callback component to render
  // We use 'social' as source since this is the social OAuth callback flow
  return router.isSuccessRedirectDisabled({ source: 'social', appState: appState ?? undefined });
};
