import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../ngmodule/auth.service';

/**
 * Return a user to a pending OpenID Connect request after they finish signing in.
 *
 * When a third-party application starts an authorization request and the user is not
 * signed in, the consent page stashes the request id (`oidc.setPendingInteraction`) and
 * sends them to login. The ordinary nauth challenge chain then runs — possibly several
 * steps of it — and lands them wherever your app puts people after login. This guard
 * intercepts that landing and sends them back to finish what they started.
 *
 * **You may not need this.** If your app lets the SDK drive navigation, the
 * `navigationHandler` config option is a single chokepoint that can do the same job
 * without touching your routes:
 *
 * ```typescript
 * navigationHandler: async (url) => {
 *   const uid = url.startsWith('/auth/challenge') ? null : await client.oidc.takePendingInteraction();
 *   void router.navigateByUrl(uid ? client.oidc.interactionRoute(uid) : url);
 * }
 * ```
 *
 * Reach for the guard instead when your own challenge components call
 * `router.navigate()` themselves once a challenge completes — a common pattern, and one
 * that bypasses `navigationHandler` entirely. Guarding the *destination* catches every
 * such path without having to touch any of them.
 *
 * Put it on whatever routes a freshly logged-in user can land on.
 *
 * @param interactionPath - Route rendering the consent screen; defaults to `oidc.interactionPath`
 * @returns A CanActivateFn that redirects to the pending interaction, when there is one
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'dashboard',
 *     component: DashboardComponent,
 *     canActivate: [authGuard(), oidcReturnGuard()],
 *   },
 * ];
 * ```
 */
export function oidcReturnGuard(interactionPath?: string): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Consumed, not merely read: whoever gets the id owns the resumption, so a later
    // visit to the same route is not diverted a second time.
    const uid = await auth.oidc.takePendingInteraction();
    if (!uid) {
      return true;
    }

    const route = interactionPath
      ? `${interactionPath.replace(/\/$/, '')}/${encodeURIComponent(uid)}`
      : auth.oidc.interactionRoute(uid);

    return router.parseUrl(route);
  };
}
