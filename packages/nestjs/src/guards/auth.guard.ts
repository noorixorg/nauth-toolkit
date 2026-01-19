import { Injectable, CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
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
  protected readonly nlogger = new Logger(AuthGuard.name);

  // ============================================================================
  // Dependency Injection (property-based)
  // ============================================================================
  // WHY:
  // - Consumers often extend AuthGuard to add custom behavior
  // - Constructor injection forces subclasses to repeat all dependencies and pass them to `super(...)`
  // - Property injection keeps the base constructor parameterless while still using NestJS DI
  @Inject(Reflector)
  private readonly _reflector!: Reflector;

  @Inject(JwtService)
  private readonly _jwtService!: JwtService;

  @Inject(SessionService)
  private readonly _sessionService!: SessionService;

  @Inject(AuthService)
  private readonly _authService!: AuthService;

  @Inject('NAUTH_CONFIG')
  private readonly config!: NAuthConfig;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this._reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Public routes can optionally accept authentication:
    // - If a valid token is present, we attach user/context so `@CurrentUser()` works.
    // - If token is missing/invalid/expired (or session is revoked/expired), we do NOT throw.
    //   This keeps public endpoints resilient while still enabling "optional auth" patterns.
    await this.tryAttachAuthContext(context, { strict: !isPublic });

    // if error is not thrown then it's valid tokens or public route
    return true;
  }

  /**
   * Attempt to authenticate the request and attach `request.user` + ContextStorage.
   *
   * When `strict` is true: behaves like a traditional auth guard (throws on failures).
   * When `strict` is false: best-effort only; failures are treated as "unauthenticated"
   * and the request is allowed to proceed without a user context.
   *
   * @param context - Nest execution context
   * @param options - Behavior options
   */
  private async tryAttachAuthContext(context: ExecutionContext, options: { strict: boolean }): Promise<void> {
    const request = context.switchToHttp().getRequest();

    // ============================================================================
    // Token extraction (delivery-mode aware)
    // ============================================================================
    let token: string | null = null;
    try {
      token = this.extractToken(context);
    } catch (error) {
      if (options.strict) {
        throw error;
      }
      return; // Optional auth: treat as unauthenticated
    }

    if (!token) {
      if (options.strict) {
        throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'No token provided');
      }
      return;
    }

    // Validate token
    const validation = await this._jwtService.validateAccessToken(token);
    if (!validation.valid) {
      if (options.strict) {
        throw new NAuthException(AuthErrorCode.TOKEN_INVALID, validation.error || 'Invalid token');
      }
      return;
    }

    // ============================================================================
    // Session checks (revocation + expiry)
    // ============================================================================
    // WHY:
    // - Even if the JWT is cryptographically valid, we must ensure the session
    //   hasn't been revoked/expired server-side.
    const sessionId = validation.payload!.sessionId;
    const session = await this._sessionService.findByIdLight(sessionId);

    if (!session) {
      if (options.strict) {
        throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found');
      }
      return;
    }

    // Store initial version for optimistic locking check (TOCTOU prevention)
    const initialVersion = session.version;

    if (session.isRevoked) {
      if (options.strict) {
        // Session revocation can happen for many legitimate reasons (logout, logout-all, admin revoke).
        // Using TOKEN_REUSE_DETECTED here is misleading and can cause clients to overreact (e.g., global signout).
        throw new NAuthException(AuthErrorCode.SESSION_NOT_FOUND, 'Session has been revoked');
      }
      return;
    }

    if (session.expiresAt < new Date()) {
      if (options.strict) {
        throw new NAuthException(AuthErrorCode.SESSION_EXPIRED, 'Session has expired');
      }
      return;
    }

    // ============================================================================
    // Load user via AuthService (service-first architecture)
    // ============================================================================
    // Wrap in context restoration to ensure ContextStorage.set() works.
    const store = getNAuthContextStore(request);
    if (!store) {
      if (options.strict) {
        // No context available - should not happen with proper setup
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Context not initialized');
      }

      // Optional auth: still provide `@CurrentUser()` support by attaching user to the request,
      // but skip ContextStorage because the request isn't context-initialized.
      try {
        const user = await this._authService.getUserForAuthContext(validation.payload!.sub);
        request.user = user;
        request.token = validation.payload;
      } catch {
        // Optional auth must not block public endpoints
      }
      return;
    }

    try {
      await ContextStorage.enterStore(store, async () => {
        const user = await this._authService.getUserForAuthContext(validation.payload!.sub);

        // ============================================================================
        // Session-scoped auth method propagation
        // ============================================================================
        const sessionAuthMethod = (session as unknown as { authMethod?: string | null }).authMethod ?? null;
        (user as IUser & { sessionAuthMethod?: string | null }).sessionAuthMethod = sessionAuthMethod;

        // SECURITY CRITICAL: Re-check session hasn't been modified (optimistic locking)
        const revalidated = await this._sessionService.findByIdLight(sessionId);
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

        // Update CLIENT_INFO with sessionId, userId, and sub
        const clientInfo = ContextStorage.get<{ sessionId?: number; userId?: number; sub?: string }>('CLIENT_INFO');
        if (clientInfo) {
          const sessionIdNumber = typeof sessionId === 'number' ? sessionId : parseInt(String(sessionId), 10);
          const userIdNumber = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
          if (!isNaN(sessionIdNumber) && sessionIdNumber > 0) {
            clientInfo.sessionId = sessionIdNumber;
          }
          if (!isNaN(userIdNumber) && userIdNumber > 0) {
            clientInfo.userId = userIdNumber;
          }
          if (user.sub) {
            clientInfo.sub = user.sub;
          }
          ContextStorage.set('CLIENT_INFO', clientInfo);
        }
      });
    } catch (error) {
      if (options.strict) {
        throw error;
      }
      // Optional auth must not block public endpoints; treat as unauthenticated.
    }
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

    // Handle case-insensitive header lookup (Express uses lowercase, Fastify may use original case)
    const authHeader: string | undefined =
      (request.headers?.authorization as string | undefined) || (request.headers?.Authorization as string | undefined);
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const accessTokenCookieName = getAccessTokenCookieName(this.config);
    const cookieToken: string | undefined = request.cookies?.[accessTokenCookieName];

    // Resolve per-request delivery. Route override > hybrid policy > method fallback
    const routeMode = this._reflector.get<RouteDelivery>(TOKEN_DELIVERY_KEY, context.getHandler());

    let effective: 'cookies' | 'json' = 'json';

    if (routeMode) {
      effective = routeMode;
    } else if (method === 'hybrid') {
      // ============================================================================
      // HYBRID MODE: Prefer the credential that is actually present
      // ============================================================================
      // WHY:
      // - Browser-based SPAs can legitimately use JSON token delivery (localStorage + Bearer).
      // - `Origin` is always present in browsers, so origin-based classification can incorrectly
      //   force 'cookies' and reject Bearer tokens, even when the client is configured for JSON.
      //
      // SECURITY:
      // - We do NOT "leak" tokens to browsers; we only accept Bearer when the client sends it.
      // - When both cookie and bearer are present, we fall back to hybridPolicy/origin resolution.
      // Match AuthGuard logic: if client sends Bearer token, treat as JSON mode
      // This prevents CSRF enforcement for mobile apps using Bearer tokens
      // Handle case-insensitive header lookup (Express uses lowercase, Fastify may use original case)

      if (headerToken && !cookieToken) {
        effective = 'json';
      } else if (cookieToken && !headerToken) {
        effective = 'cookies';
      } else {
        // Both present, neither present, or edge case - fall back to origin-based
        effective = resolveDeliveryForRequest(request, cfg?.hybridPolicy);
      }
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
