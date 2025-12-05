import { AuthResponseDTO } from '../dto';
import { OAuthUserProfile } from '../interfaces/oauth.interface';

/**
 * Social Auth Provider Service Interface
 *
 * Defines the contract for social authentication provider services.
 * Each provider (Google, Apple, Facebook, etc.) must implement this interface
 * to be registered with the core SocialAuthService.
 *
 * This allows for:
 * - Modular provider imports (only install what you need)
 * - Consistent API across all providers
 * - Proper NestJS dependency injection
 * - Easy addition of new providers without modifying core code
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class GoogleSocialAuthService implements ISocialAuthProviderService {
 *   readonly providerName = 'google';
 *
 *   async getAuthUrl(state?: string): Promise<string> {
 *     // Generate Google OAuth URL
 *   }
 *
 *   async handleCallback(code: string, state: string): Promise<AuthResponseDTO> {
 *     // Handle Google OAuth callback
 *   }
 *
 *   async verifyToken(idToken: string, accessToken?: string, profileData?: any): Promise<AuthResponseDTO> {
 *     // Verify Google ID token
 *   }
 * }
 * ```
 */
export interface ISocialAuthProviderService {
  /**
   * Provider name (e.g., 'google', 'apple', 'facebook')
   * Used as the key in the provider registry
   */
  readonly providerName: string;

  /**
   * Generate OAuth authorization URL for this provider
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   * @throws {BadRequestException} When provider is not properly configured
   *
   * @example
   * ```typescript
   * const authUrl = await provider.getAuthUrl('random-state-123');
   * // Redirect user to authUrl
   * ```
   */
  getAuthUrl(state?: string): Promise<string>;

  /**
   * Handle OAuth callback and authenticate user
   *
   * Exchanges authorization code for access token, fetches user profile,
   * and returns unified authentication response with JWT tokens.
   *
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter from OAuth callback (for CSRF protection)
   * @returns Unified authentication response with tokens and user info
   * @throws {BadRequestException} When callback is invalid
   *
   * @example
   * ```typescript
   * const result = await provider.handleCallback(code, state);
   * console.log(result.accessToken); // JWT access token
   * console.log(result.user.email); // User email
   * ```
   */
  handleCallback(code: string, state: string): Promise<AuthResponseDTO>;

  /**
   * Verify social authentication token from native mobile apps
   *
   * Handles authentication tokens from native mobile apps (iOS/Android)
   * that use native SDKs (Google Sign-In SDK, Apple Sign In, etc.)
   *
   * @param idToken - ID token from native SDK
   * @param accessToken - Optional access token from native SDK
   * @param profileData - Optional profile data from native SDK (for name extraction)
   * @returns Unified authentication response with tokens and user info
   * @throws {BadRequestException} When token is invalid
   *
   * @example
   * ```typescript
   * const result = await provider.verifyToken(idToken, accessToken, profileData);
   * return result; // Same format as login/signup
   * ```
   */
  verifyToken(idToken: string, accessToken?: string, profileData?: any): Promise<AuthResponseDTO>;

  /**
   * Link social account to existing user
   *
   * Used when an authenticated user wants to link a social account
   * to their existing account.
   *
   * @param userId - User ID (sub)
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter from OAuth callback
   * @returns Success message
   * @throws {NotFoundException} When user is not found
   * @throws {ConflictException} When account is already linked
   *
   * @example
   * ```typescript
   * await provider.linkAccount(userId, code, state);
   * ```
   */
  linkAccount(userId: string, code: string, state: string): Promise<{ message: string }>;

  /**
   * Get OAuth user profile from callback
   *
   * Internal method used by handleCallback to extract user profile.
   * Exposed for advanced use cases.
   *
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter from OAuth callback
   * @returns OAuth user profile
   * @private
   */
  getUserProfileFromCallback(code: string, state: string): Promise<OAuthUserProfile>;
}
