import type { JWTPayload } from 'jose';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode, ITokenVerifierService } from '@nauth-toolkit/core';
import { VerifiedAppleTokenProfile } from './verified-token-profile.interface';

/**
 * jose module type (ESM-only dependency).
 *
 * IMPORTANT: `jose@6` is ESM-only. This package is compiled to CommonJS by default,
 * so we load jose via dynamic import to avoid `ERR_REQUIRE_ESM` at runtime.
 */
type JoseModule = typeof import('jose');

/**
 * Token Verifier Service for Apple OAuth (Platform-Agnostic)
 *
 * Handles secure verification of Apple ID tokens using JWKS public keys.
 * Uses cryptographic signature verification to ensure tokens are authentic.
 *
 * Security Features:
 * - Apple: Verifies JWT signature with Apple's JWKS public keys
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const verifier = new TokenVerifierService(config);
 * const profile = await verifier.verifyAppleToken(idToken, clientId);
 * console.log(profile.email); // Verified email from Apple
 * ```
 */
export class TokenVerifierService implements ITokenVerifierService {
  private appleJWKS: ReturnType<JoseModule['createRemoteJWKSet']> | null = null;
  private readonly logger: NAuthLogger;
  private readonly loadJose: () => Promise<JoseModule>;
  private joseModulePromise: Promise<JoseModule> | null = null;

  constructor(config: NAuthConfig, loadJose?: () => Promise<JoseModule>) {
    this.logger = config.logger as NAuthLogger;
    this.loadJose = loadJose ?? (() => import('jose') as Promise<JoseModule>);
  }

  private async getJose(): Promise<JoseModule> {
    if (!this.joseModulePromise) {
      this.joseModulePromise = this.loadJose();
    }
    return await this.joseModulePromise;
  }

  private async getAppleJWKS(): Promise<ReturnType<JoseModule['createRemoteJWKSet']>> {
    if (this.appleJWKS) return this.appleJWKS;
    const jose = await this.getJose();
    // Initialize Apple Remote JWKS (fetched and cached by jose)
    this.appleJWKS = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
    return this.appleJWKS;
  }

  /**
   * Verify Apple ID token with JWT signature validation
   *
   * Fetches Apple's public keys from their JWKS endpoint and verifies the
   * JWT signature to ensure authenticity.
   *
   * @param idToken - ID token from Apple Sign In
   * @param clientId - Apple Services ID (client ID) for audience validation
   * @returns Verified user profile data
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
  async verifyAppleToken(idToken: string, clientId: string): Promise<VerifiedAppleTokenProfile> {
    try {
      this.logger?.debug?.(`[TokenVerifier] Verifying Apple token`);

      const jose = await this.getJose();
      const appleJWKS = await this.getAppleJWKS();

      const { payload } = await jose.jwtVerify(idToken, appleJWKS, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
        clockTolerance: 300, // 5 minutes leeway
      });

      const p = payload as JWTPayload & {
        email?: string;
        email_verified?: boolean | string;
        is_private_email?: boolean;
      };

      this.logger?.log?.(`[TokenVerifier] Apple token verified (secure): ${p.email}`);

      return {
        sub: p.sub as string,
        email: p.email || '',
        email_verified: p.email_verified === 'true' || p.email_verified === true,
        is_private_email: p.is_private_email,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`[TokenVerifier] Apple token verification FAILED: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Apple token verification failed: ${errorMessage}`);
    }
  }
}
