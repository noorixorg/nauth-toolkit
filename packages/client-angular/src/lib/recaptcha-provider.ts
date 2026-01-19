import { inject, EnvironmentProviders, makeEnvironmentProviders, APP_INITIALIZER } from '@angular/core';
import { RecaptchaService, RECAPTCHA_CONFIG, RecaptchaServiceConfig } from './recaptcha.service';

/**
 * Provides reCAPTCHA configuration and automatic script preloading.
 *
 * Sets up `RECAPTCHA_CONFIG` and forces `RecaptchaService` instantiation at app
 * startup so the reCAPTCHA script preloads before the user clicks login/signup.
 *
 * @param config - reCAPTCHA configuration (enabled, version, siteKey, action)
 * @returns Environment providers for reCAPTCHA
 *
 * @example
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideRecaptcha({
 *       enabled: true,
 *       version: 'enterprise',
 *       siteKey: environment.recaptchaSiteKey,
 *       action: 'login',
 *     }),
 *     // ... other providers
 *   ],
 * };
 * ```
 */
export function provideRecaptcha(config: RecaptchaServiceConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: RECAPTCHA_CONFIG,
      useValue: config,
    },
    RecaptchaService,
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const recaptcha = inject(RecaptchaService);
        // Return initialization function that ensures script starts loading
        return () => {
          // Trigger script load (fire-and-forget, don't block app startup)
          if (config.enabled && (config.version === 'v3' || config.version === 'enterprise')) {
            recaptcha.loadScript().catch(() => {
              // Silent fail - execute() will retry when called
            });
          }
        };
      },
      multi: true,
    },
  ]);
}
