/**
 * Social OAuth state store interface
 *
 * This abstracts storage for OAuth CSRF `state` and redirect context so it can be:
 * - shared across multiple server instances (ECS / k8s / multi-node)
 * - backed by Redis or database using the existing transient `StorageAdapter`
 *
 * Security notes:
 * - `state` MUST be one-time use (replay protection)
 * - `state` MUST expire quickly (default: 5 minutes)
 * - Stored redirect context MUST NOT include secrets (it may be echoed back to the frontend)
 *
 * @example
 * ```typescript
 * // Provider flow (CSRF)
 * const state = await store.createCsrfState('google');
 * // redirect user to provider with state
 * await store.validateAndConsumeCsrfState('google', state);
 *
 * // Redirect flow context (optional)
 * await store.setRedirectContext(state, { returnTo: '/auth/callback', appState: '12345', action: 'login' });
 * const ctx = await store.consumeRedirectContext(state);
 * ```
 */
export interface ISocialAuthStateStore {
  /**
   * Create a CSRF `state` value for a provider and persist it for later validation.
   *
   * @param provider - Provider name (e.g. 'google', 'apple', 'facebook')
   * @returns Newly generated state token
   * @throws {Error} When provider is invalid or storage fails
   */
  createCsrfState(provider: string): Promise<string>;

  /**
   * Validate and consume a CSRF `state` token.
   *
   * This MUST be one-time use: subsequent validations must fail.
   *
   * @param provider - Provider expected for this state token
   * @param state - State token from the OAuth callback
   * @throws {Error} When state is missing/invalid/expired or provider mismatch occurs
   */
  validateAndConsumeCsrfState(provider: string, state: string): Promise<void>;

  /**
   * Store optional redirect context for a CSRF state token.
   *
   * @param state - CSRF state token
   * @param context - Redirect context (non-secret)
   * @throws {Error} When storage fails
   */
  setRedirectContext(state: string, context: SocialAuthRedirectContext): Promise<void>;

  /**
   * Consume (read and delete) redirect context for a CSRF state token.
   *
   * This is separate from CSRF validation consumption; controllers may consume context
   * after provider validation to build the final frontend redirect.
   *
   * @param state - CSRF state token
   * @returns Context or null if missing/expired
   */
  consumeRedirectContext(state: string): Promise<SocialAuthRedirectContext | null>;
}

/**
 * Redirect context stored during the redirect-first social login flow.
 *
 * @example
 * ```typescript
 * { returnTo: '/auth/callback', appState: '12345', action: 'login' }
 * ```
 */
export interface SocialAuthRedirectContext {
  /**
   * Frontend URL or path to redirect to after completing authentication.
   *
   * Recommended: relative path only (e.g. `/auth/callback`) to prevent open redirects.
   */
  returnTo: string;

  /**
   * Opaque, non-secret application state to round-trip back to the frontend.
   * This should be URL-safe or will be URL-encoded when appended as a query param.
   */
  appState?: string;

  /**
   * Delivery mode chosen at redirect start time.
   *
   * Why this exists:
   * - In hybrid deployments, the provider callback request often has no reliable `Origin` header.
   * - We must not guess delivery based on the provider callback request.
   *
   * When set, the callback flow MUST honor it.
   */
  delivery?: 'cookies' | 'json';

  /**
   * Trusted device token captured at redirect start time.
   *
   * WHY:
   * - OAuth provider callback requests often do not include cookies (e.g., SameSite=strict)
   * - Mobile/native callbacks also cannot set custom headers reliably in redirect flows
   * - We still want trusted-device detection (and audit metadata) to be correct during callback
   *
   * SECURITY:
   * - This value is stored server-side only (StorageAdapter-backed)
   * - It MUST NOT be appended to frontend redirect URLs or returned to the frontend
   */
  deviceToken?: string;

  /**
   * Redirect flow action.
   * - `login`: Authenticate user
   * - `link`: Link provider to existing session (future)
   */
  action: 'login' | 'link';
}
