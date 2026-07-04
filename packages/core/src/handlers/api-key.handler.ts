/**
 * API Key Handler
 *
 * Authenticates requests that carry an API key header, resolving the key to its
 * owning user. Runs before the JWT auth handler in the middleware pipeline.
 *
 * **Single auth mechanism per request:**
 * When the configured API key header is present it is the ONLY credential considered.
 * A valid key authenticates as the owning user; on a protected route an invalid/expired/revoked
 * key (or one used from a disallowed IP) results in access denied — the request never falls back
 * to cookie/bearer authentication.
 *
 * **Optional identification on public routes:**
 * On a `@Public()` route the key is best-effort (mirrors the JWT optional-auth path): a valid key
 * still attaches the owning user so downstream handlers know who is calling, but a missing/invalid
 * key is tolerated and the request proceeds unauthenticated rather than failing.
 *
 * **Platform-Agnostic:**
 * Operates purely on the NAuthRequest interface. Route opt-in enforcement (which endpoints
 * accept API keys) is handled separately by the adapter (guard/`requireAuth` helper).
 */

import { NAuthConfig, NAuthLogger, ContextStorage, IClientInfo, AuthService } from '../index';
import { ApiKeyService } from '../services/api-key.service';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

/**
 * AuthHandler counterpart for API key authentication.
 */
export class ApiKeyHandler {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly authService: AuthService,
    private readonly config: NAuthConfig,
    private readonly logger?: NAuthLogger,
  ) {}

  /**
   * Handle request - validate API key (if present) and attach user.
   *
   * @throws {NAuthException} On an invalid/expired key or disallowed IP (access denied).
   */
  public async handle(req: NAuthRequest, _res: NAuthResponse, next: () => Promise<void> | void): Promise<void> {
    // Feature disabled - do nothing (JWT auth handler will run).
    if (!this.config.apiKeys?.enabled) {
      await next();
      return;
    }

    const headerName = this.config.apiKeys.header || 'X-API-Key';
    const rawKey = req.getHeader(headerName);

    if (!rawKey) {
      // No API key present - let the JWT auth handler attempt cookie/bearer auth.
      await next();
      return;
    }

    // Public routes offer OPTIONAL identification (mirrors the JWT optional-auth path): a valid key
    // still attaches the user so downstream handlers see who is calling, but a missing/invalid key
    // must never make a @Public() route fail. On protected routes the key is strict.
    const isPublic = req.attributes.nauthPublic === true;

    // Presence of the header means "use API key auth". On protected routes, failures throw (access
    // denied) and we intentionally do NOT swallow the error to fall back to other credentials. On
    // public routes, an invalid key is ignored and the request proceeds unauthenticated.
    const callerIp = this.resolveCallerIp(req);
    let result: { keyId: string; sub: string };
    try {
      result = await this.apiKeyService.validateKey(rawKey, callerIp);
    } catch (error) {
      if (!isPublic) {
        throw error; // protected route: invalid key = access denied, no fallback
      }
      await next(); // public route: optional identification — ignore an invalid key
      return;
    }

    // Load the owning user in the same shape as the JWT path (reuses the shared loader).
    const user = await this.authService.getUserForAuthContext(result.sub);
    (user as { sessionAuthMethod?: string | null }).sessionAuthMethod = 'api-key';

    req.attributes.user = user;
    req.attributes.nauthApiKeyAuth = true;
    req.attributes.nauthApiKeyId = result.keyId;

    ContextStorage.set('CURRENT_USER', user);

    this.updateClientInfoUser(user.id, user.sub);

    this.logger?.debug?.(`User ${user.sub} authenticated via API key ${result.keyId}`);

    await next();
  }

  /**
   * Resolve the caller IP for IP-allowlist enforcement and usage tracking.
   * Prefers the client info already captured on context, falling back to req.ip.
   */
  private resolveCallerIp(req: NAuthRequest): string | null {
    const clientInfo = ContextStorage.get<IClientInfo>('CLIENT_INFO');
    return clientInfo?.ipAddress || req.ip || null;
  }

  /**
   * Update CLIENT_INFO with the resolved user id (internal) and sub (UUID).
   */
  private updateClientInfoUser(userId: number, sub: string): void {
    const clientInfo = ContextStorage.get<IClientInfo>('CLIENT_INFO');
    if (!clientInfo) {
      return;
    }
    if (typeof userId === 'number' && userId > 0) {
      clientInfo.userId = userId;
    }
    if (sub) {
      clientInfo.sub = sub;
    }
    ContextStorage.set('CLIENT_INFO', clientInfo);
  }
}
