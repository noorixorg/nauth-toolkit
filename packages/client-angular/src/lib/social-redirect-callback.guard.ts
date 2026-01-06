import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type CanActivateFn } from '@angular/router';
import { AuthService } from '../ngmodule/auth.service';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';

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
 * - If `exchangeToken` exists: exchanges it via backend and redirects to success or challenge routes.
 * - If no `exchangeToken`: treat as cookie-success path and redirect to success route.
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
  const config = inject(NAUTH_CLIENT_CONFIG);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  if (!isBrowser) {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const exchangeToken = params.get('exchangeToken');

  // Provider error: redirect to oauthError
  if (error) {
    const errorUrl = config.redirects?.oauthError || '/login';
    window.location.replace(errorUrl);
    return false;
  }

  // No exchangeToken: cookie success path; redirect to success.
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
    } catch {
      const errorUrl = config.redirects?.oauthError || '/login';
      window.location.replace(errorUrl);
      return false;
    }
    const successUrl = config.redirects?.success || '/';
    window.location.replace(successUrl);
    return false;
  }

  // Exchange token and route accordingly
  const response = await auth.exchangeSocialRedirect(exchangeToken);
  if (response.challengeName) {
    const challengeBase = config.redirects?.challengeBase || '/auth/challenge';
    const challengeRoute = response.challengeName.toLowerCase().replace(/_/g, '-');
    window.location.replace(`${challengeBase}/${challengeRoute}`);
    return false;
  }

  const successUrl = config.redirects?.success || '/';
  window.location.replace(successUrl);
  return false;
};
