import { Injectable, Inject } from '@nestjs/common';
import {
  AuthErrorCode,
  NAuthConfig,
  NAuthException,
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  getDeviceTokenCookieName,
  resolveDeliveryForRequest,
} from '@nauth-toolkit/core';
import { JwtService } from '@nauth-toolkit/core/internal';
import { CsrfService } from './csrf.service';
import type { RouteDelivery } from '../decorators/token-delivery.decorator';

/**
 * Token delivery helper for HTTP controllers/interceptors (NestJS)
 *
 * Centralizes logic for:
 * - determining effective token delivery ('cookies' | 'json') in hybrid mode
 * - setting httpOnly auth cookies (and device token cookie) consistently
 * - setting CSRF cookie when using cookie-based delivery
 *
 * This keeps consumer applications lightweight by letting toolkit controllers
 * (like social redirect/callback) reuse the same cookie semantics as interceptors.
 *
 * @example
 * ```typescript
 * const effective = service.resolveEffectiveDelivery(req, undefined);
 * if (effective === 'cookies') {
 *   service.setAuthCookies(res, { accessToken, refreshToken });
 *   service.setCsrfCookie(res, accessToken);
 * }
 * ```
 */
@Injectable()
export class TokenDeliveryHttpService {
  constructor(
    @Inject('NAUTH_CONFIG')
    private readonly config: NAuthConfig,
    private readonly jwtService: JwtService,
    private readonly csrfService?: CsrfService,
  ) {}

  /**
   * Resolve the effective delivery mode for the current request.
   *
   * @param req - Framework request object (only `headers.origin` is used in hybrid mode)
   * @param routeMode - Optional route-level override ('cookies' | 'json')
   * @returns Effective delivery mode
   * @throws {NAuthException} If route requests a mode not allowed by global config
   */
  resolveEffectiveDelivery(req: unknown, routeMode?: RouteDelivery): 'cookies' | 'json' {
    const method = this.config.tokenDelivery?.method || 'json';

    // Validate route override against global configuration
    if (routeMode === 'cookies' && method === 'json') {
      throw new NAuthException(
        AuthErrorCode.COOKIES_NOT_ALLOWED,
        "Route-level cookie delivery requested, but tokenDelivery.method is 'json' (cookies disabled)",
      );
    }
    if (routeMode === 'json' && method === 'cookies') {
      throw new NAuthException(
        AuthErrorCode.BEARER_NOT_ALLOWED,
        "Route-level JSON delivery requested, but tokenDelivery.method is 'cookies' (JSON/Bearer tokens disabled)",
      );
    }

    if (routeMode) {
      return routeMode;
    }
    if (method === 'hybrid') {
      return resolveDeliveryForRequest(req, this.config.tokenDelivery?.hybridPolicy);
    }
    return method === 'cookies' ? 'cookies' : 'json';
  }

  /**
   * Set auth cookies on the response.
   *
   * @param res - HTTP response object (FastifyReply or Express response)
   * @param tokens - Tokens to set
   * @throws {NAuthException} If token exp claims are missing/invalid
   */
  setAuthCookies(res: unknown, tokens: { accessToken: string; refreshToken?: string; deviceToken?: string }): void {
    const cookieOptions = this.buildCookieOptions();
    const setCookie = this.getSetCookieFn(res);

    // Derive expiry from JWT exp claims (strict)
    const accessPayload = this.jwtService.decodeToken(tokens.accessToken);
    if (!accessPayload?.exp) {
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Access token missing exp claim; refusing to set cookies');
    }
    const accessMaxAgeMs = Math.max(0, (accessPayload.exp as number) * 1000 - Date.now());
    if (accessMaxAgeMs <= 0) {
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Access token already expired; refusing to set cookies');
    }

    const accessTokenCookieName = getAccessTokenCookieName(this.config);
    setCookie(accessTokenCookieName, tokens.accessToken, { ...cookieOptions, maxAge: accessMaxAgeMs });

    if (typeof tokens.refreshToken === 'string' && tokens.refreshToken) {
      const refreshPayload = this.jwtService.decodeToken(tokens.refreshToken);
      if (!refreshPayload?.exp) {
        throw new NAuthException(
          AuthErrorCode.TOKEN_INVALID,
          'Refresh token missing exp claim; refusing to set cookies',
        );
      }
      const refreshMaxAgeMs = Math.max(0, (refreshPayload.exp as number) * 1000 - Date.now());
      if (refreshMaxAgeMs <= 0) {
        throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Refresh token already expired; refusing to set cookies');
      }
      const refreshTokenCookieName = getRefreshTokenCookieName(this.config);
      setCookie(refreshTokenCookieName, tokens.refreshToken, { ...cookieOptions, maxAge: refreshMaxAgeMs });
    }

    // Trusted device cookie (optional)
    if (typeof tokens.deviceToken === 'string' && tokens.deviceToken) {
      this.setDeviceTokenCookie(res, tokens.deviceToken);
    }
  }

