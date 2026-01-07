import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AuthService } from './auth.service';
import { AngularHttpAdapter } from './http-adapter';
import { AuthInterceptorClass } from './auth.interceptor.class';
import { AuthGuard } from '../lib/auth.guard';
import { NAuthClientConfig } from '@nauth-toolkit/client';

/**
 * NgModule for nauth-toolkit Angular integration.
 *
 * Use this for NgModule-based apps (Angular 17+ with NgModule or legacy apps).
 *
 * @example
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
 */
@NgModule({
  imports: [HttpClientModule],
  exports: [HttpClientModule],
})
export class NAuthModule {
  static forRoot(config: NAuthClientConfig): ModuleWithProviders<NAuthModule> {
    return {
      ngModule: NAuthModule,
      providers: [
        {
          provide: NAUTH_CLIENT_CONFIG,
          useValue: config,
        },
        AngularHttpAdapter,
        {
          provide: AuthService,
          useFactory: (httpAdapter: AngularHttpAdapter) => {
            return new AuthService(config, httpAdapter);
          },
          deps: [AngularHttpAdapter],
        },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptorClass,
          multi: true,
        },
        // Provide AuthGuard so it has access to NAUTH_CLIENT_CONFIG
        AuthGuard,
      ],
    };
  }
}
