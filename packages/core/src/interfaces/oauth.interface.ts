/**
 * OAuth User Profile Interface
 * Standardized user profile data from OAuth providers
 *
 * @example
 * ```typescript
 * const profile: OAuthUserProfile = {
 *   id: 'google_123',
 *   email: 'user@gmail.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   picture: 'https://...',
 *   verified: true
 * };
 * ```
 */
export interface OAuthUserProfile {
  /**
   * Provider's unique identifier for the user
   * Examples: Google sub, Apple user ID, Facebook ID
   */
  id: string;

  /**
   * User's email address
   * May be null if not provided by provider
   */
  email?: string | null;

  /**
   * User's first name
   * May be null if not provided by provider
   */
  firstName?: string | null;

  /**
   * User's last name
   * May be null if not provided by provider
   */
  lastName?: string | null;

  /**
   * User's profile picture URL
   * May be null if not provided by provider
   */
  picture?: string | null;

  /**
   * Whether the email is verified by the provider
   * @default false
   */
  verified?: boolean;

  /**
   * Additional provider-specific data
   * Contains raw response from OAuth provider
   */
  raw?: Record<string, unknown>;
}

/**
 * OAuth Client Interface
 * Defines the contract for OAuth provider clients
 *
 * @example
 * ```typescript
 * class GoogleOAuthClient implements OAuthClient {
 *   async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
 *     // Implementation for Google
 *   }
 * }
 * ```
 */
export interface OAuthClient {
  /**
   * Get user profile from OAuth provider using access token
   *
   * @param accessToken - OAuth access token
   * @returns User profile data
   * @throws {Error} When API call fails or token is invalid
   *
   * @example
   * ```typescript
   * const profile = await oauthClient.getUserProfile(accessToken);
   * console.log(profile.email); // user@example.com
   * ```
   */
  getUserProfile(accessToken: string): Promise<OAuthUserProfile>;

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - Redirect URI used in OAuth flow
   * @returns Access token and optional refresh token
   * @throws {Error} When token exchange fails
   *
   * @example
   * ```typescript
   * const tokens = await oauthClient.exchangeCodeForToken(code, redirectUri);
   * console.log(tokens.accessToken); // access_token_here
   * ```
   */
  exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
}

/**
 * OAuth Configuration Interface
 * Configuration for OAuth clients
 *
 * @example
 * ```typescript
 * const config: OAuthConfig = {
 *   clientId: 'google_client_id',
 *   clientSecret: 'google_client_secret',
 *   redirectUri: 'https://myapp.com/auth/google/callback'
 * };
 * ```
 */
export interface OAuthConfig {
  /**
   * OAuth client ID
   */
  clientId: string;

  /**
   * OAuth client secret
   */
  clientSecret: string;

  /**
   * OAuth redirect URI
   */
  redirectUri: string;

  /**
   * OAuth scopes
   * @default ['openid', 'email', 'profile']
   */
  scopes?: string[];
}
