import { Repository, LessThan } from 'typeorm';
import { StorageAdapter, LoggerService, BaseRateLimit, BaseStorageLock } from '@nauth-toolkit/core';

type RecordUpdate = Partial<Record<string, unknown>>;

/**
 * Database Storage Adapter
 *
 * Implements StorageAdapter interface using TypeORM repositories for persistent storage.
 * Stores transient state (rate limits, locks, token reuse tracking) in database tables.
 *
 * **Key Features:**
 * - Multi-server compatible (all servers share same database)
 * - Atomic operations via database-level increment/decrement
 * - TTL support via expiresAt column with scheduled cleanup
 * - Hash and list operations stored as JSON
 * - Seamlessly integrates with existing TypeORM DataSource
 *
 * **Database Tables:**
 * - `nauth_rate_limits`: Key-value pairs with expiration
 * - `nauth_storage_locks`: Distributed locks with expiration
 *
 * **Usage:**
 * ```typescript
 * import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
 *
 * AuthModule.forRoot({
 *   storageAdapter: new DatabaseStorageAdapter(), // Uses injected repositories
 * });
 * ```
 *
 * @example
 * ```typescript
 * const adapter = new DatabaseStorageAdapter();
 * await adapter.initialize();
 * await adapter.set('key', 'value', 60); // Set with 60 second TTL
 * const value = await adapter.get('key');
 * ```
 */

export class DatabaseStorageAdapter implements StorageAdapter {
  /**
   * Creates a new DatabaseStorageAdapter instance
   *
   * @param rateLimitRepo - TypeORM repository for rate limit storage (injected)
   * @param storageLockRepo - TypeORM repository for distributed locks (injected)
   * @param logger - Logger service for error and debug logging
   * @throws {NAuthException} If repositories are not provided (entities not registered in TypeORM)
   */
  constructor(
    private rateLimitRepo: Repository<BaseRateLimit> | null,
    private storageLockRepo: Repository<BaseStorageLock> | null,
    private logger?: LoggerService,
  ) {
    // Repositories validation deferred to initialize() because:
    // - Factory-created adapters won't have repositories injected yet
    // - Repositories will be available when adapter is used as a provider
  }

  /**
   * Set repositories after construction (for factory-created adapters)
   * This method is called by the auth module when repositories become available
   *
   * @param rateLimitRepo - TypeORM repository for rate limit storage
   * @param storageLockRepo - TypeORM repository for distributed locks
   */
  setRepositories(rateLimitRepo: Repository<BaseRateLimit>, storageLockRepo: Repository<BaseStorageLock>): void {
    this.rateLimitRepo = rateLimitRepo;
    this.storageLockRepo = storageLockRepo;
  }

  /**
   * Determine which repository to use based on key prefix
   * Locks and token reuse tracking go to storageLockRepo
   * Rate limits and other data go to rateLimitRepo
   *
   * @param key - The storage key
   * @returns The appropriate repository
   */
  private getRepositoryForKey(key: string): Repository<BaseRateLimit> | Repository<BaseStorageLock> {
    // Keys starting with these prefixes are locks/tokens (distributed locking)
    if (key.startsWith('refresh-lock:') || key.startsWith('used-token:') || key.startsWith('session-refresh:')) {
      return this.storageLockRepo!;
    }
    // All other keys are rate limits or general storage (e.g., nauth:ratelimit:, phone-verification:)
    return this.rateLimitRepo!;
  }

  /**
   * Initialize the storage adapter
   * Performs health check to ensure repositories are accessible
   *
   * @throws {Error} If repositories are not available
   */
  async initialize(): Promise<void> {
    if (!this.rateLimitRepo || !this.storageLockRepo) {
      throw new Error(
        'DatabaseStorageAdapter requires RateLimit and StorageLock repositories to be registered. ' +
          'Make sure to include storage entities in TypeORM.forRoot(): ' +
          'entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()]',
      );
    }
  }

