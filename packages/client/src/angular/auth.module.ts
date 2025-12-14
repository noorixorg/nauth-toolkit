import { ModuleWithProviders, NgModule } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NAUTH_CLIENT_CONFIG } from './tokens';
import { AuthInterceptor } from './auth.interceptor';
import { NAuthClientConfig } from '../types/config.types';

/**
 * NgModule wrapper to provide configuration and interceptor.
 */
@NgModule({})
export class NAuthModule {
  /**
   * Configure the module with client settings.
   *
   * @param config - Client configuration
   */
  static forRoot(config: NAuthClientConfig): ModuleWithProviders<NAuthModule> {
    return {
      ngModule: NAuthModule,
      providers: [
        { provide: NAUTH_CLIENT_CONFIG, useValue: config },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    };
  }
}
