/**
 * Token Verifier Service Interface
 *
 * Defines the contract for OAuth token verification services.
 * Each platform-specific implementation must follow this interface.
 *
 * Note: Provider-specific verified token profile types are defined in each provider package,
 * not in core, to maintain proper separation of concerns.
 *
 * @example
 * ```typescript
 * // In Google provider package
 * import { ITokenVerifierService } from '@nauth-toolkit/core';
 *
 * interface VerifiedGoogleTokenProfile {
 *   sub: string;
 *   email: string;
 *   // ...
 * }
 *
 * class GoogleTokenVerifierService implements ITokenVerifierService {
 *   async verifyGoogleToken(idToken: string, clientId: string | string[]): Promise<VerifiedGoogleTokenProfile> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface ITokenVerifierService {
  /**
   * Verify Google ID token with cryptographic signature validation
   *
   * Uses Google's public keys to verify the JWT signature, ensuring the token
   * was issued by Google and has not been tampered with.
   *
   * @param idToken - ID token from Google OAuth
   * @param clientId - Google OAuth client ID for audience validation (supports multiple IDs)
   * @returns Verified user profile data (provider-specific type)
   * @throws {BadRequestException} When token is invalid, expired, or signature fails
   *
   * @example
   * ```typescript
   * try {
   *   const profile = await verifier.verifyGoogleToken(idToken, ['web-client-id', 'ios-client-id']);
   *   console.log(`Verified email: ${profile.email}`);
   * } catch (error) {
   *   console.error('Token verification failed:', error.message);
   * }
   * ```
   */
  verifyGoogleToken?(idToken: string, clientId: string | string[]): Promise<unknown>;

  /**
   * Verify Apple ID token with JWT signature validation
   *
   * Fetches Apple's public keys from their JWKS endpoint and verifies the
   * JWT signature to ensure authenticity.
   *
   * @param idToken - ID token from Apple Sign In
   * @param clientId - Apple Services ID (client ID) for audience validation
   * @returns Verified user profile data (provider-specific type)
   * @throws {BadRequestException} When token is invalid, expired, or signature fails
   *
   * @example
   * ```typescript
   * try {
   *   const profile = await verifier.verifyAppleToken(idToken, 'com.yourapp.service');
   *   console.log(`Verified email: ${profile.email}`);
   * } catch (error) {
   *   console.error('Token verification failed:', error.message);
   * }
   * ```
   */
  verifyAppleToken?(idToken: string, clientId: string): Promise<unknown>;

  /**
   * Verify Facebook access token via Graph API
   *
   * Validates the access token by calling Facebook's debug_token endpoint,
   * which checks the token's validity and returns user information.
   *
   * @param accessToken - Access token from Facebook OAuth
   * @param appId - Facebook App ID
   * @param appSecret - Facebook App Secret (server-side only)
   * @returns Verified user profile data (provider-specific type)
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
  verifyFacebookToken?(accessToken: string, appId: string, appSecret: string): Promise<unknown>;

  /**
   * Verify Facebook ID token (OIDC / Limited Login) with JWT signature validation
   *
   * Facebook Limited Login (primarily iOS) returns an **ID token (JWT)** instead of an access token.
   * This method verifies the JWT signature using Facebook's OIDC JWKS and validates standard claims.
   *
   * Expected OIDC discovery values:
   * - Issuer: `https://www.facebook.com`
   * - JWKS URI: `https://www.facebook.com/.well-known/oauth/openid/jwks/`
   *
   * Security:
   * - Validates signature (RS256) using Facebook public keys (JWKS)
   * - Validates `iss` (issuer) and `aud` (audience) against the app ID
   * - Validates token freshness (`exp`, `iat`) via jwt library
   *
   * @param idToken - Facebook OIDC ID token (JWT)
   * @param appId - Facebook App ID for audience validation
   * @returns Verified user profile data (provider-specific type)
   *
   * @example
   * ```typescript
   * const profile = await verifier.verifyFacebookIdToken(idToken, '1234567890');
   * console.log(profile.sub);
   * ```
   */
  verifyFacebookIdToken?(idToken: string, appId: string): Promise<unknown>;

  /**
   * Clear cached clients and keys
   *
   * Useful for testing or when configuration changes
   *
   * @example
   * ```typescript
   * verifier.clearCache();
   * ```
   */
  clearCache?(): void;
}
