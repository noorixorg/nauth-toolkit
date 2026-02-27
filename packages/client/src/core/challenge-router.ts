import { AuthResponse, AuthChallenge } from '../types/auth.types';
import { ResolvedNAuthClientConfig } from './config';
import { AuthResponseContext, type NAuthStorageAdapter } from '../types/config.types';

const OAUTH_STATE_KEY = 'nauth_oauth_state';

/**
 * Challenge router - handles automatic navigation after auth operations.
 *
 * This is internal to the SDK. Consumer apps interact via config options:
 * - `onAuthResponse` callback for full control (dialogs, etc.)
 * - `navigationHandler` for custom navigation
 * - `redirects.challengeRoutes` for custom route mapping
 * - `redirects.useSingleChallengeRoute` for query param mode
 *
 * @example Dialog-based app
 * ```typescript
 * {
 *   onAuthResponse: (response, context) => {
 *     if (response.challengeName) {
 *       dialog.open(ChallengeComponent, { data: response });
 *     }
 *   }
 * }
 * ```
 *
 * @example Custom routes
 * ```typescript
 * {
 *   redirects: {
 *     challengeRoutes: {
 *       [AuthChallenge.MFA_REQUIRED]: '/auth/mfa',
 *     }
 *   }
 * }
 * ```
 *
 * @example Single route with query param
 * ```typescript
 * {
 *   redirects: {
 *     useSingleChallengeRoute: true
 *   }
 * }
 * ```
 */
export class ChallengeRouter {
  constructor(
    private config: ResolvedNAuthClientConfig,
    private oauthStorage: NAuthStorageAdapter,
  ) {}

  /**
   * Handle auth response - either call callback or auto-navigate.
   *
   * @param response - Auth response from backend
   * @param context - Context about the auth operation
   */
  async handleAuthResponse(response: AuthResponse, context: AuthResponseContext): Promise<void> {
    // If custom handler provided, delegate to app
    if (this.config.onAuthResponse) {
      await this.config.onAuthResponse(response, context);
      return;
    }

    // Auto-navigate based on response
    if (response.challengeName) {
      await this.navigateToChallenge(response);
    } else {
      // Retrieve stored appState for social redirect flows (when not already in context)
      const queryParams = context.appState ? { appState: context.appState } : await this.getStoredOauthState();
      await this.navigateToSuccess(queryParams, context);
    }
  }

  /**
   * Resolve the configured success URL based on context and explicit override keys.
   *
   * IMPORTANT:
   * - `null` explicitly disables auto-navigation (caller should rely on framework events / custom routing).
   * - `undefined` / missing keys fall back to other configured values or defaults.
   * - Falls back to legacy `redirects.success` when new keys are not set.
   *
   * @param context - Auth response context
   * @returns URL string, or null when auto-navigation is disabled
   */
  private resolveSuccessUrl(context?: AuthResponseContext): string | null {
    const redirects = this.config.redirects;
    if (!redirects) {
      return '/';
    }

    const isSignup = context?.source === 'signup';

    if (isSignup) {
      if (redirects.signupSuccess === null) return null;
      if (typeof redirects.signupSuccess === 'string') return redirects.signupSuccess;
    }

    if (!isSignup) {
      if (redirects.loginSuccess === null) return null;
      if (typeof redirects.loginSuccess === 'string') return redirects.loginSuccess;
    }

    // Backward-compatible fallback (legacy API)
    if (redirects.success === null) return null;
    if (typeof redirects.success === 'string') return redirects.success;

    return '/';
  }

  /**
   * Navigate to appropriate challenge route.
   *
   * @param response - Auth response containing challenge info
   */
  async navigateToChallenge(response: AuthResponse): Promise<void> {
    const url = this.buildChallengeUrl(response);
    await this.navigate(url);
  }

