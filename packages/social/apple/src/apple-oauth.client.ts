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
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
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
        const errorData = (await response.json()) as any;
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Token exchange failed: ${errorData.error_description || errorData.error}`,
        );
      }

      const data = (await response.json()) as any;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
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

      const data = (await response.json()) as any;

      // Map Apple's response to our standardized format
      // Apple provides name in a nested object format
      const firstName = data.name?.firstName || null;
      const lastName = data.name?.lastName || null;

      return {
        id: data.sub, // Apple uses 'sub' as the user identifier
        email: data.email || null,
        firstName,
        lastName,
        picture: null, // Apple doesn't provide profile pictures
        verified: data.email_verified || false,
        raw: data,
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
   * @returns Authorization URL for redirecting user to Apple
   *
   * @example
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('random-state');
   * // Redirect user to authUrl
   * ```
   */
  getAuthorizationUrl(state?: string): string {
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

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }
}
