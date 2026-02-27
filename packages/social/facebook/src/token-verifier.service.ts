import type { JWTPayload } from 'jose';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode, ITokenVerifierService } from '@nauth-toolkit/core';
import { VerifiedFacebookTokenProfile } from './verified-token-profile.interface';

/**
 * jose module type (ESM-only dependency).
 *
 * IMPORTANT: `jose@6` is ESM-only. This package is compiled to CommonJS by default,
 * so we load jose via dynamic import to avoid `ERR_REQUIRE_ESM` at runtime.
 */
type JoseModule = typeof import('jose');

/**
 * Facebook debug token response
 */
interface FacebookDebugTokenResponse {
  data?: {
    is_valid?: boolean;
    app_id?: string;
    user_id?: string;
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
  picture?: string | { data?: { url?: string } };
}

/**
 * Token Verifier Service for Facebook OAuth (Platform-Agnostic)
 *
 * Handles secure verification of Facebook access tokens via Graph API.
 * Also supports verifying Facebook OIDC ID tokens (Limited Login) via JWKS.
 * Validates tokens by calling Facebook's debug_token endpoint.
 *
 * Security Features:
 * - Facebook: Validates access tokens via Facebook Graph API
 * - Facebook (Limited Login): Validates ID tokens via OIDC JWKS (RS256)
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
  private facebookJWKS: ReturnType<JoseModule['createRemoteJWKSet']> | null = null;
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

  private async getFacebookJWKS(): Promise<ReturnType<JoseModule['createRemoteJWKSet']>> {
    if (this.facebookJWKS) return this.facebookJWKS;
    const jose = await this.getJose();
    // Facebook OIDC JWKS (used by Limited Login / ID tokens).
    // Source of truth: https://www.facebook.com/.well-known/openid-configuration
    this.facebookJWKS = jose.createRemoteJWKSet(new URL('https://www.facebook.com/.well-known/oauth/openid/jwks/'));
    return this.facebookJWKS;
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

      const debugData = (await debugResponse.json()) as FacebookDebugTokenResponse;

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

      const profile = (await profileResponse.json()) as FacebookUserProfileResponse;

      this.logger?.log?.(`[TokenVerifier] Facebook token verified (secure): ${profile.email || profile.id}`);

      // Handle picture field - it can be a string or an object with data.url
      let picture: { data: { url: string } } | undefined;
      if (typeof profile.picture === 'string') {
        // If picture is a string URL, wrap it in the expected structure
        picture = { data: { url: profile.picture } };
      } else if (profile.picture?.data?.url) {
        // If picture is an object with data.url, use it as-is
        picture = { data: { url: profile.picture.data.url } };
      }

      return {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        picture,
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

  /**
   * Verify Facebook ID token (OIDC / Limited Login) with JWT signature validation
   *
   * Facebook Limited Login (primarily iOS) returns an ID token (JWT) that must be
   * verified using Facebook's OIDC JWKS (RS256).
   *
   * ⚠️ WARNING: If the client uses `nonce`, the backend cannot validate it unless the
   * client also sends the original nonce. This method still provides strong security by
   * validating signature, issuer, audience, and expiry.
   *
   * @param idToken - Facebook ID token (JWT)
   * @param appId - Facebook App ID for audience validation
   * @returns Minimal verified profile payload (provider-specific)
   * @throws {NAuthException} SOCIAL_TOKEN_INVALID when token is invalid
   */
  async verifyFacebookIdToken(
    idToken: string,
    appId: string,
  ): Promise<{
    sub: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  }> {
    try {
      const jose = await this.getJose();
      const jwks = await this.getFacebookJWKS();
      this.logger?.debug?.('[TokenVerifier] Verifying Facebook ID token (OIDC / Limited Login)');

      const { payload } = await jose.jwtVerify(idToken, jwks, {
        issuer: 'https://www.facebook.com',
        audience: appId,
        clockTolerance: 300, // 5 minutes leeway
      });

      const p = payload as JWTPayload & {
        sub?: string;
        email?: string;
        name?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      if (!p.sub) {
        throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Missing required fields in Facebook token (sub)');
      }

      this.logger?.log?.(`[TokenVerifier] Facebook ID token verified (secure): ${p.email || p.sub}`);
      return {
        sub: p.sub,
        email: p.email,
        name: p.name,
        given_name: p.given_name,
        family_name: p.family_name,
        picture: p.picture,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`[TokenVerifier] Facebook ID token verification FAILED: ${errorMessage}`);
      throw new NAuthException(
        AuthErrorCode.SOCIAL_TOKEN_INVALID,
        `Facebook ID token verification failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Clear cached clients and keys
   */
  clearCache(): void {
    this.facebookJWKS = null;
    this.joseModulePromise = null;
  }
}
