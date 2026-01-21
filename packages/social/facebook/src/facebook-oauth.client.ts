import { OAuthClient, OAuthConfig, OAuthUserProfile, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

/**
 * Facebook token exchange response
 */
interface FacebookTokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * Facebook error response
 */
interface FacebookErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

/**
 * Facebook user profile response
 */
interface FacebookUserProfileResponse {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

/**
 * Facebook OAuth Client Implementation (Platform-Agnostic)
 *
 * Handles OAuth flow with Facebook's Graph API
 * Uses Facebook's Graph API for profile data
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const client = new FacebookOAuthClient({
 *   clientId: 'facebook_client_id',
 *   clientSecret: 'facebook_client_secret',
 *   redirectUri: 'https://myapp.com/auth/facebook/callback'
 * });
 *
 * const profile = await client.getUserProfile(accessToken);
 * ```
 */
export class FacebookOAuthClient implements OAuthClient {
  private readonly config: OAuthConfig;
  private readonly tokenEndpoint = 'https://graph.facebook.com/v24.0/oauth/access_token';
  private readonly userInfoEndpoint = 'https://graph.facebook.com/v24.0/me';

  constructor(config: OAuthConfig) {
    this.config = {
      scopes: ['email', 'public_profile'],
      ...config,
    };
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from Facebook OAuth callback
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
      redirect_uri: redirectUri,
    });

    try {
      // Facebook returns the token in the URL, so we need to construct the URL
      const url = `${this.tokenEndpoint}?${params.toString()}`;
      const tokenResponse = await fetch(url);

      if (!tokenResponse.ok) {
        const errorData = (await tokenResponse.json()) as FacebookErrorResponse;
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Token exchange failed: ${errorData.error?.message || 'Unknown error'}`,
        );
      }

      const data = (await tokenResponse.json()) as FacebookTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: undefined, // Facebook doesn't provide refresh tokens in this flow
        expiresIn: data.expires_in,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Facebook token exchange failed: ${error.message}`,
        );
      }
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Facebook token exchange failed: Unknown error');
    }
  }

  /**
   * Get user profile from Facebook using access token
   *
   * @param accessToken - OAuth access token
   * @returns User profile data
   * @throws {Error} When API call fails or token is invalid
   *
   * @example
   * ```typescript
   * const profile = await client.getUserProfile(accessToken);
   * console.log(profile.email); // user@facebook.com
   * console.log(profile.firstName); // John
   * ```
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      // Facebook Graph API requires specific fields to be requested
      const fields = 'id,email,first_name,last_name,picture';
      const url = `${this.userInfoEndpoint}?fields=${fields}&access_token=${accessToken}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Invalid or expired access token');
        }
        const errorData = (await response.json()) as FacebookErrorResponse;
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          `Facebook API call failed: ${errorData.error?.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as FacebookUserProfileResponse;

      // CRITICAL: Require email from Facebook for signup
      if (!data.email) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_EMAIL_REQUIRED,
          'Email is required from Facebook. Please grant email permissions.',
        );
      }

      // Map Facebook's response to our standardized format
      // Email is always verified if Facebook returns it (same as Google/Apple)
      return {
        id: data.id,
        email: data.email,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        picture: data.picture?.data?.url || null,
        verified: true, // Email is verified if provided by Facebook
        raw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Facebook profile fetch failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Facebook profile fetch failed: Unknown error');
    }
  }

  /**
   * Generate Facebook OAuth authorization URL
   *
   * @param state - Optional state parameter for CSRF protection
   * @param oauthParams - Optional OAuth parameters to append to URL
   * @returns Authorization URL for redirecting user to Facebook
   *
   * @example
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('random-state');
   * // Redirect user to authUrl
   * ```
   *
   * @example With OAuth params
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('state', { auth_type: 'rerequest' });
   * ```
   */
  getAuthorizationUrl(state?: string, oauthParams?: Record<string, string>): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes?.join(',') || 'email,public_profile',
      response_type: 'code',
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

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }
}
