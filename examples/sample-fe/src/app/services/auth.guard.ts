import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PlatformService } from './platform.service';
import { environment } from '../../environments/environment';

/**
 * Route Guard for Authentication
 *
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 */
@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private platformService: PlatformService,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    const isWebCookieMode = this.platformService.isWebPlatform() && environment.useCookies === true;
    const user = this.authService.getCurrentUser();

    // Web + cookies: rely on server session via cookies
    if (isWebCookieMode) {
      if (user) return true;
      // Probe /auth/me to confirm session; interceptor sends cookies via withCredentials
      return this.authService.loadUserProfile().pipe(
        map(() => true),
        catchError(() => {
          this.router.navigate(['/login']);
          return of(false);
        }),
      );
    }

    // Native/header mode
    const tokens = this.authService.getTokens();
    if (tokens && user) return true;
    this.router.navigate(['/login']);
    return false;
  }
}
