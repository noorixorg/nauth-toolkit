import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import {
  NAuthConfig,
  NAuthException,
  AuthErrorCode,
  resolveDeliveryForRequest,
  BaseUser,
  getAccessTokenCookieName,
} from '@nauth-toolkit/core';
import { JwtService, SessionService } from '@nauth-toolkit/core/internal';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TOKEN_DELIVERY_KEY, RouteDelivery } from '../decorators/token-delivery.decorator';

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
    @Inject('UserRepository')
    private readonly userRepository: Repository<BaseUser>,
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

    // Load user by sub (external identifier from JWT payload)
    // Include all non-sensitive fields needed by endpoints (profile, MFA status, etc.)
    // Excludes: passwordHash, passwordHistory, totpSecret, backupCodes (sensitive)
    //  TODO: SHIT Work. NEEDS TO BE FIXED.
    const user = await this.userRepository.findOne({
      select: [
        'id',
        'sub',
        'username',
        'firstName',
        'lastName',
        'email',
        'phone',
        'isEmailVerified',
        'isPhoneVerified',
        'isActive',
        'mustChangePassword',
        'isLocked',
        'lockReason',
        'lockedAt',
        'lockedUntil',
        'failedLoginAttempts',
        'lastFailedLoginAt',
        'lastLoginAt',
        'lastLoginIp',
        'hasSocialAuth',
        'socialProviders',
        'mfaEnabled',
        'mfaMethods',
        'preferredMfaMethod',
        'mfaExempt',
        'mfaExemptReason',
        'mfaExemptGrantedAt',
        'metadata',
        'createdAt',
        'updatedAt',
      ] as Array<keyof typeof user>,
      where: { sub: validation.payload!.sub },
    });

    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found');
    }

    if (!user.isActive) {
      throw new NAuthException(AuthErrorCode.ACCOUNT_INACTIVE, 'Account is not active');
    }

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

    return true;
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
