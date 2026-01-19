/**
 * Production environment configuration
 *
 * This file replaces environment.ts during production builds.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.angular.dev1.noorix.com',
  /** reCAPTCHA site key (optional). v3: google.com/recaptcha/admin; Enterprise: Cloud Console key. */
  recaptchaSiteKey: '' as string,
  /** 'v3' or 'enterprise'. Must match backend. Default 'enterprise' when using Enterprise keys. */
  recaptchaVersion: 'enterprise' as 'v3' | 'enterprise',
};

