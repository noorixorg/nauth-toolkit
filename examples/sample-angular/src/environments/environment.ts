import type { Environment } from './environment.interface';

/**
 * Development environment configuration
 *
 * This file is used for local development.
 * The build system replaces this file with environment.prod.ts during production builds.
 */
export const environment: Environment = {
  production: false,
  apiBaseUrl: 'https://api.angular.dev1.noorix.com/api',
  /** reCAPTCHA Enterprise site key from Google Cloud Console. */
  recaptchaSiteKey: '6Lee8HgsAAAAADZde5RWVooDqechhjxw2PXGtZo_',
  /** 'v3' or 'enterprise'. Must match backend. */
  recaptchaVersion: 'enterprise',
  tokenMode: 'cookies',
  recaptchaEnabled: true,
  showAppleLogin: true,
  showFacebookLogin: true,
};