  /**
   * Set only the device token cookie (used by trust-device endpoint).
   *
   * @param res - HTTP response
   * @param deviceToken - Device token to persist as cookie
   */
  setDeviceTokenCookie(res: unknown, deviceToken: string): void {
    const token = typeof deviceToken === 'string' ? deviceToken : '';
    if (!token) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'deviceToken is required', { field: 'deviceToken' });
    }

    const cookieOptions = this.buildCookieOptions();
    const setCookie = this.getSetCookieFn(res);

    const rememberDeviceDays = this.config.mfa?.rememberDeviceDays || 30;
    const deviceTokenMaxAgeMs = rememberDeviceDays * 24 * 60 * 60 * 1000;
    const deviceTokenCookieName = getDeviceTokenCookieName(this.config);
    setCookie(deviceTokenCookieName, token, { ...cookieOptions, maxAge: deviceTokenMaxAgeMs });
  }

  /**
   * Set CSRF cookie for cookie-based delivery.
   *
   * @param res - HTTP response
   * @param accessToken - Access token used to align CSRF cookie lifetime
   */
  setCsrfCookie(res: unknown, accessToken: string): void {
    if (!this.csrfService || !this.config.security?.csrf) {
      return;
    }

    const accessPayload = this.jwtService.decodeToken(accessToken);
    if (!accessPayload?.exp) {
      throw new NAuthException(
        AuthErrorCode.TOKEN_INVALID,
        'Access token missing exp claim; refusing to set CSRF cookie',
      );
    }
    const accessMaxAgeMs = Math.max(0, (accessPayload.exp as number) * 1000 - Date.now());

    const csrfToken = this.csrfService.generateToken();
    const csrfCookieName = this.csrfService.getCookieName();
    const csrfCookieOptions = this.csrfService.getCookieOptions();

    const setCookie = this.getSetCookieFn(res);
    setCookie(csrfCookieName, csrfToken, {
      ...csrfCookieOptions,
      maxAge: accessMaxAgeMs > 0 ? accessMaxAgeMs : undefined,
    });
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private buildCookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    path: string;
    domain?: string;
  } {
    const opt = this.config.tokenDelivery?.cookieOptions;
    const cookieOptions: {
      httpOnly: true;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      path: string;
      domain?: string;
    } = {
      httpOnly: true as const,
      secure: opt?.secure !== false,
      sameSite: (opt?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
      path: opt?.path || '/',
    };
    if (opt?.domain) {
      cookieOptions.domain = opt.domain;
    }
    return cookieOptions;
  }

  private getSetCookieFn(res: unknown): (name: string, value: string, options: Record<string, unknown>) => void {
    return (name: string, value: string, options: Record<string, unknown>) => {
      const r = res as {
        cookie?: (n: string, v: string, o: unknown) => void;
        setCookie?: (n: string, v: string, o: unknown) => void;
      };
      if (typeof r.cookie === 'function') {
        r.cookie(name, value, options);
        return;
      }
      if (typeof r.setCookie === 'function') {
        r.setCookie(name, value, options);
        return;
      }
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Response does not support setting cookies');
    };
  }
}
