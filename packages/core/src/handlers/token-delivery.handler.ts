/**
 * Token Delivery Handler
 *
 * Handles response interception to deliver tokens via Cookies or JSON.
 */

import {
  NAuthConfig,
  resolveDeliveryForRequest,
  resolveRefreshExpiresIn,
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  NAuthLogger,
} from '../index';
import { NAuthRequest, NAuthResponse, NAuthCookieOptions } from '../platform/interfaces';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

export class TokenDeliveryHandler {
  constructor(
    private config: NAuthConfig,
    private logger?: NAuthLogger,
  ) {}

  /**
   * Type guard for detecting an auth response payload.
   *
   * We intentionally validate types at runtime because the handler receives `unknown`
   * response bodies from framework adapters.
   */
  private isAuthResponseBody(
    body: unknown,
  ): body is Record<string, unknown> & { accessToken: string; refreshToken: string } {
    if (!body || typeof body !== 'object') return false;
    const rec = body as Record<string, unknown>;
    return typeof rec.accessToken === 'string' && typeof rec.refreshToken === 'string';
  }

  /**
   * Process the response body.
   * If it contains tokens, handle delivery and return sanitized body.
   * If not, return original body.
   */
  public async handleResponse(req: NAuthRequest, res: NAuthResponse, body: unknown): Promise<unknown> {
    // Check if this is an auth response
    if (this.isAuthResponseBody(body)) {
      const deliveryMode = this.resolveDeliveryMode(req);

      if (deliveryMode === 'cookies') {
        this.setTokenCookies(res, body, req);

        // Remove tokens and expiration fields from body
        // Expiration is managed by cookie maxAge, so these fields are not needed
        const sanitizedBody: Record<string, unknown> = { ...body };
        delete sanitizedBody.accessToken;
        delete sanitizedBody.refreshToken;
        delete sanitizedBody.accessTokenExpiresAt;
        delete sanitizedBody.refreshTokenExpiresAt;

        this.logger?.debug?.('Tokens delivered via cookies');
        return sanitizedBody;
      } else {
        this.logger?.debug?.('Tokens delivered via JSON');
        return body;
      }
    }

    return body;
  }

  /**
   * Resolve the delivery mode for this request.
   *
   * Precedence: route override, then hybrid origin policy, then the global method.
   *
   * A route override that contradicts a non-hybrid `method` is reported through
   * {@link assertOverrideAllowed} before being honoured.
   */
  private resolveDeliveryMode(req: NAuthRequest): 'json' | 'cookies' {
    const method = this.config.tokenDelivery?.method || 'json';

    // Route override
    const routeMode = req.attributes['nauthTokenDelivery'];
    if (routeMode) {
      this.assertOverrideAllowed(routeMode, method);
      return routeMode;
    }

    // Hybrid mode
    if (method === 'hybrid') {
      return resolveDeliveryForRequest(req.raw, this.config.tokenDelivery?.hybridPolicy);
    }

    return method === 'cookies' ? 'cookies' : 'json';
  }

  /**
   * Report a route override that the configured delivery method does not permit.
   *
   * Overrides only make sense under `method: 'hybrid'`, where both transports are live.
   * Asking for JSON under `'cookies'` is a route opting out of httpOnly cookies, and
   * asking for cookies under `'json'` is a route enabling a transport the application
   * disabled — both are usually mistakes.
   *
   * Warns by default and throws only when `tokenDelivery.strictOverrides` is set, so
   * that upgrading cannot break a running application. The NestJS adapter has always
   * thrown here; `strictOverrides: true` brings Express and Fastify into line.
   *
   * @param routeMode - The mode the route asked for
   * @param method - The configured delivery method
   * @throws {NAuthException} When `strictOverrides` is enabled and the modes conflict
   */
  private assertOverrideAllowed(routeMode: 'json' | 'cookies', method: 'json' | 'cookies' | 'hybrid'): void {
    let code: AuthErrorCode | undefined;
    let message: string | undefined;

    if (routeMode === 'cookies' && method === 'json') {
      code = AuthErrorCode.COOKIES_NOT_ALLOWED;
      message = "Route-level cookie delivery requested, but tokenDelivery.method is 'json' (cookies disabled)";
    } else if (routeMode === 'json' && method === 'cookies') {
      code = AuthErrorCode.BEARER_NOT_ALLOWED;
      message =
        "Route-level JSON delivery requested, but tokenDelivery.method is 'cookies' (JSON/Bearer tokens disabled)";
    }

    if (!code || !message) return;

    if (this.config.tokenDelivery?.strictOverrides) {
      throw new NAuthException(code, message);
    }

    this.logger?.warn?.(
      `${message}. The override is being honoured for backwards compatibility. ` +
        "Set tokenDelivery.method to 'hybrid' to serve both transports, or " +
        'tokenDelivery.strictOverrides to true to reject this.',
    );
  }

  private setTokenCookies(
    res: NAuthResponse,
    body: Record<string, unknown> & { accessToken: string; refreshToken: string },
    req: NAuthRequest,
  ): void {
    const accessTokenCookieName = getAccessTokenCookieName(this.config);
    const refreshTokenCookieName = getRefreshTokenCookieName(this.config);

    const cookieOptions: NAuthCookieOptions = {
      httpOnly: true,
      secure: this.config.tokenDelivery?.cookieOptions?.secure ?? true,
      sameSite: (this.config.tokenDelivery?.cookieOptions?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
      domain: this.config.tokenDelivery?.cookieOptions?.domain,
      path: '/',
      priority: (this.config.tokenDelivery?.cookieOptions?.priority as 'low' | 'medium' | 'high') ?? 'high',
    };

    // Align refresh cookie maxAge with the actual issued refresh token TTL
    // (hybrid-policy override wins when set; otherwise global config value).
    const resolvedRefreshExpiresIn = resolveRefreshExpiresIn(req, this.config);
    const accessMaxAge = this.parseExpiry(this.config.jwt.accessToken.expiresIn) * 1000;
    const refreshMaxAge = this.parseExpiry(resolvedRefreshExpiresIn ?? this.config.jwt.refreshToken.expiresIn) * 1000;

    res.setCookie(accessTokenCookieName, body.accessToken, {
      ...cookieOptions,
      maxAge: accessMaxAge,
    });

    res.setCookie(refreshTokenCookieName, body.refreshToken, {
      ...cookieOptions,
      maxAge: refreshMaxAge,
    });
  }

  private parseExpiry(expiry: string | number): number {
    if (typeof expiry === 'number') return expiry;

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15m

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
