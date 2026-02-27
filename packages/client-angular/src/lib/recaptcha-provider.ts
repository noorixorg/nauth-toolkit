import { inject, EnvironmentProviders, makeEnvironmentProviders, APP_INITIALIZER } from '@angular/core';
import { RecaptchaService, RECAPTCHA_CONFIG, RecaptchaServiceConfig } from './recaptcha.service';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';

/**
 * Provides reCAPTCHA configuration and automatic script preloading.
 *
 * **IMPORTANT:** When using with `NAUTH_CLIENT_CONFIG`, you must pass
 * `provideRecaptcha()` call MUST appear AFTER the `NAUTH_CLIENT_CONFIG` provider.
 *
 * Sets up `RECAPTCHA_CONFIG` and `RecaptchaService`. When called without config,
 * reads from `NAUTH_CLIENT_CONFIG.recaptcha` if available.
 *
 * @param config - Optional. reCAPTCHA config (enabled, version, siteKey, action).
 *   If omitted, will attempt to use `NAUTH_CLIENT_CONFIG.recaptcha`.
 *   Pass explicitly when not using NAuth or to override.
 * @returns Environment providers for reCAPTCHA
 *
 * @example With NAUTH_CLIENT_CONFIG (no duplication)
 * ```typescript
 * providers: [
 *   { provide: NAUTH_CLIENT_CONFIG, useValue: { baseUrl: '...', recaptcha: { enabled: true, version: 'enterprise', siteKey: '...', action: 'login' } } },
 *   provideRecaptcha(),  // reads NAUTH_CLIENT_CONFIG.recaptcha at runtime
 * ]
 * ```
 *
 * @example Without NAuth (explicit config)
 * ```typescript
 * provideRecaptcha({ enabled: true, version: 'v3', siteKey: '...', action: 'login' })
 * ```
 */
export function provideRecaptcha(config?: RecaptchaServiceConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: RECAPTCHA_CONFIG,
      useFactory: (): RecaptchaServiceConfig | undefined => {
        if (config !== undefined) {
          return config;
        }
        // Try to inject NAUTH_CLIENT_CONFIG at runtime
        try {
          const clientConfig = inject(NAUTH_CLIENT_CONFIG, { optional: true });
          const recaptchaConfig = clientConfig?.recaptcha;

          // Debug log when debug is enabled
          if (typeof console !== 'undefined' && clientConfig?.debug && recaptchaConfig) {
            console.log('[provideRecaptcha] Using NAUTH_CLIENT_CONFIG.recaptcha');
          }

          return recaptchaConfig as RecaptchaServiceConfig | undefined;
        } catch {
          // Injection failed (NAUTH_CLIENT_CONFIG not available)
          return undefined;
        }
      },
    },
    RecaptchaService,
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        return () => {
          const c = inject(RECAPTCHA_CONFIG);
          if (c?.enabled && (c.version === 'v3' || c.version === 'enterprise')) {
            inject(RecaptchaService)
              .loadScript()
              .catch(() => {});
          }
        };
      },
      multi: true,
    },
  ]);
}
