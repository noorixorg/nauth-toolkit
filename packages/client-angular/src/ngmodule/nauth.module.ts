import { NgModule, ModuleWithProviders, inject, Optional, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { Router } from '@angular/router';
import { NAUTH_CLIENT_CONFIG, NAuthAngularConfig } from './tokens';
import { AuthService } from './auth.service';
import { AngularHttpAdapter } from './http-adapter';
import { AuthInterceptorClass } from './auth.interceptor.class';
import { AuthGuard } from '../lib/auth.guard';
import { RecaptchaService, RECAPTCHA_CONFIG } from '../lib/recaptcha.service';

/**
 * NgModule for nauth-toolkit Angular integration.
 *
 * Use this for NgModule-based apps (Angular 17+ with NgModule or legacy apps).
 *
 * @example Basic Setup
 * ```typescript
 * // app.module.ts
 * import { NAuthModule } from '@nauth-toolkit/client-angular';
 *
 * @NgModule({
 *   imports: [
 *     NAuthModule.forRoot({
 *       baseUrl: 'http://localhost:3000/auth',
 *       tokenDelivery: 'cookies',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example With reCAPTCHA Enterprise
 * ```typescript
 * NAuthModule.forRoot({
 *   baseUrl: 'http://localhost:3000/auth',
 *   tokenDelivery: 'cookies',
 *   recaptcha: {
 *     enabled: true,
 *     version: 'enterprise',
 *     siteKey: environment.recaptchaSiteKey,
 *     action: 'login',
 *   },
 * })
 * ```
 */
@NgModule({
  imports: [HttpClientModule],
  exports: [HttpClientModule],
})
export class NAuthModule {
  static forRoot(config: NAuthAngularConfig): ModuleWithProviders<NAuthModule> {
    const providers: any[] = [
      {
        provide: NAUTH_CLIENT_CONFIG,
        useValue: config,
      },
      AngularHttpAdapter,
      {
        provide: AuthService,
        useFactory: (httpAdapter: AngularHttpAdapter, recaptchaService?: RecaptchaService) => {
          // Try to inject Router optionally - if not available, pass undefined
          // Router will be undefined if not provided (e.g., in apps without routing)
          const router = inject(Router, { optional: true });
          return new AuthService(config, httpAdapter, router ?? undefined, recaptchaService);
        },
        deps: [AngularHttpAdapter, [new Optional(), RecaptchaService]],
      },
      {
        provide: HTTP_INTERCEPTORS,
        useClass: AuthInterceptorClass,
        multi: true,
      },
      // Provide AuthGuard so it has access to NAUTH_CLIENT_CONFIG
      AuthGuard,
    ];

    // Add reCAPTCHA providers if configured
    if (config.recaptcha?.enabled) {
      providers.push(
        {
          provide: RECAPTCHA_CONFIG,
          // Cast because interface extends but they're compatible
          useValue: config.recaptcha,
        },
        RecaptchaService,
        {
          provide: APP_INITIALIZER,
          useFactory: () => {
            // Force RecaptchaService instantiation at app startup so script preloads
            inject(RecaptchaService);
            // No-op - constructor already handles preload
            return () => {};
          },
          multi: true,
        },
      );
    }

    return {
      ngModule: NAuthModule,
      providers,
    };
  }
}
