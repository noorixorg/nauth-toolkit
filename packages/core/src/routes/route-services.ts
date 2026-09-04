/**
 * Service container for shipped routes
 *
 * A narrow structural view of what route handlers need, rather than `NAuthInstance`.
 * That is what lets one manifest be driven either by an instance built through
 * `NAuth.create()` (Express, Fastify) or by dependency injection (NestJS), without the
 * manifest knowing which.
 *
 * @packageDocumentation
 */

import { AuthService } from '../services/auth.service';
import { AdminAuthService } from '../services/admin-auth.service';
import { MFAService } from '../services/mfa.service';
import { SocialAuthService } from '../services/social-auth.service';
import { ApiKeyService } from '../services/api-key.service';
import { AuthAuditService } from '../services/auth-audit.service';
import { SocialRedirectHandler } from '../services/social-redirect.handler';

/**
 * A social provider capable of verifying a native SDK token.
 *
 * Structural rather than the concrete provider interface, because the manifest only
 * ever calls this one method.
 */
export interface SocialTokenVerifier {
  /**
   * Verify a token issued to a native client by the provider's own SDK.
   *
   * @param dto - Provider-specific verification payload
   * @returns The authenticated session, shaped like any other auth response
   */
  verifyToken(dto: unknown): Promise<unknown>;
}

/**
 * What the shipped routes depend on.
 *
 * Required members are always present on a bootstrapped instance. Optional ones follow
 * the toolkit's feature flags — a route that needs one declares `requires`, and the
 * mount refuses rather than failing at request time.
 */
export interface NAuthRouteServices {
  readonly authService: AuthService;
  readonly adminAuthService: AdminAuthService;
  readonly mfaService?: MFAService;
  readonly socialAuthService?: SocialAuthService;
  readonly auditService?: AuthAuditService;
  readonly apiKeyService?: ApiKeyService;
  readonly socialRedirect?: SocialRedirectHandler;
  /** Native token verification, keyed by provider name (`google`, `apple`, …). */
  readonly socialProviders?: Readonly<Record<string, SocialTokenVerifier>>;
}

/**
 * Project the route service container out of anything instance-shaped.
 *
 * `NAuthInstance` already spreads the service container, so this is a projection rather
 * than a construction — it exists to keep the mounts from passing the whole instance,
 * and to give NestJS a single shape to build by hand.
 *
 * @param source - A bootstrapped NAuth instance, or any object carrying the services
 * @returns The narrow container the manifest handlers expect
 */
export function pickRouteServices(source: NAuthRouteServices): NAuthRouteServices {
  return {
    authService: source.authService,
    adminAuthService: source.adminAuthService,
    mfaService: source.mfaService,
    socialAuthService: source.socialAuthService,
    auditService: source.auditService,
    apiKeyService: source.apiKeyService,
    socialRedirect: source.socialRedirect,
    socialProviders: source.socialProviders,
  };
}
