import { OAuthClient, OAuthConfig, OAuthUserProfile, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

/**
 * Google token exchange response
 */
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * Google error response
 */
interface GoogleErrorResponse {
  error?: string;
  error_description?: string;
}

/**
 * Google user profile response
 */
interface GoogleUserProfileResponse {
  id: string;
  email?: string;
  verified_email?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Google OAuth Client Implementation (Platform-Agnostic)
 *
 * Handles OAuth flow with Google's OpenID Connect API
 * Uses Google's userinfo endpoint for profile data
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const client = new GoogleOAuthClient({
 *   clientId: 'google_client_id',
 *   clientSecret: 'google_client_secret',
 *   redirectUri: 'https://myapp.com/auth/google/callback'
 * });
 *
 * const profile = await client.getUserProfile(accessToken);
 * ```
 */
export class GoogleOAuthClient implements OAuthClient {
  private readonly config: OAuthConfig;
  private readonly tokenEndpoint = 'https://oauth2.googleapis.com/token';
  private readonly userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';

  constructor(config: OAuthConfig) {
    this.config = {
      scopes: ['openid', 'email', 'profile'],
      ...config,
    };
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from Google OAuth callback
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
        const errorData = (await response.json()) as GoogleErrorResponse;
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Token exchange failed: ${errorData.error_description || errorData.error}`,
        );
      }

      const data = (await response.json()) as GoogleTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Google token exchange failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Google token exchange failed: Unknown error');
    }
  }

  /**
   * Get user profile from Google using access token
   *
   * @param accessToken - OAuth access token
   * @returns User profile data
   * @throws {Error} When API call fails or token is invalid
   *
   * @example
   * ```typescript
   * const profile = await client.getUserProfile(accessToken);
   * console.log(profile.email); // user@gmail.com
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
          `Google API call failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as GoogleUserProfileResponse;

      // Map Google's response to our standardized format
      return {
        id: data.id,
        email: data.email || null,
        firstName: data.given_name || null,
        lastName: data.family_name || null,
        picture: data.picture || null,
        verified: data.verified_email || false,
        raw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Google profile fetch failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Google profile fetch failed: Unknown error');
    }
  }

  /**
   * Generate Google OAuth authorization URL
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL for redirecting user to Google
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
      scope: this.config.scopes?.join(' ') || 'openid email profile',
      response_type: 'code',
      access_type: 'offline',
      // Don't specify prompt - let Google decide when to show consent screen
      // Google will show it on first login and skip it for returning users
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}