  /**
   * Navigate to success URL.
   *
   * @param queryParams - Optional query parameters to append to the success URL
   * @param context - Optional auth context for selecting the success route
   *
   * @example
   * ```typescript
   * await router.navigateToSuccess({ appState: 'invite-code-123' });
   * ```
   */
  async navigateToSuccess(
    queryParams?: Record<string, string | null | undefined>,
    context?: AuthResponseContext,
  ): Promise<void> {
    const resolved = this.resolveSuccessUrl(context);
    if (resolved === null) {
      return;
    }

    let url = resolved;

    // Append query parameters if provided
    // Build path with query string (not full URL) to work with both
    // Angular Router (navigateByUrl) and window.location
    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) {
          searchParams.set(key, value);
        }
      });
      const queryString = searchParams.toString();
      url = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
    }

    await this.navigate(url);
  }

  /**
   * Retrieve stored OAuth appState from sessionStorage.
   *
   * NOTE: This method does NOT clear the storage. Only the public getLastOauthState() API clears it.
   * This allows the SDK to read appState for auto-navigation while still making it available to
   * consumers via the public API.
   *
   * @returns Query params object with appState if present, undefined otherwise
   */
  private async getStoredOauthState(): Promise<Record<string, string> | undefined> {
    try {
      const stored = await this.oauthStorage.getItem(OAUTH_STATE_KEY);
      if (stored) {
        // Do NOT clear - consumer may want to retrieve it via getLastOauthState()
        return { appState: stored };
      }
    } catch {
      // Ignore storage errors
    }
    return undefined;
  }

  /**
   * Navigate to error URL.
   *
   * @param type - Type of error (oauth or session)
   */
  async navigateToError(type: 'oauth' | 'session'): Promise<void> {
    const redirects = this.config.redirects;
    const raw = type === 'oauth' ? redirects?.oauthError : redirects?.sessionExpired;
    if (raw === null) {
      return;
    }
    const url = raw ?? '/login';
    await this.navigate(url);
  }

  /**
   * Build challenge URL based on configuration.
   *
   * Priority:
   * 1. Custom route mapping (challengeRoutes)
   * 2. Single route with query param (useSingleChallengeRoute)
   * 3. MFA-specific routes (mfaRoutes) - for MFA_REQUIRED challenge only
   * 4. Default separate routes (challengeBase + kebab-case)
   *
   * @param response - Auth response containing challenge info
   * @returns URL to navigate to
   */
  buildChallengeUrl(response: AuthResponse): string {
    const challengeName = response.challengeName!;

    // Priority 1: Custom route mapping
    if (this.config.redirects?.challengeRoutes?.[challengeName]) {
      return this.config.redirects.challengeRoutes[challengeName]!;
    }

    const base = this.config.redirects?.challengeBase || '/auth/challenge';

    // Priority 2: Single route with query param
    if (this.config.redirects?.useSingleChallengeRoute) {
      return `${base}?challenge=${challengeName}`;
    }

    // Priority 3: MFA-specific routes (only for MFA_REQUIRED)
    if (challengeName === AuthChallenge.MFA_REQUIRED) {
      const mfaUrl = this.buildMFAUrl(response);
      if (mfaUrl) {
        return mfaUrl;
      }
    }

    // Priority 4: Default separate routes
    const route = this.buildDefaultRouteSegment(challengeName, response);
    return `${base}/${route}`;
  }

  /**
   * Build MFA-specific URL if custom mfaRoutes are configured.
   *
   * @param response - Auth response with MFA challenge parameters
   * @returns Custom MFA URL if configured, null otherwise
   */
  private buildMFAUrl(response: AuthResponse): string | null {
    const params = response.challengeParameters;
    const method = params?.['preferredMethod'] || params?.['method'];
    const mfaRoutes = this.config.redirects?.mfaRoutes;

    if (!mfaRoutes) {
      return null;
    }

    // Passkey verification
    if (method === 'passkey' && mfaRoutes.passkey) {
      return mfaRoutes.passkey;
    }

    // MFA method selector (multiple methods available)
    if (
      !method &&
      params?.['availableMethods'] &&
      Array.isArray(params['availableMethods']) &&
      params['availableMethods'].length > 1
    ) {
      if (mfaRoutes.selector) {
        return mfaRoutes.selector;
      }
    }

    // Default MFA verification (sms, email, totp)
    if (mfaRoutes.default) {
      return mfaRoutes.default;
    }

    return null;
  }

  /**
   * Build default route segment for a challenge.
   *
   * @param challengeName - Challenge type
   * @param response - Auth response for extracting challenge parameters (needed for MFA)
   * @returns Route segment (e.g., 'mfa-required/passkey', 'verify-email')
   */
  private buildDefaultRouteSegment(challengeName: AuthChallenge, response?: AuthResponse): string {
    // MFA_REQUIRED needs special handling for backward compatibility
    // with existing apps that have passkey and selector routes
    if (challengeName === AuthChallenge.MFA_REQUIRED && response) {
      const params = response.challengeParameters;
      const method = params?.['preferredMethod'] || params?.['method'];

      // Passkey verification
      if (method === 'passkey') {
        return 'mfa-required/passkey';
      }

      // MFA method selector (multiple methods available)
      if (
        !method &&
        params?.['availableMethods'] &&
        Array.isArray(params['availableMethods']) &&
        params['availableMethods'].length > 1
      ) {
        return 'mfa-selector';
      }

      // Default MFA verification (sms, email, totp)
      return 'mfa-required';
    }

    // Generic kebab-case route for other challenges
    return challengeName.toLowerCase().replace(/_/g, '-');
  }

  /**
   * Execute navigation using configured handler or default.
   *
   * @param url - URL to navigate to
   */
  private async navigate(url: string): Promise<void> {
    if (this.config.navigationHandler) {
      await this.config.navigationHandler(url);
    } else {
      // Default: use window.location.replace (works in guards and browsers)
      if (typeof window !== 'undefined') {
        window.location.replace(url);
      }
    }
  }

  /**
   * Expose URL builder for guards/components that need it.
   *
   * @param response - Auth response containing challenge info
   * @returns URL for the challenge
   */
  getChallengeUrl(response: AuthResponse): string {
    return this.buildChallengeUrl(response);
  }

  /**
   * Check if the error redirect is disabled.
   *
   * WHY: Guards need to know if they should return true (activate route) or false
   * (prevent activation) when auto-redirect is disabled via null redirect URLs.
   *
   * @param type - Type of error (oauth or session)
   * @returns True if the error redirect is explicitly null, false otherwise
   */
  isErrorRedirectDisabled(type: 'oauth' | 'session'): boolean {
    const redirects = this.config.redirects;
    if (!redirects) {
      return false;
    }

    const redirectUrl = type === 'oauth' ? redirects.oauthError : redirects.sessionExpired;
    return redirectUrl === null;
  }

  /**
   * Check if the success redirect is disabled for a given context.
   *
   * WHY: Guards need to know if they should return true (activate route) or false
   * (prevent activation) when auto-redirect is disabled via null redirect URLs.
   *
   * @param context - Optional auth context to determine which success redirect to check
   * @returns True if the success redirect is explicitly null, false otherwise
   */
  isSuccessRedirectDisabled(context?: AuthResponseContext): boolean {
    const resolved = this.resolveSuccessUrl(context);
    return resolved === null;
  }
}
