/**
 * Base Storage Lock Entity
 *
 * Stores distributed locks for transient state management.
 * Used by DatabaseStorageAdapter for token refresh locks and other distributed operations.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
export class BaseStorageLock {
  /**
   * Internal lock record ID (auto-increment integer)
   */
  id!: number;

  /**
   * Unique key identifier for the lock
   * Format: <lock-type>:<identifier> (e.g., "refresh-lock:token-hash-123")
   */
  key!: string;

  /**
   * Lock value (stored as string, typically timestamp or lock holder identifier)
   */
  value!: string;

  /**
   * Lock expiration timestamp
   * Used for TTL-based cleanup and automatic lock release
   * Can be null for locks that don't expire
   */
  expiresAt!: Date | null;

  /**
   * Lock creation timestamp
   */
  createdAt!: Date;
}
