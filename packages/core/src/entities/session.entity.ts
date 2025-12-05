/**
 * Base Session Entity
 *
 * JWT session tracking with device information and security features.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
export class BaseSession {
  /**
   * Internal session ID (auto-increment integer)
   */
  id!: number;

  /**
   * Version for optimistic locking
   * Automatically incremented on each update by the ORM
   * Used to detect race conditions and concurrent modifications
   *
   * ⚠️ SECURITY CRITICAL: Prevents TOCTOU vulnerabilities
   */
  version!: number;

  /**
   * Internal user ID (foreign key to users table)
   * Uses integer for optimal performance in joins and lookups
   */
  userId!: number;

  /**
   * Access token hash (SHA-256)
   * Used for token revocation and session tracking
   */
  accessTokenHash!: string;

  /**
   * Refresh token hash (SHA-256)
   * Used for token rotation and reuse detection
   */
  refreshTokenHash!: string;

  /**
   * Token family identifier
   * Used for refresh token rotation and reuse detection
   */
  tokenFamily?: string | null;

  /**
   * Device identifier (UUID)
   * Unique identifier for the device/browser
   */
  deviceId?: string | null;

  /**
   * User-friendly device name
   * Examples: "iPhone 15 Pro", "Chrome on MacBook"
   */
  deviceName?: string | null;

  /**
   * Device type
   * Examples: "mobile", "desktop", "tablet"
   */
  deviceType?: string | null;

  /**
   * Device fingerprint hash
   * Combination of device characteristics for additional security
   */
  deviceFingerprint?: string | null;

  /**
   * IP address when session was created
   */
  ipAddress?: string | null;

  /**
   * Country from IP geolocation (optional)
   */
  ipCountry?: string | null;

  /**
   * City from IP geolocation (optional)
   */
  ipCity?: string | null;

  /**
   * ISP from IP geolocation (optional)
   */
  ipIsp?: string | null;

  /**
   * User agent string
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
   * Authentication method used to create this session
   * Examples: "password", "google", "facebook", "github", "apple"
   * null for legacy sessions
   */
  authMethod?: string | null;

  /**
   * "Remember me" flag
   * Longer expiration for remembered sessions
   */
  isRemembered!: boolean;

  /**
   * Trusted device flag
   * Trusted devices may skip MFA
   */
  isTrustedDevice!: boolean;

  /**
   * Session expiration timestamp
   * After this time, session is invalid
   */
  expiresAt!: Date;

  /**
   * Last activity timestamp
   * Updated on each API request
   */
  lastActivityAt?: Date | null;

  /**
   * Session revocation status
   * Revoked sessions cannot be used
   */
  isRevoked!: boolean;

  /**
   * When session was revoked
   */
  revokedAt?: Date | null;

  /**
   * Reason for session revocation
   * Examples: "user_logout", "token_reuse_detected", "admin_revoked"
   */
  revokeReason?: string | null;

  /**
   * Additional session metadata (JSON)
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Session creation timestamp
   */
  createdAt!: Date;
}
