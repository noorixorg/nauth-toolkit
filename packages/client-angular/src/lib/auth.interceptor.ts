import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, filter, take, BehaviorSubject, from } from 'rxjs';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';
import { AuthService } from '../ngmodule/auth.service';

/**
 * Refresh state management.
 * BehaviorSubject pattern is the industry-standard for token refresh.
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Track retried requests to prevent infinite loops.
 */
const retriedRequests = new WeakSet<HttpRequest<unknown>>();

/**
 * Get CSRF token from cookie.
 */
function getCsrfToken(cookieName: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${cookieName}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

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

  const tokenDelivery = config.tokenDelivery;
  const baseUrl = config.baseUrl;
  const endpoints = config.endpoints ?? {};
  const refreshPath = endpoints.refresh ?? '/refresh';
  const loginPath = endpoints.login ?? '/login';
  const signupPath = endpoints.signup ?? '/signup';
  const socialExchangePath = endpoints.socialExchange ?? '/social/exchange';
  const refreshUrl = `${baseUrl}${refreshPath}`;

  const isAuthApiRequest = req.url.includes(baseUrl);
  const isRefreshEndpoint = req.url.includes(refreshPath);
  const isPublicEndpoint =
    req.url.includes(loginPath) || req.url.includes(signupPath) || req.url.includes(socialExchangePath);

  // Build request with credentials (cookies mode only)
  let authReq = req;
  if (tokenDelivery === 'cookies') {
    authReq = authReq.clone({ withCredentials: true });

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const csrfCookieName = config.csrf?.cookieName ?? 'nauth_csrf_token';
      const csrfHeaderName = config.csrf?.headerName ?? 'x-csrf-token';
      const csrfToken = getCsrfToken(csrfCookieName);
      if (csrfToken) {
        authReq = authReq.clone({ setHeaders: { [csrfHeaderName]: csrfToken } });
      }
    }
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      const shouldHandle =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isAuthApiRequest &&
        !isRefreshEndpoint &&
        !isPublicEndpoint &&
        !retriedRequests.has(req);

      if (!shouldHandle) {
        return throwError(() => error);
      }

      if (config.debug) {
        console.warn('[nauth-interceptor] 401 detected:', req.url);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshTokenSubject.next(null);

        if (config.debug) {
          console.warn('[nauth-interceptor] Starting refresh...');
        }

        // Refresh based on mode
        const refresh$ =
          tokenDelivery === 'cookies'
            ? http.post<{ accessToken?: string }>(refreshUrl, {}, { withCredentials: true })
            : from(authService.refresh());

        return refresh$.pipe(
          switchMap((response) => {
            if (config.debug) {
              console.warn('[nauth-interceptor] Refresh successful');
            }
            isRefreshing = false;

            // Get new token (JSON mode) or signal success (cookies mode)
            const newToken = 'accessToken' in response ? response.accessToken : 'success';
            refreshTokenSubject.next(newToken ?? 'success');

            // Build retry request
            const retryReq = buildRetryRequest(authReq, tokenDelivery, newToken);
            retriedRequests.add(retryReq);

            if (config.debug) {
              console.warn('[nauth-interceptor] Retrying:', req.url);
            }
            return next(retryReq);
          }),
          catchError((err) => {
            if (config.debug) {
              console.error('[nauth-interceptor] Refresh failed:', err);
            }
            isRefreshing = false;
            refreshTokenSubject.next(null);

            // Handle session expiration - redirect to configured URL
            if (config.redirects?.sessionExpired) {
              router.navigateByUrl(config.redirects.sessionExpired).catch((navError) => {
                if (config.debug) {
                  console.error('[nauth-interceptor] Navigation failed:', navError);
                }
              });
            }

            return throwError(() => err);
          }),
        );
      } else {
        // Wait for ongoing refresh
        if (config.debug) {
          console.warn('[nauth-interceptor] Waiting for refresh...');
        }
        return refreshTokenSubject.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => {
            if (config.debug) {
              console.warn('[nauth-interceptor] Refresh done, retrying:', req.url);
            }
            const retryReq = buildRetryRequest(authReq, tokenDelivery, token);
            retriedRequests.add(retryReq);
            return next(retryReq);
          }),
        );
      }
    }),
  );
};

/**
 * Build retry request with appropriate auth.
 */
function buildRetryRequest(
  originalReq: HttpRequest<unknown>,
  tokenDelivery: string,
  newToken?: string,
): HttpRequest<unknown> {
  if (tokenDelivery === 'json' && newToken && newToken !== 'success') {
    return originalReq.clone({
      setHeaders: { Authorization: `Bearer ${newToken}` },
    });
  }
  return originalReq.clone();
}

/**
 * Class-based interceptor for NgModule compatibility.
 */
export class AuthInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    return authInterceptor(req, next);
  }
}
