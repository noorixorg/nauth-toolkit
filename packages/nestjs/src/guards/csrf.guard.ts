import { Injectable, CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  NAuthConfig,
  NAuthException,
  AuthErrorCode,
  resolveDeliveryForRequest,
  getAccessTokenCookieName,
} from '@nauth-toolkit/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TOKEN_DELIVERY_KEY, RouteDelivery } from '../decorators/token-delivery.decorator';
import { CsrfService } from '../services/csrf.service';

/**
 * CSRF Guard
 *
 * Validates CSRF tokens for state-changing requests when using cookie-based token delivery.
 * CSRF protection prevents Cross-Site Request Forgery attacks.
 *
 * Security Rules:
 * - Only enforces for cookie-based token delivery (cookies or hybrid with web origins)
 * - Skips safe HTTP methods (GET, HEAD, OPTIONS)
 * - Skips excluded paths from configuration
 * - Validates CSRF token from header matches cookie value
 *
 * @example
 * ```typescript
 * // Applied globally via AuthModule when tokenDelivery.method === 'cookies' or 'hybrid'
 * // Or applied per-route:
 * @UseGuards(CsrfGuard)
 * @Post('sensitive-action')
 * async sensitiveAction() { ... }
 * ```
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  constructor(
    @Inject('NAUTH_CONFIG')
    private readonly config: NAuthConfig,
    private readonly csrfService: CsrfService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Only operate in HTTP context
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const csrfConfig = this.config.security?.csrf;

    // Skip if CSRF config is not provided
    if (!csrfConfig) {
      return true;
    }

    // Skip for safe HTTP methods (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Skip if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Skip excluded paths
    if (csrfConfig.excludedPaths?.some((path) => request.url.startsWith(path))) {
      return true;
    }

    // Determine token delivery method
    const deliveryConfig = this.config.tokenDelivery;
    const routeMode = this.reflector.get<RouteDelivery>(TOKEN_DELIVERY_KEY, context.getHandler());
    const method = deliveryConfig?.method || 'json';
    let effective: 'cookies' | 'json' = 'json';

    if (routeMode) {
      effective = routeMode;
      this.logger.debug(`[CSRF] Route mode override: ${routeMode}`);
    } else if (method === 'hybrid') {
      // ============================================================================
      // HYBRID MODE: Prefer the credential that is actually present
      // ============================================================================
      // Match AuthGuard logic: if client sends Bearer token, treat as JSON mode
      // This prevents CSRF enforcement for mobile apps using Bearer tokens
      // Handle case-insensitive header lookup (Express uses lowercase, Fastify may use original case)
      const authHeader: string | undefined =
        (request.headers?.authorization as string | undefined) ||
        (request.headers?.Authorization as string | undefined);
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const accessTokenCookieName = getAccessTokenCookieName(this.config);
      const cookieToken: string | undefined = request.cookies?.[accessTokenCookieName];

      this.logger.debug(
        `[CSRF] Hybrid mode - Bearer: ${!!headerToken}, Cookie: ${!!cookieToken}, Origin: ${request.headers?.origin || 'MISSING'}`,
      );
      this.logger.debug(
        `[CSRF] Header check - authHeader exists: ${!!authHeader}, startsWith Bearer: ${authHeader?.startsWith('Bearer ')}, headerToken length: ${headerToken?.length || 0}`,
      );
      this.logger.debug(
        `[CSRF] Cookie check - cookieName: ${accessTokenCookieName}, cookieToken exists: ${!!cookieToken}`,
      );

      if (headerToken && !cookieToken) {
        effective = 'json';
        this.logger.debug(`[CSRF] Detected JSON mode (Bearer token only)`);
      } else if (cookieToken && !headerToken) {
        effective = 'cookies';
        this.logger.debug(`[CSRF] Detected cookies mode (cookie only)`);
      } else {
        // Both present, neither present, or edge case - fall back to origin-based
        effective = resolveDeliveryForRequest(request, deliveryConfig?.hybridPolicy);
        this.logger.debug(
          `[CSRF] Fallback to origin-based resolution: ${effective} (Bearer: ${!!headerToken}, Cookie: ${!!cookieToken})`,
        );
      }
    } else if (method === 'cookies') {
      effective = 'cookies';
      this.logger.debug(`[CSRF] Global cookies mode`);
    } else {
      effective = 'json';
      this.logger.debug(`[CSRF] Global JSON mode`);
    }

    this.logger.debug(`[CSRF] Effective delivery mode: ${effective} for ${request.method} ${request.url}`);

    // Only enforce CSRF for cookie-based token delivery
    if (effective !== 'cookies') {
      this.logger.debug(`[CSRF] Skipping CSRF check (JSON mode)`);
      return true; // JSON mode doesn't need CSRF (Bearer tokens are CSRF-safe)
    }

    // Validate CSRF token
    const cookieName = this.csrfService.getCookieName();
    const headerName = this.csrfService.getHeaderName();
    const csrfToken = request.headers[headerName.toLowerCase()] as string | undefined;
    const csrfCookie = request.cookies?.[cookieName] as string | undefined;

    if (!csrfToken) {
      throw new NAuthException(AuthErrorCode.CSRF_TOKEN_MISSING, `CSRF token missing in header: ${headerName}`);
    }

    if (!csrfCookie) {
      throw new NAuthException(AuthErrorCode.CSRF_TOKEN_MISSING, `CSRF token missing in cookie: ${cookieName}`);
    }

    if (csrfToken !== csrfCookie) {
      throw new NAuthException(AuthErrorCode.CSRF_TOKEN_INVALID, 'CSRF token mismatch');
    }

    return true;
  }
}
