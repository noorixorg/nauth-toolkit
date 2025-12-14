import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Functional route guard for authentication (Angular 17+).
 *
 * Protects routes by checking if user is authenticated.
 * Redirects to login page if not authenticated.
 *
 * @param redirectTo - Path to redirect to if not authenticated (default: '/login')
 * @returns CanActivateFn guard function
 *
 * @example
 * ```typescript
 * // In route configuration
 * const routes: Routes = [
 *   {
 *     path: 'home',
 *     component: HomeComponent,
 *     canActivate: [authGuard()]
 *   },
 *   {
 *     path: 'admin',
 *     component: AdminComponent,
 *     canActivate: [authGuard('/admin/login')]
 *   }
 * ];
 * ```
 */
export function authGuard(redirectTo = '/login'): CanActivateFn {
  return (): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.isAuthenticated()) {
      return true;
    }

    return router.createUrlTree([redirectTo]);
  };
}

/**
 * Class-based authentication guard for NgModule compatibility.
 *
 * @example
 * ```typescript
 * // In route configuration (NgModule)
 * const routes: Routes = [
 *   {
 *     path: 'home',
 *     component: HomeComponent,
 *     canActivate: [AuthGuard]
 *   }
 * ];
 *
 * // In module providers
 * @NgModule({
 *   providers: [AuthGuard]
 * })
 * ```
 */
export class AuthGuard {
  /**
   * @param auth - Authentication service
   * @param router - Angular router
   */
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  /**
   * Check if route can be activated.
   *
   * @returns True if authenticated, otherwise redirects to login
   */
  canActivate(): boolean | UrlTree {
    if (this.auth.isAuthenticated()) {
      return true;
    }

    return this.router.createUrlTree(['/login']);
  }
}
