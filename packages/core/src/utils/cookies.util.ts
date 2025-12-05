/**
 * Cookie Utilities
 *
 * Helpers for clearing nauth auth cookies in HTTP responses.
 */

import { NAuthConfig } from '../interfaces/config.interface';
import {
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  getCsrfTokenCookieName,
  getDeviceTokenCookieName,
} from './cookie-names.util';

export interface CookieOptions {
  domain?: string;
  path?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Clear nauth auth cookies on the response.
 *
 * - Clears access token, refresh token, CSRF token cookies
 * - Optionally clears device token cookie (only when forgetDevice=true)
 * - Device token cookies persist across logout by default (remember device feature)
 * - Applies security attributes consistent with how cookies were set
 * - Uses configured cookie name prefix (default: 'nauth_')
 *
 * @param res - HTTP response object (Express or Fastify compatible)
 * @param config - NAuth configuration (optional, for cookie name resolution)
 * @param opt - Optional cookie options to match configured attributes
 * @param forgetDevice - If true, also clears device token cookie (for "forget me" logout). Default: false
 */
export function clearAuthCookies(
  res: { cookie?: Function; setCookie?: Function },
  config?: NAuthConfig | CookieOptions,
  opt?: CookieOptions,
  forgetDevice: boolean = false,
): void {
  // Handle old signature: clearAuthCookies(res, opt) where opt might be config or CookieOptions
  let cookieOptions: CookieOptions | undefined;
  let nauthConfig: NAuthConfig | undefined;

  if (config && 'tokenDelivery' in config) {
    // Second param is NAuthConfig
    nauthConfig = config as NAuthConfig;
    cookieOptions = opt;
  } else {
    // Second param is CookieOptions (backward compatibility)
    cookieOptions = config as CookieOptions | undefined;
  }

  const base = {
    httpOnly: true as const,
    secure: cookieOptions?.secure !== false,
    sameSite: (cookieOptions?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
    path: cookieOptions?.path || '/',
    domain: cookieOptions?.domain,
    maxAge: 0,
  };

  const accessTokenName = getAccessTokenCookieName(nauthConfig);
  const refreshTokenName = getRefreshTokenCookieName(nauthConfig);
  const csrfTokenName = getCsrfTokenCookieName(nauthConfig);
  const deviceTokenName = getDeviceTokenCookieName(nauthConfig);

  // CSRF cookie options (httpOnly: false, matches how it was set)
  const csrfBase = {
    ...base,
    httpOnly: false as const, // CSRF token must be readable by JavaScript
  };

  if (typeof res.cookie === 'function') {
    res.cookie(accessTokenName, '', base);
    res.cookie(refreshTokenName, '', base);
    res.cookie(csrfTokenName, '', csrfBase);
    // Only clear device token cookie if forgetDevice=true (for "forget me" logout)
    // Device tokens persist across normal logout (remember device feature)
    if (forgetDevice) {
      res.cookie(deviceTokenName, '', base); // Device token cookie (httpOnly: true)
    }
  } else if (typeof res.setCookie === 'function') {
    res.setCookie(accessTokenName, '', base);
    res.setCookie(refreshTokenName, '', base);
    res.setCookie(csrfTokenName, '', csrfBase);
    // Only clear device token cookie if forgetDevice=true (for "forget me" logout)
    // Device tokens persist across normal logout (remember device feature)
    if (forgetDevice) {
      res.setCookie(deviceTokenName, '', base); // Device token cookie (httpOnly: true)
    }
  }
}
