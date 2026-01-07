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

      // Mark original request as retried to prevent infinite loops
      retriedRequests.add(req);

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

            // Build retry request with fresh CSRF token (re-read from cookie after refresh)
            const retryReq = buildRetryRequest(authReq, tokenDelivery, newToken, config.csrf);

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
            const retryReq = buildRetryRequest(authReq, tokenDelivery, token, config.csrf);
            return next(retryReq);
          }),
        );
      }
    }),
  );
};

/**
 * Build retry request with appropriate auth.
 *
 * CRITICAL FIX: In cookies mode, after refresh the server may send updated cookies.
 * We MUST re-read the CSRF token from the cookie before retrying to ensure we have
 * the current CSRF token that matches what the server expects.
 *
 * In JSON mode: Clones the request and adds the new Bearer token.
 *
 * @param originalReq - The base request (already has withCredentials if cookies mode)
 * @param tokenDelivery - 'cookies' or 'json'
 * @param newToken - The new access token (JSON mode only)
 * @param csrfConfig - CSRF configuration to re-read token from cookie
 * @returns The request ready for retry with fresh auth
 */
function buildRetryRequest(
  originalReq: HttpRequest<unknown>,
  tokenDelivery: string,
  newToken?: string,
  csrfConfig?: { cookieName?: string; headerName?: string },
): HttpRequest<unknown> {
  if (tokenDelivery === 'json' && newToken && newToken !== 'success') {
    return originalReq.clone({
      setHeaders: { Authorization: `Bearer ${newToken}` },
    });
  }

  // Cookies mode: Browser automatically sends updated httpOnly cookies (access/refresh tokens).
  // However, CSRF token must match the cookie value at the moment of retry.
  // We ALWAYS re-read from document.cookie here (using defaults when csrfConfig
  // is not provided) to avoid stale header values after refresh or across tabs.
  if (tokenDelivery === 'cookies' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(originalReq.method)) {
    const csrfCookieName = csrfConfig?.cookieName ?? 'nauth_csrf_token';
    const csrfHeaderName = csrfConfig?.headerName ?? 'x-csrf-token';
    const freshCsrfToken = getCsrfToken(csrfCookieName);

    if (freshCsrfToken) {
      // Clone with fresh CSRF token in header
      return originalReq.clone({
        setHeaders: { [csrfHeaderName]: freshCsrfToken },
      });
    }
  }

  // No changes needed (GET request or no CSRF token available)
  return originalReq;
}

/**
 * Class-based interceptor for NgModule compatibility.
 */
export class AuthInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    return authInterceptor(req, next);
  }
}
