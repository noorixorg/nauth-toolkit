/**
 * Base Trusted Device Entity
 *
 * Stores trusted device information for MFA "remember device" feature.
 * Devices marked as trusted can skip MFA verification for a configured period.
 * Uses HttpOnly cookies for secure device token storage.
 *
 * @remarks
 * Each user can have multiple trusted devices. Each record represents one device
 * that has been marked as trusted after successful MFA verification.
 * Trust persists across logouts and session expiration.
 *
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @example
 * ```typescript
 * // Trust a device after MFA verification
 * const trustedDevice = new TrustedDevice();
 * trustedDevice.userId = user.id;
 * trustedDevice.deviceTokenHash = hashToken(deviceToken);
 * trustedDevice.trustedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
 * trustedDevice.deviceName = 'iPhone 15 Pro';
 * trustedDevice.deviceType = 'mobile';
 * ```
 */
export class BaseTrustedDevice {
  /**
   * Internal device ID (auto-increment integer)
   */
  id!: number;

  /**
   * Internal user ID (foreign key to users table)
   * References the user who trusted this device
   */
  userId!: number;

  /**
   * Hashed device token (SHA-256)
   * The actual token is stored in HttpOnly cookie, only hash stored in DB
   * Used for validation and lookup
   *
   * SECURITY: Never store the actual token, only the hash
   */
  deviceTokenHash!: string;

  /**
   * Device identifier (UUID from client or generated)
   * Used for additional validation and device management
   * Can be used to identify the same device across different tokens
   */
  deviceId?: string | null;

  /**
   * User-friendly device name
   * Examples: "iPhone 15 Pro", "Chrome on MacBook", "Firefox on Windows"
   */
  deviceName?: string | null;

  /**
   * Device type
   * Examples: "mobile", "desktop", "tablet"
   */
  deviceType?: string | null;

  /**
   * IP address when device was trusted
   * Used for audit and security monitoring
   */
  ipAddress?: string | null;

  /**
   * User agent string when device was trusted
   * Used for audit and device identification
   */
  userAgent?: string | null;

  /**
   * Platform extracted from user agent
   * Examples: "iOS", "Android", "Windows", "macOS"
   */
  platform?: string | null;

  /**
   * Browser extracted from user agent
   * Examples: "Chrome", "Safari", "Firefox"
   */
  browser?: string | null;

  /**
   * When trust expires
   * After this date, device is no longer trusted and MFA is required
   * Calculated as: createdAt + rememberDeviceDays
   */
  trustedUntil!: Date;

  /**
   * When this device was last used for login
   * Updated on each successful login from this trusted device
   */
  lastUsedAt?: Date | null;

  /**
   * Device creation timestamp
   */
  createdAt!: Date;

  /**
   * Last update timestamp
   */
  updatedAt!: Date;
}
