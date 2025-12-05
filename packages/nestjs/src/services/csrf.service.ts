import { Injectable, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NAuthConfig, getCsrfTokenCookieName } from '@nauth-toolkit/core';

/**
 * CSRF Service
 *
 * Generates and manages CSRF tokens for cookie-based token delivery.
 * CSRF protection prevents Cross-Site Request Forgery attacks when tokens
 * are stored in httpOnly cookies.
 *
 * @example
 * ```typescript
 * const csrfService = new CsrfService(config);
 * const token = csrfService.generateToken();
 * const cookieOptions = csrfService.getCookieOptions();
 * ```
 */
@Injectable()
export class CsrfService {
  constructor(
    @Inject('NAUTH_CONFIG')
    private readonly config: NAuthConfig,
  ) {}

  /**
   * Generate a cryptographically secure CSRF token
   *
   * @returns CSRF token as hexadecimal string
   *
   * @example
   * ```typescript
   * const token = csrfService.generateToken();
   * // Returns: 'a1b2c3d4e5f6...' (length depends on config.security.csrf.tokenLength)
   * ```
   */
  generateToken(): string {
    const tokenLength = this.config.security?.csrf?.tokenLength || 32;
    return randomBytes(tokenLength).toString('hex');
  }

  /**
   * Get CSRF cookie options from configuration
   *
   * @returns Cookie options object with defaults
   *
   * @example
   * ```typescript
   * const options = csrfService.getCookieOptions();
   * res.cookie(csrfService.getCookieName(), token, options);
   * ```
   */
  getCookieOptions(): {
    httpOnly: boolean; // Always false - CSRF token must be readable by JavaScript
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
  } {
    const config = this.config.security?.csrf?.cookieOptions;
    return {
      httpOnly: false, // Fixed: CSRF token must be readable by JavaScript to send in header
      secure: config?.secure ?? true,
      sameSite: config?.sameSite ?? 'strict',
      domain: config?.domain,
      path: config?.path ?? '/',
    };
  }

  /**
   * Get CSRF cookie name from configuration
   *
   * If explicitly configured via security.csrf.cookieName, uses that value.
   * Otherwise, uses the prefix: `${prefix}csrf_token` (default: 'nauth_csrf_token')
   *
   * @returns Cookie name (default: 'nauth_csrf_token' with default prefix)
   *
   * @example
   * ```typescript
   * const cookieName = csrfService.getCookieName();
   * // Returns: 'nauth_csrf_token' (or configured value)
   * ```
   */
  getCookieName(): string {
    return getCsrfTokenCookieName(this.config);
  }

  /**
   * Get CSRF header name from configuration
   *
   * @returns Header name (default: 'x-csrf-token')
   *
   * @example
   * ```typescript
   * const headerName = csrfService.getHeaderName();
   * // Returns: 'x-csrf-token' (or configured value)
   * ```
   */
  getHeaderName(): string {
    return this.config.security?.csrf?.headerName || 'x-csrf-token';
  }
}
