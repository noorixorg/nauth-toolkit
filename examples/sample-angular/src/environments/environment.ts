import type { Environment } from './environment.interface';

/**
 * Development environment configuration
 *
 * This file is used for local development.
 * The build system replaces this file with environment.prod.ts during production builds.
 */
export const environment: Environment = {
  production: false,
  apiBaseUrl: 'https://api.angular.dev1.noorix.com',
  /** reCAPTCHA site key (optional). v3: google.com/recaptcha/admin; Enterprise: Cloud Console key. */
  recaptchaSiteKey: '6LdyF_QrAAAAAPDfa6WBRZmNUFpibwMHuqxMV2NW',
  /** 'v3' or 'enterprise'. Must match backend. Default 'enterprise' when using Enterprise keys. */
  recaptchaVersion: 'enterprise',
  tokenMode: 'json',
  recaptchaEnabled: false,
  showAppleLogin: true,
  showFacebookLogin: true,
};
