import { Injectable, Inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError, filter, take, BehaviorSubject, from } from 'rxjs';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AuthService } from './auth.service';
import { NAuthClientConfig } from '@nauth-toolkit/client';

/**
 * Refresh state management.
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);
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
 * Class-based HTTP interceptor for NgModule apps (Angular < 17).
 *
 * For standalone components (Angular 17+), use the functional `authInterceptor` instead.
 *
 * @example
 * ```typescript
 * // app.module.ts
 * import { HTTP_INTERCEPTORS } from '@angular/common/http';
 * import { AuthInterceptorClass } from '@nauth-toolkit/client-angular';
 *
 * @NgModule({
 *   providers: [
 *     { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptorClass, multi: true }
 *   ]
 * })
 * ```
 */
@Injectable()
export class AuthInterceptorClass implements HttpInterceptor {
  constructor(
    @Inject(NAUTH_CLIENT_CONFIG) private readonly config: NAuthClientConfig,
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const tokenDelivery = this.config.tokenDelivery;
    const baseUrl = this.config.baseUrl;

    // ============================================================================
    // COOKIES MODE: withCredentials + CSRF token
    // ============================================================================
    if (tokenDelivery === 'cookies') {
      let clonedReq = req.clone({ withCredentials: true });

      // Add CSRF token header if it's a mutating request
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const csrfToken = getCsrfToken(this.config.csrf?.cookieName || 'XSRF-TOKEN');
        if (csrfToken) {
          clonedReq = clonedReq.clone({
            setHeaders: { [this.config.csrf?.headerName || 'X-XSRF-TOKEN']: csrfToken },
          });
        }
      }

      return next.handle(clonedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401 && !retriedRequests.has(req)) {
            retriedRequests.add(req);

            if (!isRefreshing) {
              isRefreshing = true;
              refreshTokenSubject.next(null);

              return from(
                this.http
                  .post<{ accessToken?: string }>(`${baseUrl}/refresh`, {}, { withCredentials: true })
                  .toPromise(),
              ).pipe(
                switchMap(() => {
                  isRefreshing = false;
                  refreshTokenSubject.next('refreshed');
                  return next.handle(clonedReq);
                }),
                catchError((refreshError) => {
                  isRefreshing = false;
                  this.authService.logout();
                  this.router.navigate([this.config.redirects?.sessionExpired || '/login']);
                  return throwError(() => refreshError);
                }),
              );
            } else {
              return refreshTokenSubject.pipe(
                filter((token) => token !== null),
                take(1),
                switchMap(() => next.handle(clonedReq)),
              );
            }
          }

          return throwError(() => error);
        }),
      );
    }

    // ============================================================================
    // JSON MODE: Delegate to SDK for token handling
    // ============================================================================
    return next.handle(req);
  }
}
