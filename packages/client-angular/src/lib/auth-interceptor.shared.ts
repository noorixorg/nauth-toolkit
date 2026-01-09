import { HttpClient, HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import type { NAuthClientConfig } from '@nauth-toolkit/client';
import { AuthService } from '../ngmodule/auth.service';

/**
 * Shared interceptor logic for both:
 * - Functional interceptor (Angular 17+ standalone)
 * - Class-based interceptor (NgModule apps)
 *
 * WHY:
 * - Keep one implementation for cookies + json mode behavior.
 * - Avoid divergence between standalone and NgModule integrations.
 */

// ============================================================================
// Refresh state management (module-level)
// ============================================================================
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);
let refreshInFlight$: Observable<string> | null = null;
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
 * Build retry request with appropriate auth.
 *
 * In cookies mode: Browser automatically sends updated httpOnly cookies (access/refresh tokens).
 * We must re-read CSRF token after refresh to avoid stale headers.
 *
 * In JSON mode: Clones the request and adds the new Bearer token.
 */
function buildRetryRequest(
  originalReq: HttpRequest<unknown>,
  tokenDelivery: string,
  newToken?: string | null,
  csrfConfig?: { cookieName?: string; headerName?: string },
): HttpRequest<unknown> {
  if (tokenDelivery === 'json' && newToken && newToken !== 'success') {
    return originalReq.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
  }

  if (tokenDelivery === 'cookies' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(originalReq.method)) {
    const csrfCookieName = csrfConfig?.cookieName ?? 'nauth_csrf_token';
    const csrfHeaderName = csrfConfig?.headerName ?? 'x-csrf-token';
    const freshCsrfToken = getCsrfToken(csrfCookieName);
    if (freshCsrfToken) {
      return originalReq.clone({ setHeaders: { [csrfHeaderName]: freshCsrfToken } });
    }
  }

  return originalReq;
}

export function createNAuthAuthHttpInterceptor(params: {
  config: NAuthClientConfig;
  http: HttpClient;
  authService: AuthService;
  router: Router;
  next: HttpHandlerFn;
  req: HttpRequest<unknown>;
}): Observable<HttpEvent<unknown>> {
  const { config, authService, router, next, req } = params;

  const tokenDelivery = config.tokenDelivery;
  const baseUrl = config.baseUrl;
  const endpoints = config.endpoints ?? {};
  const authPathPrefix = config.authPathPrefix;

  // Build refresh path with authPathPrefix if configured (matches core client buildUrl logic exactly)
  // Use default '/refresh' if endpoints.refresh is not defined
  const refreshPath = endpoints?.refresh ?? '/refresh';
  const normalizedRefreshPath = refreshPath.startsWith('/') ? refreshPath : `/${refreshPath}`;

  // Check if baseUrl already ends with authPathPrefix to avoid double-prefixing
  // This must match the core client's buildUrl logic exactly
  const baseUrlEndsWithPrefix = authPathPrefix && baseUrl.endsWith(authPathPrefix);

  const shouldAddPrefix = authPathPrefix && !baseUrlEndsWithPrefix && !normalizedRefreshPath.startsWith(authPathPrefix);
  const effectiveRefreshPath = shouldAddPrefix ? `${authPathPrefix}${normalizedRefreshPath}` : normalizedRefreshPath;

  const loginPath = endpoints.login ?? '/login';
  const signupPath = endpoints.signup ?? '/signup';
  const socialExchangePath = endpoints.socialExchange ?? '/social/exchange';

  const isAuthApiRequest = req.url.includes(baseUrl);
  // Check if request is to refresh endpoint (using effective path with authPathPrefix)
  const isRefreshEndpoint = req.url.includes(effectiveRefreshPath);
  const isPublicEndpoint =
    req.url.includes(loginPath) || req.url.includes(signupPath) || req.url.includes(socialExchangePath);
  const shouldIntercept = isAuthApiRequest && !isRefreshEndpoint && !isPublicEndpoint;

  // ============================================================================
  // Build request for cookies mode (withCredentials + CSRF)
  // ============================================================================
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

  // ============================================================================
  // JSON mode: attach Authorization header for HttpClient calls
  // ============================================================================
  // Simple approach: attach token if available, let backend validate
  // Handle 401 reactively (matches old working implementation)
  const attachJsonAuth$ =
    tokenDelivery === 'json' && shouldIntercept && !authReq.headers.has('Authorization')
      ? from(authService.getAccessToken()).pipe(
          switchMap((token) => {
            if (token) {
              return of(authReq.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
            }
            return of(authReq);
          }),
        )
      : of(authReq);

  // ============================================================================
  // Refresh coordination
  // ============================================================================
  const getOrStartRefresh$ = (): Observable<string> => {
    if (refreshInFlight$) return refreshInFlight$;

    // WHY: We want to ensure only one refresh request is in flight at any time.
    // All requests (including those that haven't hit the backend yet) should wait for
    // the same refresh result to avoid a burst of 401s and potential WAF/rate-limit issues.
    isRefreshing = true;
    refreshTokenSubject.next(null);

    // WHY: Always refresh via the core client.
    // - Ensures authPathPrefix + default endpoints are applied consistently (fixes /refresh vs /auth/refresh).
    // - Centralizes CSRF + credentials handling in one place.
    const refreshRequest$ = from(authService.getClient().refreshTokens());

    refreshInFlight$ = refreshRequest$.pipe(
      map((response) => {
        // Cookies mode: success is enough (tokens are in httpOnly cookies).
        // JSON mode: we need the new access token to retry + unblock queued requests.
        const newToken = tokenDelivery === 'json' ? response.accessToken : 'success';

        if (tokenDelivery === 'json' && (!newToken || newToken === 'success')) {
          // ⚠️ WARNING: Without an access token we cannot safely retry requests in JSON mode.
          throw new Error('Token refresh did not return an access token');
        }

        refreshTokenSubject.next(newToken ?? 'success');
        return newToken ?? 'success';
      }),
      catchError((err) => {
        refreshTokenSubject.next(null);

        // Refresh failed -> redirect if configured
        if (config.redirects?.sessionExpired) {
          router.navigateByUrl(config.redirects.sessionExpired).catch(() => {
            // Ignore navigation errors
          });
        }

        return throwError(() => err);
      }),
      finalize(() => {
        isRefreshing = false;
        refreshInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return refreshInFlight$;
  };

  // ============================================================================
  // Pre-request gating: block requests while refresh is in-flight
  // ============================================================================
  // WHY: Prevent multiple requests from hitting the backend with an expired token and returning 401.
  // We queue all auth API calls during refresh and release them once refresh succeeds.
  if (shouldIntercept && isRefreshing && refreshInFlight$) {
    return refreshInFlight$.pipe(
      switchMap((token) => {
        const gatedReq = buildRetryRequest(authReq, tokenDelivery, token, config.csrf);
        return next(gatedReq);
      }),
    );
  }

  return attachJsonAuth$.pipe(
    switchMap((requestWithAuth) =>
      next(requestWithAuth).pipe(
        catchError((error: unknown) => {
          const shouldHandle =
            error instanceof HttpErrorResponse && error.status === 401 && shouldIntercept && !retriedRequests.has(req);

          if (!shouldHandle) {
            return throwError(() => error);
          }

          retriedRequests.add(req);

          return getOrStartRefresh$().pipe(
            switchMap((token) => {
              const retryReq = buildRetryRequest(requestWithAuth, tokenDelivery, token, config.csrf);
              retriedRequests.add(retryReq);
              return next(retryReq);
            }),
          );
        }),
      ),
    ),
  );
}
