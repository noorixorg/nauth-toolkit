import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';
import { AuthService } from '../ngmodule/auth.service';
import { createNAuthAuthHttpInterceptor } from './auth-interceptor.shared';

/**
 * Angular HTTP interceptor for nauth-toolkit.
 *
 * Handles:
 * - Cookies mode: withCredentials + CSRF tokens + refresh via POST
 * - JSON mode: refresh via SDK, retry with new token
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const config = inject(NAUTH_CLIENT_CONFIG);
  const http = inject(HttpClient);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(platformId);

  if (!isBrowser) {
    return next(req);
  }

  return createNAuthAuthHttpInterceptor({ config, http, authService, router, next, req });
};

/**
 * Class-based interceptor for NgModule compatibility.
 */
export class AuthInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    return authInterceptor(req, next);
  }
}
