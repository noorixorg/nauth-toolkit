import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { NAUTH_CLIENT_CONFIG } from './tokens';

/**
 * OAuth callback route guard.
 *
 * Drop-in guard that automatically processes OAuth callbacks and redirects appropriately.
 * Place this guard on your `/auth/callback` route to handle social authentication.
 *
 * The guard:
 * - Auto-detects OAuth callback parameters (provider, code, state)
 * - Completes authentication via backend
 * - Redirects using window.location (works in browser, Capacitor, SSR-safe)
 *
 * Configure redirect URLs in `NAUTH_CLIENT_CONFIG.redirects`.
 *
 * @example
 * ```typescript
 * // app.routes.ts
 * import { oauthCallbackGuard } from '@nauth-toolkit/client/angular';
 *
 * export const routes: Routes = [
 *   {
 *     path: 'auth/callback',
 *     canActivate: [oauthCallbackGuard],
 *     redirectTo: '/', // Fallback - guard handles redirect
 *   },
 * ];
 * ```
 *
 * @example
 * ```typescript
 * // app.config.ts - Configure redirect URLs
 * import { NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client/angular';
 *
 * providers: [
 *   {
 *     provide: NAUTH_CLIENT_CONFIG,
 *     useValue: {
 *       baseUrl: 'https://api.example.com/auth',
 *       tokenDelivery: 'cookies',
 *       redirects: {
 *         success: '/home', // Common redirect for all successful auth
 *         oauthError: '/login',
 *         challengeBase: '/auth/challenge',
 *       },
 *     },
 *   }
 * ]
 * ```
 */
export const oauthCallbackGuard: CanActivateFn = async (): Promise<boolean> => {
  const auth = inject(AuthService);
  const config = inject(NAUTH_CLIENT_CONFIG);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  // SSR: Don't process in server environment
  if (!isBrowser) {
    return false;
  }

  try {
    // Auto-detect and handle OAuth callback
    const response = await auth.getClient().handleOAuthCallback();

    if (!response) {
      // Not an OAuth callback - redirect to home
      const homeUrl = config.redirects?.success || '/';
      window.location.replace(homeUrl);
      return false;
    }

    // Handle successful response
    if (response.challengeName) {
      // Challenge required
      const challengeBase = config.redirects?.challengeBase || '/auth/challenge';
      const challengeRoute = response.challengeName.toLowerCase().replace(/_/g, '-');
      const challengePath = `${challengeBase}/${challengeRoute}`;
      if (config.debug) {
        console.warn('[oauth-callback-guard] Redirecting to challenge:', challengePath);
      }
      window.location.replace(challengePath);
    } else {
      // Authentication complete
      const successUrl = config.redirects?.success || '/';
      if (config.debug) {
        console.warn('[oauth-callback-guard] Redirecting to success URL:', successUrl);
      }
      window.location.replace(successUrl);
    }
  } catch (error) {
    // OAuth callback failed
    console.error('[oauth-callback-guard] OAuth callback failed:', error);
    const errorUrl = config.redirects?.oauthError || '/login';
    if (config.debug) {
      console.warn('[oauth-callback-guard] Redirecting to error URL:', errorUrl);
    }
    window.location.replace(errorUrl);
  }

  // Return false to prevent route activation (we're navigating manually)
  return false;
};
