import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  NAuthConfig,
  NAuthException,
  AuthErrorCode,
  resolveDeliveryForRequest,
  getAccessTokenCookieName,
  AuthService,
  ContextStorage,
  IUser,
} from '@nauth-toolkit/core';
import { JwtService, SessionService } from '@nauth-toolkit/core/internal';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TOKEN_DELIVERY_KEY, RouteDelivery } from '../decorators/token-delivery.decorator';
import { getNAuthContextStore } from './nauth-context.guard';

/**
 * Native Auth Guard (NO Passport dependency)
 *
 * Validates JWT tokens from Authorization header
 * and attaches user to request. Supports API clients.
 *
 * Security Features:
 * - JWT token validation with session-based revocation
 * - Session expiration checking
 * - Token reuse detection via session management
 * - Automatic session activity updates
 *
 * @example
 * // Works with Authorization header (API clients)
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
    @Inject('NAUTH_CONFIG')
    private readonly config: NAuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Extract token according to configured delivery mode
    const token = this.extractToken(context);

    if (!token) {
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'No token provided');
    }

    // Validate token
    const validation = await this.jwtService.validateAccessToken(token);

    if (!validation.valid) {
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, validation.error || 'Invalid token');
    }

    // ============================================================================
    // CRITICAL SECURITY FIX #3: Optimistic Locking for TOCTOU Prevention
    // ============================================================================

    // Check if session is revoked
    const sessionId = validation.payload!.sessionId;
    const session = await this.sessionService.findByIdLight(sessionId);

    if (!session) {
      throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found');
    }

    // Store initial version for optimistic locking check
    const initialVersion = session.version;

    if (session.isRevoked) {
      throw new NAuthException(AuthErrorCode.TOKEN_REUSE_DETECTED, 'Session has been revoked');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      throw new NAuthException(AuthErrorCode.SESSION_EXPIRED, 'Session has expired');
    }

    // ============================================================================
    // Load user via AuthService (service-first architecture)
    // ============================================================================
    // AuthService.getUserForAuthContext handles:
    // - User lookup by sub
    // - Active status check
    // - Computing hasPasswordHash from passwordHash
    // - Removing sensitive fields (passwordHash, totpSecret, backupCodes, passwordHistory)
    //
    // Wrap in context restoration to ensure ContextStorage.set() works
    const store = getNAuthContextStore(request);
    if (!store) {
      // No context available - should not happen with proper setup
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Context not initialized');
    }

    return ContextStorage.enterStore(store, async () => {
      const user = await this.authService.getUserForAuthContext(validation.payload!.sub);

      // ============================================================================
      // Session-scoped auth method propagation
      // ============================================================================
      // WHY: NestJS `@CurrentUser()` often backs `/profile` and other "who am I" endpoints.
      // Attaching session auth method allows frontends to show "Signed in with Google/Apple/etc."
      // even after refresh or cookie-based OAuth redirects.
      const sessionAuthMethod = (session as unknown as { authMethod?: string | null }).authMethod ?? null;
      (user as IUser & { sessionAuthMethod?: string | null }).sessionAuthMethod = sessionAuthMethod;

      // SECURITY CRITICAL: Re-check session hasn't been modified (optimistic locking)
      // Prevents TOCTOU (Time-of-Check-Time-of-Use) vulnerabilities
      const revalidated = await this.sessionService.findByIdLight(sessionId);
      if (!revalidated || revalidated.version !== initialVersion || revalidated.isRevoked) {
        throw new NAuthException(
          AuthErrorCode.TOKEN_INVALID,
          'Session was modified during request - possible security breach',
        );
      }

      // Attach user to request
      request.user = user;
      request.token = validation.payload;

      // Store in ContextStorage for service access
      ContextStorage.set('CURRENT_USER', user);
      ContextStorage.set('JWT_PAYLOAD', validation.payload);
      ContextStorage.set('CURRENT_SESSION', sessionId);

      // Update CLIENT_INFO with sessionId and userId
      const clientInfo = ContextStorage.get<{ sessionId?: number; userId?: number }>('CLIENT_INFO');
      if (clientInfo) {
        const sessionIdNumber = typeof sessionId === 'number' ? sessionId : parseInt(String(sessionId), 10);
        const userIdNumber = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
        if (!isNaN(sessionIdNumber) && sessionIdNumber > 0) {
          clientInfo.sessionId = sessionIdNumber;
        }
        if (!isNaN(userIdNumber) && userIdNumber > 0) {
          clientInfo.userId = userIdNumber;
        }
        ContextStorage.set('CLIENT_INFO', clientInfo);
      }

      return true;
    });
  }

  /**
   * Extract JWT token from request with strict source validation based on configuration
   *
   * Security rules:
   * - JSON mode: Only Authorization header (reject cookies if present)
   * - Cookies mode: Only httpOnly cookies (reject Bearer header if present)
   * - Hybrid mode: Cookies first (web), then Authorization header (mobile)
   *
   * @param request - HTTP request
   */
  private extractToken(context: ExecutionContext): string | null {
    const request = context.switchToHttp().getRequest();
    const cfg = this.config.tokenDelivery;
    const method = cfg?.method || 'json';

    const authHeader: string | undefined = request.headers?.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const accessTokenCookieName = getAccessTokenCookieName(this.config);
    const cookieToken: string | undefined = request.cookies?.[accessTokenCookieName];

    // Resolve per-request delivery. Route override > hybrid policy > method fallback
    const routeMode = this.reflector.get<RouteDelivery>(TOKEN_DELIVERY_KEY, context.getHandler());

    let effective: 'cookies' | 'json' = 'json';
    if (routeMode) {
      effective = routeMode;
    } else if (method === 'hybrid') {
      effective = resolveDeliveryForRequest(request, cfg?.hybridPolicy);
    } else if (method === 'cookies') {
      effective = 'cookies';
    } else {
      effective = 'json';
    }

    if (effective === 'cookies') {
      if (headerToken && !cookieToken) {
        throw new NAuthException(
          AuthErrorCode.BEARER_NOT_ALLOWED,
          'Bearer tokens are not allowed in cookie-only path.',
        );
      }
      return cookieToken || null;
    }

    // effective === 'json'
    if (cookieToken && !headerToken) {
      throw new NAuthException(AuthErrorCode.COOKIES_NOT_ALLOWED, 'Cookie tokens are not allowed in JSON-only path.');
    }
    return headerToken || null;
  }
}
