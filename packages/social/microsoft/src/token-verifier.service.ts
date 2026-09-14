import type { JWTPayload } from 'jose';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode, ITokenVerifierService } from '@nauth-toolkit/core';
import { VerifiedMicrosoftTokenProfile } from './verified-token-profile.interface';
import { expectedIssuer, isPersonalAccountTenant, isTenantGuid, jwksEndpoint } from './entra-tenant';

/**
 * jose module type (ESM-only dependency).
 *
 * IMPORTANT: `jose@6` is ESM-only. This package is compiled to CommonJS by default,
 * so we load jose via dynamic import to avoid `ERR_REQUIRE_ESM` at runtime.
 */
type JoseModule = typeof import('jose');

/**
 * Claims this package reads off a verified Microsoft ID token.
 */
type MicrosoftIdTokenPayload = JWTPayload & {
  oid?: string;
  tid?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  xms_edov?: boolean | string;
  roles?: string[];
  groups?: string[];
  _claim_names?: Record<string, string>;
  _claim_sources?: Record<string, unknown>;
};

/**
 * Options narrowing which directories a token may come from.
 */
export interface VerifyMicrosoftTokenOptions {
  /**
   * Configured tenant. When a GUID, the token's `tid` must match it.
   */
  tenant?: string;

  /**
   * Additional directory ids to accept, for multi-tenant deployments that still want a
   * closed list.
   */
  allowedTenants?: string[];
}

/**
 * Token Verifier Service for Microsoft Entra ID (Platform-Agnostic)
 *
 * Verifies Microsoft ID tokens using Entra's JWKS public keys and validates the claims
 * this provider's identity and access decisions rest on.
 *
 * Security properties:
 * - RS256 signature verified against Entra's published keys
 * - `aud` checked against the configured application's client id(s)
 * - `iss` bound to the token's own `tid`, so a valid signature cannot stand in for a
 *   statement about *which* directory issued the token
 * - `tid` checked against the pinned tenant or the allowlist, when either is configured
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const verifier = new TokenVerifierService(config);
 * const profile = await verifier.verifyMicrosoftToken(idToken, clientId, { tenant });
 * console.log(profile.oid, profile.tid);
 * ```
 */
export class TokenVerifierService implements ITokenVerifierService {
  private jwksByEndpoint = new Map<string, ReturnType<JoseModule['createRemoteJWKSet']>>();
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

  private async getJWKS(tenant: string): Promise<ReturnType<JoseModule['createRemoteJWKSet']>> {
    const endpoint = jwksEndpoint(tenant);
    const cached = this.jwksByEndpoint.get(endpoint);
    if (cached) return cached;

    const jose = await this.getJose();
    const jwks = jose.createRemoteJWKSet(new URL(endpoint));
    this.jwksByEndpoint.set(endpoint, jwks);
    return jwks;
  }

  /**
   * Verify a Microsoft ID token and extract the claims this provider depends on.
   *
   * @param idToken - ID token from the Microsoft identity platform
   * @param clientId - Application client id(s) for audience validation
   * @param options - Tenant constraints to enforce
   * @returns Verified profile, including tenant context and access-gate claims
   * @throws {NAuthException} When the token is invalid, expired, or from a disallowed directory
   *
   * @example
   * ```typescript
   * const profile = await verifier.verifyMicrosoftToken(idToken, clientId, {
   *   tenant: '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f',
   * });
   * ```
   */
  async verifyMicrosoftToken(
    idToken: string,
    clientId: string | string[],
    options: VerifyMicrosoftTokenOptions = {},
  ): Promise<VerifiedMicrosoftTokenProfile> {
    const tenant = options.tenant || 'common';

    try {
      const jose = await this.getJose();
      const jwks = await this.getJWKS(tenant);

      const clientIds = Array.isArray(clientId) ? clientId : [clientId];
      this.logger?.debug?.(`[TokenVerifier] Verifying Microsoft token with ${clientIds.length} accepted client ID(s)`);

      // The issuer depends on the token's own `tid`, so it cannot be asserted up front
      // here — it is checked immediately after the signature is confirmed.
      let verified: { payload: JWTPayload } | undefined;
      let lastError: unknown;
      for (const aud of clientIds) {
        try {
          verified = await jose.jwtVerify(idToken, jwks, {
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

      const payload = verified.payload as MicrosoftIdTokenPayload;

      if (!payload.sub || !payload.oid || !payload.tid) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          'Missing required fields in Microsoft token (sub, oid or tid)',
        );
      }

      this.assertIssuerMatchesTenant(payload.iss, payload.tid);
      this.assertTenantAllowed(payload.tid, options);

      const groupNames = payload._claim_names;
      const hasGroupsOverage = typeof groupNames === 'object' && groupNames !== null && 'groups' in groupNames;

      const profile: VerifiedMicrosoftTokenProfile = {
        sub: payload.sub,
        oid: payload.oid,
        tid: payload.tid,
        email: payload.email,
        // Entra emits xms_edov as a boolean, but some pipelines stringify optional claims.
        emailDomainOwnerVerified: payload.xms_edov === true || payload.xms_edov === 'true',
        isPersonalAccount: isPersonalAccountTenant(payload.tid),
        preferredUsername: payload.preferred_username,
        name: payload.name,
        givenName: payload.given_name,
        familyName: payload.family_name,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        groups: Array.isArray(payload.groups) ? payload.groups : [],
        hasGroupsOverage,
        raw: payload as unknown as Record<string, unknown>,
      };

      this.logger?.log?.(`[TokenVerifier] Microsoft token verified (secure): oid=${profile.oid} tid=${profile.tid}`);

      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`[TokenVerifier] Microsoft token verification FAILED: ${errorMessage}`);
      if (error instanceof NAuthException) {
        throw error;
      }
      throw new NAuthException(
        AuthErrorCode.SOCIAL_TOKEN_INVALID,
        `Microsoft token verification failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Bind the issuer to the token's own tenant id.
   *
   * Without this, a token minted by any directory in the world satisfies a `common`
   * deployment's signature check, and `tid` — which the access gate trusts — becomes
   * attacker-influenced.
   */
  private assertIssuerMatchesTenant(iss: string | undefined, tid: string): void {
    const expected = expectedIssuer(tid);
    if (iss !== expected) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_TOKEN_INVALID,
        `Microsoft token issuer '${iss ?? 'missing'}' does not match its tenant claim`,
      );
    }
  }

  /**
   * Enforce the pinned tenant and the optional allowlist.
   */
  private assertTenantAllowed(tid: string, options: VerifyMicrosoftTokenOptions): void {
    const allowed = new Set<string>();

    if (options.tenant && isTenantGuid(options.tenant)) {
      allowed.add(options.tenant.toLowerCase());
    }
    for (const extra of options.allowedTenants ?? []) {
      allowed.add(extra.toLowerCase());
    }

    if (allowed.size === 0) return;

    if (!allowed.has(tid.toLowerCase())) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_ACCESS_DENIED,
        'This Microsoft directory is not permitted to sign in to this application',
      );
    }
  }

  /**
   * Clear cached JWKS handles.
   *
   * Useful for testing or when configuration changes.
   */
  clearCache(): void {
    this.jwksByEndpoint.clear();
    this.joseModulePromise = null;
  }
}
