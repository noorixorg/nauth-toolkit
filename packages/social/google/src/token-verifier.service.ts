import type { JWTPayload } from 'jose';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode, ITokenVerifierService } from '@nauth-toolkit/core';
import { VerifiedGoogleTokenProfile } from './verified-token-profile.interface';

/**
 * jose module type (ESM-only dependency).
 *
 * IMPORTANT: `jose@6` is ESM-only. This package is compiled to CommonJS by default,
 * so we load jose via dynamic import to avoid `ERR_REQUIRE_ESM` at runtime.
 */
type JoseModule = typeof import('jose');

/**
 * Token Verifier Service for Google OAuth (Platform-Agnostic)
 *
 * Handles secure verification of Google ID tokens using JWKS public keys.
 * Uses cryptographic signature verification to ensure tokens are authentic.
 *
 * Security Features:
 * - Google: Verifies JWT signature with Google's JWKS public keys using jwks-rsa
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const verifier = new TokenVerifierService(config);
 * const profile = await verifier.verifyGoogleToken(idToken, clientId);
 * console.log(profile.email); // Verified email from Google
 * ```
 */
export class TokenVerifierService implements ITokenVerifierService {
  private googleJWKS: ReturnType<JoseModule['createRemoteJWKSet']> | null = null;
  private readonly logger: NAuthLogger;
  private readonly loadJose: () => Promise<JoseModule>;
  private joseModulePromise: Promise<JoseModule> | null = null;

  constructor(config: NAuthConfig, loadJose?: () => Promise<JoseModule>) {
    this.logger = config.logger as NAuthLogger;
    // Use eval to prevent TypeScript from converting import() to require()
    // This is necessary because jose@6 is ESM-only and cannot be required()
    // TypeScript with module:"commonjs" converts import() to __importStar(require())
    // Using eval preserves the dynamic import() at runtime
    this.loadJose = loadJose ?? (() => (0, eval)("import('jose')") as Promise<JoseModule>);
  }

  private async getJose(): Promise<JoseModule> {
    if (!this.joseModulePromise) {
      this.joseModulePromise = this.loadJose();
    }
    return await this.joseModulePromise;
  }

  private async getGoogleJWKS(): Promise<ReturnType<JoseModule['createRemoteJWKSet']>> {
    if (this.googleJWKS) return this.googleJWKS;
    const jose = await this.getJose();
    // Initialize Google Remote JWKS (fetched and cached by jose)
    this.googleJWKS = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    return this.googleJWKS;
  }

  /**
   * Verify Google ID token with JWT signature validation
   *
   * Fetches Google's public keys from their JWKS endpoint and verifies the
   * JWT signature to ensure authenticity.
   *
   * @param idToken - ID token from Google OAuth
   * @param clientId - Google OAuth client ID for audience validation (supports multiple IDs)
   * @returns Verified user profile data
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
  async verifyGoogleToken(idToken: string, clientId: string | string[]): Promise<VerifiedGoogleTokenProfile> {
    try {
      const jose = await this.getJose();
      const googleJWKS = await this.getGoogleJWKS();

      // Support multiple client IDs (web, iOS, Android)
      const clientIds = Array.isArray(clientId) ? clientId : [clientId];
      this.logger?.debug?.(`[TokenVerifier] Verifying Google token with ${clientIds.length} accepted client ID(s)`);

      // Verify token with jose using Google's JWKS; try each audience if multiple provided
      let verified: { payload: JWTPayload } | undefined;
      let lastError: unknown;
      for (const aud of clientIds) {
        try {
          verified = await jose.jwtVerify(idToken, googleJWKS, {
            issuer: 'https://accounts.google.com',
            audience: aud,
            clockTolerance: 300, // 5 minutes leeway
          });
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!verified) {
        const msg = lastError instanceof Error ? lastError.message : 'Unknown error';
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `JWT verification failed: ${msg}`);
      }

      const payload = verified.payload as JWTPayload & {
        email?: string;
        email_verified?: boolean;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      if (!payload.email_verified) {
        throw new NAuthException(AuthErrorCode.SOCIAL_EMAIL_REQUIRED, 'Google email not verified');
      }

      // Validate required fields (sub and email are required by JWT spec and Google tokens)
      if (!payload.sub || !payload.email) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          'Missing required fields in Google token (sub or email)',
        );
      }

      this.logger?.log?.(`[TokenVerifier] Google token verified (secure): ${payload.email}`);

      return {
        sub: payload.sub as string,
        email: payload.email as string,
        email_verified: payload.email_verified as boolean,
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`[TokenVerifier] Google token verification FAILED: ${errorMessage}`);
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, `Google token verification failed: ${errorMessage}`);
    }
  }
}
