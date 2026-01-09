import { Injectable, Inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AuthService } from './auth.service';
import { NAuthClientConfig } from '@nauth-toolkit/client';
import { createNAuthAuthHttpInterceptor } from '../lib/auth-interceptor.shared';

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
    return createNAuthAuthHttpInterceptor({
      config: this.config,
      http: this.http,
      authService: this.authService,
      router: this.router,
      req,
      next: (r) => next.handle(r),
    });
  }
}
