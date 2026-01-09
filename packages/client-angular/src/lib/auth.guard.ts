import { inject, Inject, Injectable, Optional } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../ngmodule/auth.service';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';
import type { NAuthClientConfig } from '@nauth-toolkit/client';

/**
 * Functional route guard for authentication (Angular 17+).
 *
 * Protects routes by checking if user is authenticated.
 * Redirects to configured session expired route (or login) if not authenticated.
 *
 * @param redirectTo - Optional path to redirect to if not authenticated. If not provided, uses `redirects.sessionExpired` from config (defaults to '/login')
 * @returns CanActivateFn guard function
 *
 * @example
 * ```typescript
 * // In route configuration - uses config.redirects.sessionExpired
 * const routes: Routes = [
 *   {
 *     path: 'home',
 *     component: HomeComponent,
 *     canActivate: [authGuard()]
 *   }
 * ];
 *
 * // Override with custom route
 * const routes: Routes = [
 *   {
 *     path: 'admin',
 *     component: AdminComponent,
 *     canActivate: [authGuard('/admin/login')]
 *   }
 * ];
 * ```
 */
export function authGuard(redirectTo?: string): CanActivateFn {
  return (): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const config = inject(NAUTH_CLIENT_CONFIG, { optional: true });

    if (auth.isAuthenticated()) {
      return true;
    }

    // Use provided redirectTo, or config.redirects.sessionExpired, or default to '/login'
    const redirectPath = redirectTo ?? config?.redirects?.sessionExpired ?? '/login';

    return router.createUrlTree([redirectPath]);
  };
}

/**
 * Class-based authentication guard for NgModule compatibility.
 *
 * **Note:** When using `NAuthModule.forRoot()`, `AuthGuard` is automatically provided
 * and has access to the configuration. You don't need to add it to your module's providers.
 *
 * @example
 * ```typescript
 * // app.module.ts - AuthGuard is automatically provided by NAuthModule.forRoot()
 * @NgModule({
 *   imports: [
 *     NAuthModule.forRoot({
 *       baseUrl: 'https://api.example.com/auth',
 *       tokenDelivery: 'cookies',
 *       redirects: {
 *         sessionExpired: '/login?expired=true',
 *       },
 *     }),
 *     RouterModule.forRoot([
 *       {
 *         path: 'home',
 *         component: HomeComponent,
 *         canActivate: [AuthGuard], // Uses config.redirects.sessionExpired
 *       },
 *     ]),
 *   ],
 * })
 * export class AppModule {}
 *
 * // Or provide manually in a feature module (still has access to root config)
 * @NgModule({
 *   providers: [AuthGuard],
 * })
 * export class FeatureModule {}
 * ```
 */
@Injectable()
export class AuthGuard {
  /**
   * @param auth - Authentication service
   * @param router - Angular router
   * @param config - Optional client configuration (injected automatically)
   */
  constructor(
    private auth: AuthService,
    private router: Router,
    @Optional() @Inject(NAUTH_CLIENT_CONFIG) private config?: NAuthClientConfig,
  ) {}

  /**
   * Check if route can be activated.
   *
   * @returns True if authenticated, otherwise redirects to configured session expired route (or '/login')
   */
  canActivate(): boolean | UrlTree {
    if (this.auth.isAuthenticated()) {
      return true;
    }

    // Use config.redirects.sessionExpired or default to '/login'
    const redirectPath = this.config?.redirects?.sessionExpired ?? '/login';

    return this.router.createUrlTree([redirectPath]);
  }
}
