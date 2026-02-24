/**
 * Shared type for environment configuration.
 * Used by environment.ts and environment.prod.ts so app.config.ts has typed access.
 */
export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  recaptchaSiteKey: string;
  recaptchaVersion: 'v3' | 'enterprise';
  tokenMode: 'cookies' | 'json';
  recaptchaEnabled: boolean;
  showAppleLogin: boolean;
  showFacebookLogin: boolean;
}
