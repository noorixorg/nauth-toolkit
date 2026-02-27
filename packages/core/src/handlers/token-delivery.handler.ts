/**
 * Token Delivery Handler
 *
 * Handles response interception to deliver tokens via Cookies or JSON.
 */

import {
  NAuthConfig,
  resolveDeliveryForRequest,
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  NAuthLogger,
} from '../index';
import { NAuthRequest, NAuthResponse, NAuthCookieOptions } from '../platform/interfaces';

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
        this.setTokenCookies(res, body);

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

  private resolveDeliveryMode(req: NAuthRequest): 'json' | 'cookies' {
    const method = this.config.tokenDelivery?.method || 'json';

    // Route override
    if (req.attributes['nauthTokenDelivery']) {
      return req.attributes['nauthTokenDelivery'];
    }

    // Hybrid mode
    if (method === 'hybrid') {
      return resolveDeliveryForRequest(req.raw, this.config.tokenDelivery?.hybridPolicy);
    }

    return method === 'cookies' ? 'cookies' : 'json';
  }

  private setTokenCookies(
    res: NAuthResponse,
    body: Record<string, unknown> & { accessToken: string; refreshToken: string },
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

    const accessMaxAge = this.parseExpiry(this.config.jwt.accessToken.expiresIn) * 1000;
    const refreshMaxAge = this.parseExpiry(this.config.jwt.refreshToken.expiresIn) * 1000;

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
