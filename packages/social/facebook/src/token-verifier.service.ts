import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode, ITokenVerifierService } from '@nauth-toolkit/core';
import { VerifiedFacebookTokenProfile } from './verified-token-profile.interface';

/**
 * Token Verifier Service for Facebook OAuth (Platform-Agnostic)
 *
 * Handles secure verification of Facebook access tokens via Graph API.
 * Validates tokens by calling Facebook's debug_token endpoint.
 *
 * Security Features:
 * - Facebook: Validates access tokens via Facebook Graph API
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const verifier = new TokenVerifierService(config);
 * const profile = await verifier.verifyFacebookToken(accessToken, appId, appSecret);
 * console.log(profile.id); // Verified Facebook user ID
 * ```
 */
export class TokenVerifierService implements ITokenVerifierService {
  private readonly logger: NAuthLogger;

  constructor(config: NAuthConfig) {
    this.logger = config.logger as NAuthLogger;
  }

  /**
   * Verify Facebook access token via Graph API
   *
   * Validates the access token by calling Facebook's debug_token endpoint,
   * which checks the token's validity and returns user information.
   *
   * @param accessToken - Access token from Facebook OAuth
   * @param appId - Facebook App ID
   * @param appSecret - Facebook App Secret (server-side only)
   * @returns Verified user profile data
   * @throws {BadRequestException} When token is invalid or API call fails
   *
   * @example
   * ```typescript
   * try {
   *   const profile = await verifier.verifyFacebookToken(accessToken, appId, appSecret);
   *   console.log(`Verified Facebook user: ${profile.id}`);
   * } catch (error) {
   *   console.error('Token verification failed:', error.message);
   * }
   * ```
   */
  async verifyFacebookToken(
    accessToken: string,
    appId: string,
    appSecret: string,
  ): Promise<VerifiedFacebookTokenProfile> {
    try {
      this.logger?.debug?.('[TokenVerifier] Verifying Facebook token with Graph API');

      // Step 1: Verify token with debug_token endpoint
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
      const debugResponse = await fetch(debugUrl);

      if (!debugResponse.ok) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Facebook token validation failed');
      }

      const debugData = (await debugResponse.json()) as any;

      // Check if token is valid
      if (!debugData.data || !debugData.data.is_valid) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Invalid Facebook access token');
      }

      // Check if token belongs to the correct app
      if (debugData.data.app_id !== appId) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Token does not belong to this app');
      }

      // Step 2: Get user profile
      const profileUrl = `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${accessToken}`;
      const profileResponse = await fetch(profileUrl);

      if (!profileResponse.ok) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Failed to fetch Facebook user profile');
      }

      const profile = (await profileResponse.json()) as any;

      this.logger?.log?.(`[TokenVerifier] Facebook token verified (secure): ${profile.email || profile.id}`);

      return {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        picture: profile.picture,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`[TokenVerifier] Facebook token verification FAILED: ${errorMessage}`);
      throw new NAuthException(
        AuthErrorCode.SOCIAL_TOKEN_INVALID,
        `Facebook token verification failed: ${errorMessage}`,
      );
    }
  }
}
