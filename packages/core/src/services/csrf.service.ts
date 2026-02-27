/**
 * CSRF Protection Service
 *
 * Handles CSRF token generation and validation for cookie-based authentication.
 * Uses cryptographically secure random tokens.
 */

import * as crypto from 'crypto';
import { NAuthConfig } from '../index';
import { NAuthCookieOptions } from '../platform/interfaces';

export class CsrfService {
  private readonly cookieName: string;
  private readonly headerName: string;
  private readonly cookieOptions: NAuthCookieOptions;

  constructor(config: NAuthConfig) {
    this.cookieName = config.security?.csrf?.cookieName || 'nauth_csrf_token';
    this.headerName = config.security?.csrf?.headerName || 'x-csrf-token';
    this.cookieOptions = config.security?.csrf?.cookieOptions || {};
  }

  /**
   * Generate a new CSRF token
   * @returns Random 32-byte token as hex string
   */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate CSRF token
   * Compares token from request header with token from cookie.
   * Uses constant-time comparison to prevent timing attacks.
   */
  validateToken(headerToken: string, cookieToken: string): boolean {
    if (!headerToken || !cookieToken) {
      return false;
    }
    // Constant-time comparison
    return crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken));
  }

  getCookieName(): string {
    return this.cookieName;
  }

  getHeaderName(): string {
    return this.headerName;
  }

  getCookieOptions(): NAuthCookieOptions {
    return this.cookieOptions;
  }
}
