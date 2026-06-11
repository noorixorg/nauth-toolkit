import { OAuthClient, OAuthConfig, OAuthUserProfile, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

/**
 * Apple OAuth Client Implementation (Platform-Agnostic)
 *
 * Handles OAuth flow with Apple's Sign in with Apple API
 * Uses Apple's userinfo endpoint for profile data
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const client = new AppleOAuthClient({
 *   clientId: 'apple_client_id',
 *   clientSecret: 'apple_client_secret',
 *   redirectUri: 'https://myapp.com/auth/apple/callback'
 * });
 *
 * const profile = await client.getUserProfile(accessToken);
 * ```
 */
export class AppleOAuthClient implements OAuthClient {
  private readonly config: OAuthConfig;
  private readonly tokenEndpoint = 'https://appleid.apple.com/auth/token';
  private readonly userInfoEndpoint = 'https://appleid.apple.com/auth/userinfo';

  constructor(config: OAuthConfig) {
    this.config = {
      scopes: ['name', 'email'],
      ...config,
    };
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from Apple OAuth callback
   * @param redirectUri - Redirect URI used in OAuth flow
   * @param clientSecret - Optional client secret (overrides config.clientSecret)
   * @returns Access token and optional refresh token
   * @throws {Error} When token exchange fails
   *
   * @example
   * ```typescript
   * const tokens = await client.exchangeCodeForToken(code, redirectUri);
   * console.log(tokens.accessToken); // access_token_here
   * ```
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    clientSecret?: string,
  ): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: clientSecret || this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as unknown;
        const e = errorData as { error_description?: unknown; error?: unknown };
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Token exchange failed: ${String(e.error_description ?? e.error ?? 'Unknown error')}`,
        );
      }

      const data = (await response.json()) as unknown;
      const d = data as {
        access_token?: unknown;
        id_token?: unknown;
        refresh_token?: unknown;
        expires_in?: unknown;
      };
      const accessToken = typeof d.access_token === 'string' ? d.access_token : null;
      const idToken = typeof d.id_token === 'string' ? d.id_token : null;
      const refreshToken = typeof d.refresh_token === 'string' ? d.refresh_token : undefined;
      const expiresIn = typeof d.expires_in === 'number' ? d.expires_in : undefined;

      if (!accessToken || !idToken) {
        // SECURITY: We cannot proceed without an id_token (used for verified identity claims).
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          'Apple token exchange returned an invalid response (missing access_token or id_token).',
        );
      }

      return {
        accessToken,
        idToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Apple token exchange failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Apple token exchange failed: Unknown error');
    }
  }

  /**
   * Get user profile from Apple using access token
   *
   * @param accessToken - OAuth access token
   * @returns User profile data
   * @throws {Error} When API call fails or token is invalid
   *
   * @example
   * ```typescript
   * const profile = await client.getUserProfile(accessToken);
   * console.log(profile.email); // user@icloud.com
   * console.log(profile.firstName); // John
   * ```
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await fetch(this.userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Invalid or expired access token');
        }
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          `Apple API call failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as unknown;
      const d = data as {
        sub?: unknown;
        email?: unknown;
        email_verified?: unknown;
        name?: { firstName?: unknown; lastName?: unknown } | null;
      };

      // Map Apple's response to our standardized format
      // Apple provides name in a nested object format
      const firstName = typeof d.name?.firstName === 'string' ? d.name.firstName : null;
      const lastName = typeof d.name?.lastName === 'string' ? d.name.lastName : null;

      return {
        id: typeof d.sub === 'string' ? d.sub : '',
        email: typeof d.email === 'string' ? d.email : null,
        firstName,
        lastName,
        picture: null, // Apple doesn't provide profile pictures
        verified: d.email_verified === true || d.email_verified === 'true',
        raw: data as Record<string, unknown>,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Apple profile fetch failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Apple profile fetch failed: Unknown error');
    }
  }

  /**
   * Generate Apple OAuth authorization URL
   *
   * @param state - Optional state parameter for CSRF protection
   * @param oauthParams - Optional OAuth parameters to append to URL
   * @returns Authorization URL for redirecting user to Apple
   *
   * @example
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('random-state');
   * // Redirect user to authUrl
   * ```
   *
   * @example With OAuth params
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('state', { nonce: 'random-nonce' });
   * ```
   */
  getAuthorizationUrl(state?: string, oauthParams?: Record<string, string>): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes?.join(' ') || 'name email',
      response_type: 'code',
      response_mode: 'form_post',
    });

    if (state) {
      params.append('state', state);
    }

    // Apply additional OAuth params (from config or per-request)
    if (oauthParams) {
      Object.entries(oauthParams).forEach(([key, value]) => {
        params.append(key, value);
      });
    }

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }
}
