/**
 * Authentication Handler
 *
 * Validates JWT tokens and attaches user to request.
 *
 * **Platform-Agnostic:**
 * This handler operates purely on NAuthRequest interface.
 * Context is managed by the adapter, not this handler.
 */

import {
  NAuthConfig,
  NAuthException,
  AuthErrorCode,
  resolveDeliveryForRequest,
  getAccessTokenCookieName,
  NAuthLogger,
  ContextStorage,
  IClientInfo,
  AuthService,
} from '../index';
import { JwtService, SessionService } from '../internal';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

/**
 * AuthHandler
 *
 * Validates JWT tokens and populates user context.
 * Performs optional authentication by default (doesn't reject unauthenticated requests).
 */
export class AuthHandler {
  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
    private authService: AuthService,
    private config: NAuthConfig,
    private logger?: NAuthLogger,
  ) {}

  /**
   * Handle request - validate token and attach user
   *
   * Note: Context is managed by adapter. This handler assumes context is available.
   */
  public async handle(req: NAuthRequest, _res: NAuthResponse, next: () => Promise<void> | void): Promise<void> {
    try {
      // Skip if route is marked as public
      if (req.attributes.nauthPublic) {
        await next();
        return;
      }

      const token = this.extractToken(req);

      if (!token) {
        // No token - continue without authentication (optional auth)
        await next();
        return;
      }

      const validation = await this.jwtService.validateAccessToken(token);

      if (!validation.valid) {
        this.logger?.debug?.('Invalid token:', validation.error);
        await next();
        return;
      }

      // Validate session
      const sessionId = validation.payload!.sessionId;
      const userId = validation.payload!.sub; // Extract userId from token sub claim
      const session = await this.sessionService.findByIdLight(sessionId);

      if (!session) {
        this.logger?.debug?.('Session not found:', sessionId);
        await next();
        return;
      }

      const initialVersion = session.version;

      if (session.isRevoked) {
        this.logger?.warn?.('Session has been revoked:', sessionId);
        await next();
        return;
      }

      if (session.expiresAt < new Date()) {
        this.logger?.debug?.('Session has expired:', sessionId);
        await next();
        return;
      }

      // Load user via AuthService (service-first architecture)
      // AuthService.getUserForAuthContext handles:
      // - User lookup by sub
      // - Active status check
      // - Computing hasPasswordHash from passwordHash
      // - Removing sensitive fields (passwordHash, totpSecret, backupCodes, passwordHistory)
      const user = await this.authService.getUserForAuthContext(validation.payload!.sub);

      // Optimistic locking check - ensure session wasn't modified during request
      const revalidated = await this.sessionService.findByIdLight(sessionId);
      if (!revalidated || revalidated.version !== initialVersion || revalidated.isRevoked) {
        this.logger?.error?.('Session was modified during request - possible security breach');
        await next();
        return;
      }

      // Attach to request attributes
      req.attributes.user = user;
      req.attributes.token = validation.payload;

      // Store in ContextStorage for service access
      ContextStorage.set('CURRENT_USER', user);
      ContextStorage.set('JWT_PAYLOAD', validation.payload);
      ContextStorage.set('CURRENT_SESSION', sessionId);

      this.logger?.debug?.(`User ${user.sub} authenticated successfully`);

      // Update CLIENT_INFO with sessionId and userId
      this.updateClientInfoSessionId(sessionId);
      this.updateClientInfoUserId(userId);

      await next();
    } catch (error) {
      this.logger?.error?.(
        'Error in auth handler:',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined,
      );
      await next();
    }
  }

  /**
   * Extract token from request based on delivery mode
   */
  private extractToken(req: NAuthRequest): string | null {
    const method = this.config.tokenDelivery?.method || 'json';

    // Get token from header
    const authHeader = req.getHeader('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Get token from cookie
    const accessTokenCookieName = getAccessTokenCookieName(this.config);
    const cookieToken = req.cookies[accessTokenCookieName];

    // Check for route-level override
    const routeMode = req.attributes.nauthTokenDelivery;

    let effective: 'cookies' | 'json' = 'json';

    if (routeMode) {
      effective = routeMode;
    } else if (method === 'hybrid') {
      // Determine mode based on request characteristics
      effective = resolveDeliveryForRequest(req.raw, this.config.tokenDelivery?.hybridPolicy);
    } else {
      effective = method === 'cookies' ? 'cookies' : 'json';
    }

    if (effective === 'cookies') {
      // Cookie mode: Reject if Bearer header present
      if (headerToken && !cookieToken) {
        throw new NAuthException(
          AuthErrorCode.BEARER_NOT_ALLOWED,
          'Bearer tokens are not allowed in cookie-only path.',
        );
      }
      return cookieToken || null;
    }

    // JSON mode: Reject if cookie present
    if (cookieToken && !headerToken) {
      throw new NAuthException(AuthErrorCode.COOKIES_NOT_ALLOWED, 'Cookie tokens are not allowed in JSON-only path.');
    }
    return headerToken || null;
  }

  /**
   * Update CLIENT_INFO with session ID from token
   */
  private updateClientInfoSessionId(sessionId: string | number): void {
    const clientInfo = ContextStorage.get<IClientInfo>('CLIENT_INFO');
    if (clientInfo) {
      const sessionIdNumber = typeof sessionId === 'number' ? sessionId : parseInt(String(sessionId), 10);

      if (!isNaN(sessionIdNumber) && sessionIdNumber > 0) {
        clientInfo.sessionId = sessionIdNumber;
        ContextStorage.set('CLIENT_INFO', clientInfo);
      }
    }
  }

  /**
   * Update CLIENT_INFO with user ID from token
   */
  private updateClientInfoUserId(userId: string | number): void {
    const clientInfo = ContextStorage.get<IClientInfo>('CLIENT_INFO');
    if (clientInfo) {
      const userIdNumber = typeof userId === 'number' ? userId : parseInt(String(userId), 10);

      if (!isNaN(userIdNumber) && userIdNumber > 0) {
        clientInfo.userId = userIdNumber;
        ContextStorage.set('CLIENT_INFO', clientInfo);
      }
    }
  }
}