  /**
   * Check if the storage adapter is healthy and operational
   * @returns True if repositories are available, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    return !!(this.rateLimitRepo && this.storageLockRepo);
  }

  // ============================================================================
  // Basic Key-Value Operations
  // ============================================================================

  /**
   * Get a value by key
   * @param key - The key to retrieve
   * @returns The stored value or null if not found/expired
   */
  async get(key: string): Promise<string | null> {
    try {
      const repo = this.getRepositoryForKey(key);
      const record = await repo.findOne({
        where: { key },
      });

      if (!record) {
        return null;
      }

      // Check if expired
      const expiresAt = record.expiresAt as Date | null;
      if (expiresAt && expiresAt < new Date()) {
        // Clean up expired record
        await repo.delete({ key });
        return null;
      }

      return record.value as string;
    } catch (error) {
      this.logger?.error?.(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a key-value pair with optional TTL (time to live)
   *
   * @param key - The key to store
   * @param value - The value to store
   * @param ttlSeconds - Time to live in seconds (optional)
   * @param options - Additional options like nx (set if not exists)
   */
  async set(key: string, value: string, ttlSeconds?: number, options?: { nx?: boolean }): Promise<string | null> {
    const now = new Date();
    const expiresAt = ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000) : null;

    try {
      const repo = this.getRepositoryForKey(key);

      if (options?.nx) {
        // For NX operation, we need to handle the case where the key doesn't exist yet
        // Since pessimistic locking can't lock a non-existent row, we use a different approach:
        // 1. Try to insert directly - rely on unique constraint to prevent duplicates
        // 2. If duplicate key error, check if the existing key is expired
        // 3. If expired, delete and retry insert
        // This ensures atomicity through the database unique constraint
        try {
          // First attempt: Try to insert directly
          // If key doesn't exist, this succeeds immediately (fast path)
          await repo
            .createQueryBuilder()
            .insert()
            .into(repo.target)
            .values({
              key,
              value,
              expiresAt,
            } as RecordUpdate)
            .execute();
          return value; // Success - key was set
        } catch (error: unknown) {
          // Insert failed - check if it's a duplicate key error
          const dbError = error as { code?: string; message?: string };
          const isDuplicateKey =
            dbError.code === 'ER_DUP_ENTRY' ||
            dbError.code === '23505' ||
            dbError.message?.includes('duplicate key') ||
            dbError.message?.includes('UNIQUE constraint failed');

          // If not a duplicate key error, re-throw immediately
          if (!isDuplicateKey) {
            throw error;
          }

          // Duplicate key detected - start transaction IMMEDIATELY (no gap) to check expiration
          // This minimizes race condition window between error detection and lock acquisition
          return await repo.manager.transaction(async (transactionalEntityManager) => {
            // Lock the existing row to prevent other transactions from modifying it
            const existing = await transactionalEntityManager.findOne(repo.target, {
              where: { key },
              lock: { mode: 'pessimistic_write' },
            });

            if (!existing) {
              // Row was deleted between our insert attempt and this check - try insert again
              try {
                await transactionalEntityManager.insert(repo.target, {
                  key,
                  value,
                  expiresAt,
                } as RecordUpdate);
                return value;
              } catch (retryError: unknown) {
                const retryDbError = retryError as { code?: string; message?: string };
                if (
                  retryDbError.code === 'ER_DUP_ENTRY' ||
                  retryDbError.code === '23505' ||
                  retryDbError.message?.includes('duplicate key') ||
                  retryDbError.message?.includes('UNIQUE constraint failed')
                ) {
                  return null; // Another request inserted it
                }
                throw retryError;
              }
            }

            // Check if expired
            const existingExpiresAt = existing.expiresAt as Date | null;
            if (existingExpiresAt && existingExpiresAt < now) {
              // Expired - delete and insert
              await transactionalEntityManager.delete(repo.target, { key });
              await transactionalEntityManager.insert(repo.target, {
                key,
                value,
                expiresAt,
              } as RecordUpdate);
              return value;
            }

            // Key exists and is not expired - NX operation fails
            return null;
          });
        }
      } else {
        // Regular upsert operation
        await repo.upsert(
          {
            key,
            value,
            expiresAt,
          } as RecordUpdate,
          ['key'],
        );
        return value;
      }
    } catch (error) {
      this.logger?.error?.(`Failed to set key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key from storage
   * @param key - The key to delete
   */
  async del(key: string): Promise<void> {
    try {
      const repo = this.getRepositoryForKey(key);
      await repo.delete({ key });
    } catch (error) {
      this.logger?.error?.(`Failed to delete key ${key}:`, error);
    }
  }

  /**
   * Check if a key exists
   * @param key - The key to check
   * @returns True if the key exists and is not expired, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  // ============================================================================
  // Atomic Operations (for counters and rate limiting)
  // ============================================================================

  /**
   * Increment a counter stored at key
   * Uses TypeORM transaction with pessimistic locking for thread-safety
   * Automatically resets to 1 if the record is expired (treats as new window)
   *
   * @param key - The key to increment
   * @param ttlSeconds - Optional TTL in seconds to set when creating a new record (defaults to 24 hours)
   * @returns The new value after incrementing
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const repo = this.getRepositoryForKey(key);
    return await repo.manager.transaction(async (transactionalEntityManager) => {
      // Lock the row for update to ensure atomicity
      const record = await transactionalEntityManager.findOne(repo.target, {
        where: { key },
        lock: { mode: 'pessimistic_write' },
      });

      // Check if record exists and is expired
      const now = new Date();
      const isExpired = record && record.expiresAt && record.expiresAt < now;

      if (record && !isExpired) {
        // Update existing non-expired record
        const currentValue = parseInt(record.value as string, 10) || 0;
        const newValue = currentValue + 1;

        await transactionalEntityManager.update(repo.target, { key }, {
          value: newValue.toString(),
        } as RecordUpdate);

        return newValue;
      } else {
        // Key doesn't exist OR is expired - create/reset with value 1
        // Delete expired record first if it exists
        if (record) {
          await transactionalEntityManager.delete(repo.target, { key });
        }

        // Use provided TTL or default to 24 hours to prevent orphaned counters
        const ttlToUse = ttlSeconds !== undefined ? ttlSeconds : 24 * 60 * 60; // Default 24 hours

        // Compute expiration on the database side to avoid timezone discrepancies
        const dbExpr = this.getDbNowPlusSecondsExpression(repo, ttlToUse);

        await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(repo.target as any)
          .values([
            {
              key,
              value: '1',
              expiresAt: () => dbExpr,
            } as any,
          ])
          .execute();

        return 1;
      }
    });
  }

  /**
   * Decrement a counter stored at key
   * Uses TypeORM transaction with pessimistic locking for thread-safety
   *
   * @param key - The key to decrement
   * @returns The new value after decrementing (minimum 0)
   */
  async decr(key: string): Promise<number> {
    const repo = this.getRepositoryForKey(key);
    return await repo.manager.transaction(async (transactionalEntityManager) => {
      // Lock the row for update to ensure atomicity
      const record = await transactionalEntityManager.findOne(repo.target, {
        where: { key },
        lock: { mode: 'pessimistic_write' },
      });

      if (record) {
        // Update existing record
        const currentValue = parseInt(record.value as string, 10) || 0;
        const newValue = Math.max(0, currentValue - 1); // Ensure minimum 0

        await transactionalEntityManager.update(repo.target, { key }, {
          value: newValue.toString(),
        } as RecordUpdate);

        return newValue;
      } else {
        // Key doesn't exist - create with value 0
        const defaultExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await transactionalEntityManager.save(repo.target, {
          key,
          value: '0',
          expiresAt: defaultExpiration,
        } as RecordUpdate);

        return 0;
      }
    });
  }

  /**
   * Set expiration time for a key
   * @param key - The key to set expiration for
   * @param ttlSeconds - Time to live in seconds
   * @throws {Error} If expiration cannot be set (key doesn't exist or update fails)
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      const repo = this.getRepositoryForKey(key);
      // Compute expiration on the database side to avoid timezone discrepancies
      const dbExpr = this.getDbNowPlusSecondsExpression(repo, ttlSeconds);

      const result = await repo
        .createQueryBuilder()
        .update(repo.target as any)
        .set({ expiresAt: () => dbExpr } as any)
        .where({ key } as any)
        .execute();

      if (result.affected === 0) {
        this.logger?.warn?.(`Failed to set expiration for key ${key}: key does not exist`);
      } else {
        this.logger?.debug?.(`Set expiration for key ${key}: ${ttlSeconds}s`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Failed to set expiration for key ${key}: ${errorMessage}`, { error, ttlSeconds });
      // Don't throw - expiration failures shouldn't break the calling code
    }
  }

  /**
   * Build a DB-specific expression for NOW() + seconds
   * Ensures createdAt and expiresAt are in the same time base (database-side).
   */
  private getDbNowPlusSecondsExpression(
    repo: Repository<BaseRateLimit> | Repository<BaseStorageLock>,
    seconds: number,
  ): string {
    // TypeORM v0.3: DataSource is available at manager.connection (or dataSource)
    const dataSource: any = (repo.manager as any).connection ?? (repo.manager as any).dataSource;
    const type: string | undefined = dataSource?.options?.type;

    if (type === 'postgres') {
      return `NOW() + INTERVAL '${seconds} seconds'`;
    }
    if (type === 'mysql' || type === 'mariadb') {
      return `DATE_ADD(NOW(), INTERVAL ${seconds} SECOND)`;
    }
    if (type === 'sqlite' || type === 'better-sqlite3') {
      return `DATETIME('now', '+${seconds} seconds')`;
    }
    // Fallback (PostgreSQL syntax)
    return `NOW() + INTERVAL '${seconds} seconds'`;
  }

  /**
   * Get the time-to-live for a key in seconds
   * @param key - The key to check
   * @returns TTL in seconds, or -1 if key doesn't exist, or -2 if no expiration
   */
  async ttl(key: string): Promise<number> {
    try {
      const repo = this.getRepositoryForKey(key);
      const record = await repo.findOne({
        where: { key },
      });

      if (!record) {
        return -1; // Key doesn't exist
      }

      const expiresAt = record.expiresAt as Date | null;
      if (!expiresAt) {
        return -2; // No expiration set
      }

      const ttlMs = expiresAt.getTime() - Date.now();
      return Math.max(0, Math.ceil(ttlMs / 1000)); // Convert to seconds, minimum 0
    } catch (error) {
      this.logger?.error?.(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  // ============================================================================
  // Hash Operations (for complex data structures)
  // ============================================================================

  /**
   * Set a field in a hash stored at key
   * @param key - The hash key
   * @param field - The field name
   * @param value - The field value
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      const hashKey = `hash:${key}`;
      let hashData: Record<string, string> = {};

      // Get existing hash data
      const existing = await this.get(hashKey);
      if (existing) {
        try {
          hashData = JSON.parse(existing);
        } catch {
          // Invalid JSON, start fresh
        }
      }

      hashData[field] = value;

      // Store updated hash
      await this.set(hashKey, JSON.stringify(hashData));
    } catch (error) {
      this.logger?.error?.(`Failed to hset ${key} ${field}:`, error);
    }
  }

  /**
   * Get a field from a hash stored at key
   * @param key - The hash key
   * @param field - The field name
   * @returns The field value or null if not found
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const hashKey = `hash:${key}`;
      const hashDataStr = await this.get(hashKey);

      if (!hashDataStr) {
        return null;
      }

      try {
        const hashData: Record<string, string> = JSON.parse(hashDataStr);
        return hashData[field] || null;
      } catch {
        return null; // Invalid JSON
      }
    } catch (error) {
      this.logger?.error?.(`Failed to hget ${key} ${field}:`, error);
      return null;
    }
  }

  /**
   * Get all fields and values from a hash stored at key
   * @param key - The hash key
   * @returns Object with all field-value pairs
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const hashKey = `hash:${key}`;
      const hashDataStr = await this.get(hashKey);

      if (!hashDataStr) {
        return {};
      }

      try {
        return JSON.parse(hashDataStr) as Record<string, string>;
      } catch {
        return {}; // Invalid JSON
      }
    } catch (error) {
      this.logger?.error?.(`Failed to hgetall ${key}:`, error);
      return {};
    }
  }

  /**
   * Delete fields from a hash stored at key
   * @param key - The hash key
   * @param fields - The field names to delete
   * @returns The number of fields that were removed
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      const hashKey = `hash:${key}`;
      const hashDataStr = await this.get(hashKey);

      if (!hashDataStr) {
        return 0;
      }

      let hashData: Record<string, string>;
      try {
        hashData = JSON.parse(hashDataStr);
      } catch {
        return 0; // Invalid JSON
      }

      let deletedCount = 0;
      for (const field of fields) {
        if (field in hashData) {
          delete hashData[field];
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        await this.set(hashKey, JSON.stringify(hashData));
      }

      return deletedCount;
    } catch (error) {
      this.logger?.error?.(`Failed to hdel ${key}:`, error);
      return 0;
    }
  }

  // ============================================================================
  // List Operations (for ordered collections)
  // ============================================================================

  /**
   * Push a value to the left (beginning) of a list stored at key
   * @param key - The list key
   * @param value - The value to push
   */
  async lpush(key: string, value: string): Promise<void> {
    try {
      const listKey = `list:${key}`;
      let listData: string[] = [];

      // Get existing list data
      const existing = await this.get(listKey);
      if (existing) {
        try {
          listData = JSON.parse(existing);
          if (!Array.isArray(listData)) {
            listData = [];
          }
        } catch {
          // Invalid JSON, start fresh
        }
      }

      // Add to beginning of list
      listData.unshift(value);

      // Store updated list
      await this.set(listKey, JSON.stringify(listData));
    } catch (error) {
      this.logger?.error?.(`Failed to lpush ${key}:`, error);
    }
  }

  /**
   * Get a range of elements from a list stored at key
   * @param key - The list key
   * @param start - Start index (0-based)
   * @param stop - End index (inclusive, -1 for end)
   * @returns Array of elements in the specified range
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const listKey = `list:${key}`;
      const listDataStr = await this.get(listKey);

      if (!listDataStr) {
        return [];
      }

      let listData: string[];
      try {
        listData = JSON.parse(listDataStr);
        if (!Array.isArray(listData)) {
          return [];
        }
      } catch {
        return []; // Invalid JSON
      }

      // Handle negative indices
      const len = listData.length;
      if (start < 0) start = Math.max(0, len + start);
      if (stop < 0) stop = len + stop;
      if (stop >= len) stop = len - 1;

      if (start > stop || start >= len) {
        return [];
      }

      return listData.slice(start, stop + 1);
    } catch (error) {
      this.logger?.error?.(`Failed to lrange ${key}:`, error);
      return [];
    }
  }

  /**
   * Get the length of a list stored at key
   * @param key - The list key
   * @returns The length of the list
   */
  async llen(key: string): Promise<number> {
    try {
      const listKey = `list:${key}`;
      const listDataStr = await this.get(listKey);

      if (!listDataStr) {
        return 0;
      }

      try {
        const listData = JSON.parse(listDataStr);
        return Array.isArray(listData) ? listData.length : 0;
      } catch {
        return 0; // Invalid JSON
      }
    } catch (error) {
      this.logger?.error?.(`Failed to llen ${key}:`, error);
      return 0;
    }
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  /**
   * Find keys matching a pattern
   * @param pattern - Glob pattern to match keys against
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      // Convert glob pattern to SQL LIKE pattern
      const likePattern = pattern
        .replace(/\*/g, '%') // * becomes %
        .replace(/\?/g, '_'); // ? becomes _

      // Query both repositories: rate limits and storage locks
      const now = new Date();

      const rateLimitKeysPromise = this.rateLimitRepo!.createQueryBuilder('record')
        .where('record.key LIKE :pattern', { pattern: likePattern })
        .andWhere('(record.expiresAt IS NULL OR record.expiresAt > :now)', { now })
        .select('record.key')
        .getRawMany();

      const storageLockKeysPromise = this.storageLockRepo!.createQueryBuilder('record')
        .where('record.key LIKE :pattern', { pattern: likePattern })
        .andWhere('(record.expiresAt IS NULL OR record.expiresAt > :now)', { now })
        .select('record.key')
        .getRawMany();

      const [rateLimitRows, storageLockRows] = await Promise.all([rateLimitKeysPromise, storageLockKeysPromise]);

      const keysSet = new Set<string>();
      for (const r of rateLimitRows) keysSet.add(r.key);
      for (const r of storageLockRows) keysSet.add(r.key);

      return Array.from(keysSet);
    } catch (error) {
      this.logger?.error?.(`Failed to find keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Scan for keys matching a pattern (simplified version)
   * @param cursor - Cursor for pagination (unused in this implementation)
   * @param pattern - Pattern to match
   * @param count - Maximum number of keys to return
   * @returns [nextCursor, keys] tuple
   */
  async scan(cursor: number, pattern: string, count: number): Promise<[number, string[]]> {
    try {
      const keys = await this.keys(pattern);
      const startIndex = cursor;
      const endIndex = Math.min(startIndex + count, keys.length);
      const resultKeys = keys.slice(startIndex, endIndex);

      const nextCursor = endIndex < keys.length ? endIndex : 0;
      return [nextCursor, resultKeys];
    } catch (error) {
      this.logger?.error?.(`Failed to scan with pattern ${pattern}:`, error);
      return [0, []];
    }
  }

  /**
   * Clean up expired keys (called periodically by background task)
   * Cleans both rate limit and storage lock tables
   */
  async cleanup(): Promise<void> {
    try {
      // Clean expired keys from both repositories
      await this.rateLimitRepo!.delete({
        expiresAt: LessThan(new Date()),
      });
      await this.storageLockRepo!.delete({
        expiresAt: LessThan(new Date()),
      });
    } catch (error) {
      this.logger?.error?.('Failed to cleanup expired keys:', error);
    }
  }

  /**
   * Disconnect from storage (no-op for database adapter)
   */
  async disconnect(): Promise<void> {
    // Database connection is managed by TypeORM, no explicit disconnect needed
  }
}
