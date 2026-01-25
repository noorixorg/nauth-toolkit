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

// ============================================================================
// Error + cookie helpers
// ============================================================================

/**
 * Safely extract HTTP status code from either:
 * - Angular HttpErrorResponse (HttpClient calls)
 * - SDK NAuthClientError (thrown by the SDK's HttpAdapter)
 */
function getStatusCode(error: unknown): number | null {
  if (error instanceof HttpErrorResponse) return error.status;
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }
  return null;
}

/**
 * Best-effort CSRF cookie clearing (non-httpOnly).
 *
 * WARNING: This cannot clear httpOnly auth cookies (access/refresh/device).
 * Those must be cleared by the backend on refresh/logout.
 */
function clearCsrfCookie(baseUrl: string, cookieName: string): void {
  if (typeof document === 'undefined') return;

  // WHY: Cookie domain handling differs between localhost and real domains.
  // We try to clear with an explicit domain (if available), then without.
  try {
    const url = new URL(baseUrl);
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${url.hostname}`;
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  } catch {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  }
}

/**
 * Get CSRF token from cookie.
 *
 * @param cookieName - Name of the CSRF cookie (from config.csrf.cookieName)
 * @returns CSRF token value or null if not found
 */
function getCsrfToken(cookieName: string): string | null {
  if (typeof document === 'undefined') return null;
  // Escape special regex characters in cookie name to prevent injection
  const escapedCookieName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(^| )${escapedCookieName}=([^;]+)`));
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
    // Always refresh CSRF token on retry (even if it exists, get fresh one)
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
  // IMPORTANT: When using AngularHttpAdapter, headers from buildHeaders() are passed
  // to HttpClient.request() as a plain object. Angular converts these to HttpHeaders
  // and creates an HttpRequest. However, we cannot rely on buildHeaders() to add CSRF
  // in Angular context because:
  // 1. hasWindow() might return false in SSR contexts
  // 2. Headers might not be properly merged into the HttpRequest that interceptors receive
  // 3. The interceptor is the authoritative place for CSRF in Angular apps
  //
  // Therefore, the interceptor ALWAYS adds CSRF for mutating methods in cookies mode,
  // regardless of whether buildHeaders() added it (for vanilla clients).
  let authReq = req;
  if (tokenDelivery === 'cookies') {
    authReq = authReq.clone({ withCredentials: true });
    // Add CSRF token for mutating methods (POST, PUT, PATCH, DELETE)
    // Always add it here - don't rely on buildHeaders() in Angular context
    // Add CSRF token for mutating methods (POST, PUT, PATCH, DELETE)
    // This runs for ALL requests in cookies mode, not just auth API requests
    // This ensures CSRF protection for all mutating operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // Respect user's CSRF config, fallback to defaults if not provided
      // These defaults must match the backend's CSRF configuration
      const csrfCookieName = config.csrf?.cookieName ?? 'nauth_csrf_token';
      const csrfHeaderName = config.csrf?.headerName ?? 'x-csrf-token';

      // Get CSRF token from cookie using the configured cookie name
      const csrfToken = getCsrfToken(csrfCookieName);

      if (csrfToken) {
        // Use setHeaders which will override if already exists (from buildHeaders)
        // This ensures CSRF is always present for DELETE and other mutating methods
        authReq = authReq.clone({ setHeaders: { [csrfHeaderName]: csrfToken } });
      } else {
        // CSRF token not found - this could happen if:
        // 1. Cookie doesn't exist (before first login, after logout, or cookie expired)
        // 2. Cookie name mismatch (check config.csrf.cookieName matches backend)
        // 3. Cookie is httpOnly and can't be read (but CSRF cookies should be readable)
        // The backend should handle missing CSRF tokens appropriately (return 403 or similar)
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
          // WARNING: Without an access token we cannot safely retry requests in JSON mode.
          throw new Error('Token refresh did not return an access token');
        }

        refreshTokenSubject.next(newToken ?? 'success');
        return newToken ?? 'success';
      }),
      catchError((err) => {
        refreshTokenSubject.next(null);

        const statusCode = getStatusCode(err);

        // Refresh failed with 401 => session expired.
        // Clear *local* SDK state so guards/pages don't think the user is still logged in after navigation/reload.
        // IMPORTANT: This also clears challenge sessions and OAuth state to prevent ghost states.
        if (statusCode === 401) {
          // Best-effort: also clear CSRF cookie in cookies mode (non-httpOnly).
          if (tokenDelivery === 'cookies') {
            const csrfCookieName = config.csrf?.cookieName ?? 'nauth_csrf_token';
            clearCsrfCookie(config.baseUrl, csrfCookieName);
          }

          return from(authService.getClient().clearLocalAuthState()).pipe(
            switchMap(() => {
              // Call onSessionExpired callback if configured
              config.onSessionExpired?.();

              if (config.redirects?.sessionExpired) {
                router.navigateByUrl(config.redirects.sessionExpired).catch(() => {
                  // Ignore navigation errors
                });
              }
              return throwError(() => err);
            }),
          );
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
