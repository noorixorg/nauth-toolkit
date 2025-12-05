/**
 * Base Rate Limit Entity
 *
 * Stores rate limiting counters for transient state management.
 * Used by DatabaseStorageAdapter to track rate limits across multiple servers.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
export class BaseRateLimit {
  /**
   * Internal rate limit record ID (auto-increment integer)
   */
  id!: number;

  /**
   * Unique key identifier for the rate limit counter
   * Format: <endpoint>:<identifier> (e.g., "email-verification:user:123")
   */
  key!: string;

  /**
   * Counter value (stored as string, parsed as integer)
   */
  value!: string;

  /**
   * Expiration timestamp
   * Used for TTL-based cleanup via scheduled jobs
   * Can be null for records that don't expire immediately
   */
  expiresAt!: Date | null;

  /**
   * Record creation timestamp
   */
  createdAt!: Date;

  /**
   * Record last update timestamp
   */
  updatedAt!: Date;
}
