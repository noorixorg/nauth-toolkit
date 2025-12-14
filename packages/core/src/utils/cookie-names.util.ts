/**
 * Cookie Name Utilities
 *
 * Provides consistent cookie name generation using the configured prefix.
 * All cookie names are prefixed to avoid conflicts with other cookies.
 */

import { NAuthConfig } from '../interfaces/config.interface';

/**
 * Get the cookie name prefix from config
 * @param config - NAuth configuration
 * @returns Cookie name prefix (default: 'nauth_')
 */
export function getCookieNamePrefix(config?: NAuthConfig): string {
  return config?.tokenDelivery?.cookieNamePrefix || 'nauth_';
}

/**
 * Get the access token cookie name
 * @param config - NAuth configuration
 * @returns Access token cookie name (default: 'nauth_access_token')
 */
export function getAccessTokenCookieName(config?: NAuthConfig): string {
  const prefix = getCookieNamePrefix(config);
  return `${prefix}access_token`;
}

/**
 * Get the refresh token cookie name
 * @param config - NAuth configuration
 * @returns Refresh token cookie name (default: 'nauth_refresh_token')
 */
export function getRefreshTokenCookieName(config?: NAuthConfig): string {
  const prefix = getCookieNamePrefix(config);
  return `${prefix}refresh_token`;
}

/**
 * Get the device token cookie name
 * @param config - NAuth configuration
 * @returns Device token cookie name (default: 'nauth_device_token')
 */
export function getDeviceTokenCookieName(config?: NAuthConfig): string {
  const prefix = getCookieNamePrefix(config);
  return `${prefix}device_token`;
}

/**
 * Get the CSRF token cookie name
 *
 * If explicitly configured via security.csrf.cookieName, uses that value.
 * Otherwise, uses the prefix: `${prefix}csrf_token`
 *
 * @param config - NAuth configuration
 * @returns CSRF token cookie name (default: 'nauth_csrf_token')
 */
export function getCsrfTokenCookieName(config?: NAuthConfig): string {
  // If explicitly configured, use it
  if (config?.security?.csrf?.cookieName) {
    return config.security.csrf.cookieName;
  }

  // Otherwise, use prefix
  const prefix = getCookieNamePrefix(config);
  return `${prefix}csrf_token`;
}
