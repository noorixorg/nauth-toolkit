import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type CanActivateFn } from '@angular/router';
import { AuthService } from '../ngmodule/auth.service';
import { NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';

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

  // Provider error: redirect to oauthError
  if (error) {
    await router.navigateToError('oauth');
    return false;
  }

  // No exchangeToken: cookie success path; hydrate then navigate to success.
  //
  // Note: we do not "activate" the callback route to avoid consumers needing to render a page.
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
      await auth.getProfile();
      // Pass appState as query param to success route
      await router.navigateToSuccess(appState ? { appState } : undefined);
    } catch (err) {
      // Only treat auth failures (401/403) as OAuth errors
      // Network errors or other issues might be temporary - still try success route
      const isAuthError =
        err instanceof NAuthClientError &&
        (err.statusCode === 401 ||
          err.statusCode === 403 ||
          err.code === NAuthErrorCode.AUTH_TOKEN_INVALID ||
          err.code === NAuthErrorCode.AUTH_SESSION_EXPIRED ||
          err.code === NAuthErrorCode.AUTH_SESSION_NOT_FOUND);

      if (isAuthError) {
        // Cookies weren't set properly - OAuth failed
        await router.navigateToError('oauth');
      } else {
        // For network errors or other issues, proceed to success route
        // The auth guard will handle authentication state on the next route
        // Pass appState as query param to success route
        await router.navigateToSuccess(appState ? { appState } : undefined);
      }
    }
    return false;
  }

  // Exchange token - SDK handles navigation automatically
  // Note: appState will be passed via query params when navigateToSuccess is called
  // by the challenge router after successful exchange
  await auth.exchangeSocialRedirect(exchangeToken);
  return false;
};
