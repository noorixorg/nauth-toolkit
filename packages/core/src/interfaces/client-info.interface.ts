/**
 * Client information extracted from HTTP request
 *
 * This interface represents metadata about the client making the request,
 * automatically extracted by nauth-toolkit interceptors.
 */
export interface ClientInfo {
  /**
   * Client IP address (extracted from X-Forwarded-For, CF-Connecting-IP, etc.)
   * Automatically handles proxies and load balancers
   */
  ipAddress: string;

  /**
   * User agent string from the request
   */
  userAgent: string;

  /**
   * Device token for trusted device feature
   *
   * Extracted from:
   * - Cookie: `nauth_device_token` (web - httpOnly cookie)
   * - Header: `X-Device-Token` (mobile - from secure storage)
   *
   * This token is server-generated and stored securely by clients.
   * Used to identify trusted devices for MFA bypass.
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
   * Optional IP latitude (from geolocation, if available)
   * Used for impossible travel detection
   */
  ipLatitude?: number;

  /**
   * Optional IP longitude (from geolocation, if available)
   * Used for impossible travel detection
   */
  ipLongitude?: number;

  /**
   * Platform extracted from user agent (e.g., "iOS", "Android", "Windows", "macOS")
   */
  platform?: string;

  /**
   * Browser extracted from user agent (e.g., "Chrome", "Safari", "Firefox")
   */
  browser?: string;

  /**
   * Current session ID (if available from authenticated request)
   * Extracted from JWT token payload after authentication
   */
  sessionId?: number;

  /**
   * Current user ID (if available from authenticated request)
   * Extracted from JWT token payload (sub claim) after authentication
   * Used to identify who performed an action (e.g., for audit trails)
   */
  userId?: number;
}
