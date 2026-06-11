import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';

/**
 * Authentication Audit Event Status
 *
 * Classification of event outcomes for filtering and analysis.
 */
export type AuthAuditEventStatus = 'SUCCESS' | 'FAILURE' | 'INFO' | 'SUSPICIOUS';

/**
 * Base Authentication Audit Entity
 *
 * Core audit record with all fields and business logic.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * **Design Notes:**
 * - Only stores `userId` (integer internal ID) - no `userSub` duplication
 * - Risk tracking fields are infrastructure for future adaptive MFA (no business logic)
 * - All audit integrations are non-blocking (errors logged, don't throw)
 */
export class BaseAuthAudit {
  /**
   * Internal audit record ID (auto-increment integer)
   */
  id!: number;

  /**
   * Internal user ID (foreign key to users table)
   * Uses integer for optimal performance in joins and lookups.
   * API methods accepting userSub will resolve to userId before querying.
   *
   * @remarks
   * No userSub field to avoid duplication. All queries use userId
   * for efficient database operations.
   */
  userId!: number;

  /**
   * Type of authentication/security event
   */
  eventType!: AuthAuditEventType;

  /**
   * Event classification status
   * - SUCCESS: Operation completed successfully
   * - FAILURE: Operation failed (login failed, verification failed, etc.)
   * - INFO: Informational event (profile update, device added, etc.)
   * - SUSPICIOUS: Security violation or suspicious activity detected
   */
  eventStatus!: AuthAuditEventStatus;

  // ============================================================================
  // Risk Assessment Fields (Infrastructure for Future Adaptive MFA)
  // ============================================================================

  /**
   * Risk factor score (0-100)
   * Calculated during adaptive MFA evaluation (future implementation).
   * null if not applicable (non-adaptive flows).
   *
   * @remarks
   * This is infrastructure for future adaptive MFA. The audit service
   * records risk data but does NOT calculate risk scores. Risk calculation
   * and adaptive MFA business logic will be implemented in future phases.
   */
  riskFactor?: number | null;

  /**
   * Risk factors that contributed to the risk score
   * Examples: ['new_device', 'new_ip', 'new_country', 'impossible_travel']
   *
   * @remarks
   * Infrastructure field for future adaptive MFA implementation.
   */
  riskFactors?: string[] | null;

  /**
   * Whether adaptive MFA was triggered for this event
   * true if MFA was conditionally required based on risk (future implementation).
   * null if not applicable.
   *
   * @remarks
   * Infrastructure field for future adaptive MFA implementation.
   */
  adaptiveMfaTriggered?: boolean | null;

  // ============================================================================
  // Client Information
  // ============================================================================

  /**
   * IP address where event occurred
   */
  ipAddress?: string | null;

  /**
   * Country from IP geolocation (optional, for geographic risk assessment)
   */
  ipCountry?: string | null;

  /**
   * City from IP geolocation (optional, for geographic risk assessment)
   */
  ipCity?: string | null;

  /**
   * Latitude from IP geolocation (optional, for impossible travel detection)
   */
  ipLatitude?: number | null;

  /**
   * Longitude from IP geolocation (optional, for impossible travel detection)
   */
  ipLongitude?: number | null;

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

  // ============================================================================
  // Context Information
  // ============================================================================

  /**
   * Session ID (if event is related to a session)
   * Foreign key to sessions table
   */
  sessionId?: number | null;

  /**
   * Challenge session ID (if event is related to a challenge)
   * Foreign key to challenge_sessions table
   */
  challengeSessionId?: number | null;

  /**
   * Authentication method used
   * Examples: "password", "google", "apple", "facebook"
   * Used for social login provider tracking
   */
  authMethod?: string | null;

  /**
   * Who performed this action (for admin/CLI/automated operations)
   * - Admin user ID or email for manual admin actions
   * - CLI identifier for command-line operations
   * - 'system' for automated actions
   * - null for user-initiated actions
   *
   * @example
   * performedBy: 'admin@example.com'
   * performedBy: 'cli-migration-2025'
   * performedBy: 'system'
   */
  performedBy?: string | null;

  // ============================================================================
  // Event Details
  // ============================================================================

  /**
   * Reason for the event (optional)
   * Used for security events, account locks, etc.
   */
  reason?: string | null;

  /**
   * Detailed description of the event
   */
  description?: string | null;

  /**
   * Rich metadata (JSON)
   * Event-specific data stored without requiring schema changes.
   *
   * @example
   * ```typescript
   * // Social login
   * metadata: { provider: 'google', isNewUser: true }
   *
   * // Challenge event
   * metadata: { challengeName: 'VERIFY_EMAIL', challengeSessionId: 123 }
   *
   * // MFA device
   * metadata: { deviceType: 'totp', deviceName: 'iPhone Authenticator' }
   *
   * // Token reuse
   * metadata: { tokenFamily: 'abc123', action: 'token_family_revoked' }
   * ```
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Timestamp when event occurred
   */
  createdAt!: Date;
}
