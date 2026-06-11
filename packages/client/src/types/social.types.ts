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
   * Default: config.redirects.loginSuccess || config.redirects.success || '/'
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

  /**
   * Optional OAuth parameters to pass to the provider
   *
   * These parameters override config defaults and allow per-request customization.
   * Use cases:
   * - Google: Force account chooser, restrict to domain
   * - Facebook: Rerequest declined permissions
   * - Apple: Add nonce for ID token validation
   *
   * @example Google - Force account chooser
   * ```typescript
   * { prompt: 'select_account' }
   * ```
   *
   * @example Facebook - Rerequest permissions
   * ```typescript
   * { auth_type: 'rerequest' }
   * ```
   */
  oauthParams?: Record<string, string>;
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
