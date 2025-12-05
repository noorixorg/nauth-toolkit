import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { PlatformService } from './platform.service';

/**
 * HTTP interceptor that handles simple auth concerns:
 * - Cookie mode (web + environment.useCookies): send credentials; on 401, refresh cookies once, then retry.
 * - JWT mode (mobile OR web when useCookies=false): attach Authorization; on 401, refresh once, then retry.
 * - If refresh fails, clear auth and redirect to login.
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const platformService = inject(PlatformService);
  const router = inject(Router);

  // Auth endpoints pass through untouched (but keep cookies for web when needed)
  const isAuthEndpoint =
    request.url.includes('/login') ||
    request.url.includes('/signup') ||
    request.url.includes('/refresh');

  const isWebCookieMode = platformService.isWebPlatform() && environment.useCookies === true;

  if (isAuthEndpoint) {
    // For login endpoint in mobile mode, include device token header if available
    if (request.url.includes('/login') && !isWebCookieMode) {
      const deviceToken = authService.getDeviceToken();
      if (deviceToken) {
        const requestWithDeviceToken = request.clone({
          setHeaders: { 'X-Device-Token': deviceToken },
        });
        return next(requestWithDeviceToken);
      }
    }
    return isWebCookieMode ? next(request.clone({ withCredentials: true })) : next(request);
  }

  // Cookie mode (browser): rely on cookies; on 401, refresh cookies once, then retry
  if (isWebCookieMode) {
    const requestWithCredentials = request.clone({ withCredentials: true });
    return next(requestWithCredentials).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return refreshAndRetryCookie(authService, router, requestWithCredentials, next);
        }
        return throwError(() => error);
      }),
    );
  }

  // JWT mode (mobile or web when useCookies=false)
  const currentAccessToken = authService.getTokens()?.accessToken;
  const requestWithAuth = addAuthHeader(request, currentAccessToken);

  return next(requestWithAuth).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return refreshAndRetryJwt(authService, router, request, next);
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Add Authorization header if token provided.
 */
function addAuthHeader(request: HttpRequest<unknown>, accessToken?: string): HttpRequest<unknown> {
  if (accessToken) {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` },
    });
  }
  return request;
}

/**
 * Refresh (JWT mode) and retry the original request once.
 */
function refreshAndRetryJwt(
  authService: AuthService,
  router: Router,
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    // Get refresh token from storage
    const tokens = authService.getTokens();
    const refreshToken = tokens?.refreshToken || '';

    if (!refreshToken) {
      isRefreshing = false;
      authService.clearAuth();
      router.navigate(['/login']);
      return throwError(() => new Error('No refresh token available'));
    }

    return authService.refreshToken(refreshToken).pipe(
      switchMap((newTokens) => {
        isRefreshing = false;
        refreshTokenSubject.next(newTokens.accessToken);
        // Retry with new access token
        return next(addAuthHeader(request, newTokens.accessToken));
      }),
      catchError((error) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.clearAuth();
        router.navigate(['/login']);
        return throwError(() => error);
      }),
    );
  }

  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(addAuthHeader(request, token))),
  );
}

/**
 * Refresh (cookie mode) and retry the original request once.
 *
 * In cookie mode, refresh token is sent automatically via HTTP-only cookie.
 */
function refreshAndRetryCookie(
  authService: AuthService,
  router: Router,
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    // In cookie mode, pass empty string - refresh token sent via HTTP-only cookie
    return authService.refreshToken('').pipe(
      switchMap(() => {
        isRefreshing = false;
        refreshTokenSubject.next('ok');
        // Retry original request with credentials
        return next(request.clone({ withCredentials: true }));
      }),
      catchError((error) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.clearAuth();
        router.navigate(['/login']);
        return throwError(() => error);
      }),
    );
  }

  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap(() => next(request.clone({ withCredentials: true }))),
  );
}
