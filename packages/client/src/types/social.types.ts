/**
 * Social provider identifiers.
 */
export type SocialProvider = 'google' | 'apple' | 'facebook';

/**
 * Options for starting a redirect-first social login flow.
 *
 * This is a web-first API:
 * - Browser navigates to backend `/auth/social/:provider/redirect`
 * - Backend completes OAuth, sets cookies (or returns exchange token), and redirects back
 */
export interface SocialLoginOptions {
  /**
   * Frontend route (recommended) or URL to redirect to after the backend callback completes.
   * Default: config.redirects.success || '/'
   */
  returnTo?: string;

  /**
   * Optional application state to round-trip back to the frontend.
   * Must be treated as non-secret.
   */
  appState?: string;

  /**
   * Optional flow action.
   * Default: 'login'
   */
  action?: 'login' | 'link';
}

/**
 * Linked social accounts response.
 */
export interface LinkedAccountsResponse {
  providers: SocialProvider[];
}

/**
 * Native social verification request (mobile).
 */
export interface SocialVerifyRequest {
  provider: SocialProvider;
  idToken?: string;
  accessToken?: string;
  authorizationCode?: string;
}
