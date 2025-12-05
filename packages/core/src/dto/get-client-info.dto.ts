/**
 * Response DTO for getting client information
 *
 * Used to return client information extracted from the current request context.
 * Includes IP address, user agent, device info, and optional geolocation data.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.get();
 * // Returns: { ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0...', ... }
 * ```
 */

import { ClientInfo } from '../interfaces/client-info.interface';

/**
 * Response DTO for client information
 */
export class GetClientInfoResponseDTO implements ClientInfo {
  /**
   * Client IP address
   *
   * Extracted from X-Forwarded-For, CF-Connecting-IP, etc.
   * Automatically handles proxies and load balancers.
   * Returns 'unknown' if called outside request context.
   */
  ipAddress!: string;

  /**
   * User agent string from the request
   *
   * Returns 'unknown' if called outside request context.
   */
  userAgent!: string;

  /**
   * Device token for trusted device feature
   *
   * Extracted from cookie (nauth_device_id) or header (X-Device-Token).
   * Optional - only present if device token exists.
   */
  deviceToken?: string;

  /**
   * Optional device name (if provided by client)
   */
  deviceName?: string;

  /**
   * Optional device type (if provided by client)
   */
  deviceType?: 'mobile' | 'desktop' | 'tablet';

  /**
   * Optional IP country (from geolocation, if available)
   */
  ipCountry?: string;

  /**
   * Optional IP city (from geolocation, if available)
   */
  ipCity?: string;

  /**
   * Platform extracted from user agent
   *
   * Examples: "iOS", "Android", "Windows", "macOS"
   */
  platform?: string;

  /**
   * Browser extracted from user agent
   *
   * Examples: "Chrome", "Safari", "Firefox"
   */
  browser?: string;

  /**
   * Current session ID (if available from authenticated request)
   *
   * Extracted from JWT token payload after authentication.
   */
  sessionId?: number;
}
