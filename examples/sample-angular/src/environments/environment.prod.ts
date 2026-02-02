import type { Environment } from './environment.interface';

/**
 * Production environment configuration
 *
 * This file replaces environment.ts during production builds.
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://demo.nauth.dev/api',
  /** reCAPTCHA site key (optional). v3: google.com/recaptcha/admin; Enterprise: Cloud Console key. */
  recaptchaSiteKey: '' as string,
  /** 'v3' or 'enterprise'. Must match backend. Default 'enterprise' when using Enterprise keys. */
  recaptchaVersion: 'enterprise' as 'v3' | 'enterprise',
  /** Token delivery mode: 'cookies' for traditional web apps, 'json' for SPAs with localStorage */
  tokenMode: 'cookies' as 'cookies' | 'json',
  recaptchaEnabled: true,
};

