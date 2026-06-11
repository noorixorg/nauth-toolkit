import { InjectionToken } from '@angular/core';
import { NAuthClientConfig } from '@nauth-toolkit/client';

/**
 * reCAPTCHA configuration for Angular client.
 *
 * Extends base client RecaptchaConfig with Angular-specific options.
 *
 * @example v3 Automatic Mode
 * ```typescript
 * {
 *   enabled: true,
 *   version: 'v3',
 *   siteKey: '6LcExample_Site_Key',
 *   action: 'login',
 *   autoLoadScript: true,
 * }
 * ```
 *
 * @example v2 Manual Mode
 * ```typescript
 * {
 *   enabled: true,
 *   version: 'v2',
 *   siteKey: '6LcExample_Site_Key',
 *   manualChallenge: true,
 * }
 * ```
 */
export interface RecaptchaAngularConfig {
  /**
   * Enable/disable reCAPTCHA.
   * Set to false to disable even if configured (useful for testing).
   */
  enabled: boolean;

  /**
   * reCAPTCHA version: v2 (checkbox), v3 (invisible), or enterprise.
   */
  version: 'v2' | 'v3' | 'enterprise';

  /**
   * Site key from Google reCAPTCHA console.
   * This is safe to expose publicly (it's the public key).
   */
  siteKey: string;

  /**
   * Action name for v3/Enterprise analytics.
   * Helps track which actions are being protected.
   * Common values: 'login', 'signup', 'submit'
   *
   * @default 'submit'
   */
  action?: string;

  /**
   * Manual challenge mode (v2 only).
   * If true, you must manually call RecaptchaService.render() and get token.
   * If false, AuthService auto-generates token before login/signup.
   *
   * @default false
   */
  manualChallenge?: boolean;

  /**
   * Automatically load the Google reCAPTCHA script.
   * If false, you must manually load the script.
   *
   * @default true
   */
  autoLoadScript?: boolean;

  /**
   * Language code for reCAPTCHA widget (v2 only).
   * @example 'en', 'es', 'fr', 'de'
   * @default Browser language
   */
  language?: string;
}

/**
 * Angular-specific NAuth configuration.
 *
 * Extends base NAuthClientConfig with Angular-specific options.
 *
 * @example
 * ```typescript
 * const config: NAuthAngularConfig = {
 *   baseUrl: 'https://api.example.com/auth',
 *   tokenDelivery: 'cookies',
 *   recaptcha: {
 *     enabled: true,
 *     version: 'v3',
 *     siteKey: '6LcExample_Site_Key',
 *     action: 'login',
 *   },
 * };
 * ```
 */
export interface NAuthAngularConfig extends NAuthClientConfig {
  /**
   * Google reCAPTCHA configuration (optional).
   * Provides bot protection for login/signup endpoints.
   */
  recaptcha?: RecaptchaAngularConfig;
}

/**
 * Injection token for providing NAuthClientConfig in Angular apps.
 */
export const NAUTH_CLIENT_CONFIG = new InjectionToken<NAuthClientConfig>('NAUTH_CLIENT_CONFIG');
