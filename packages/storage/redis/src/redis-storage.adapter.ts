import { StorageAdapter, NAuthException, AuthErrorCode, LoggerService } from '@nauth-toolkit/core';
import { RedisClientLike } from './redis-client.interface';

/**
 * Redis Storage Adapter
 *
 * Implements StorageAdapter interface using the `redis` package (node-redis).
 *
 * **Key Features:**
 * - Uses node-redis package (redis)
 * - Supports both single-instance Redis and Redis Cluster
 * - Automatic key prefixing: all keys prefixed with `nauth_` to avoid collisions
 * - Multi-server compatible (shared Redis instance/cluster)
 * - Native TTL support via Redis EXPIRE
 * - High performance for transient state
 * - Production-ready with Redis Cluster support for high-availability deployments
 *
 * **Usage:**
 * ```typescript
 * import { createClient } from 'redis';
 * import { RedisStorageAdapter } from '@nauth-toolkit/storage-redis';
 *
 * const redisClient = createClient({ url: 'redis://localhost:6379' });
 * await redisClient.connect();
 *
 * AuthModule.forRoot({
 *   storageAdapter: new RedisStorageAdapter(redisClient),
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Using node-redis (recommended)
 * import { createClient } from 'redis';
 * const client = createClient({ url: 'redis://localhost:6379' });
 * await client.connect();
 * const adapter = new RedisStorageAdapter(client);
 *
 * // Or use the factory function (handles connection automatically)
 * import { createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
 * const adapter = createRedisStorageAdapter('redis://localhost:6379');
 * await adapter.initialize();
 * ```
 */

export class RedisStorageAdapter implements StorageAdapter {
  private readonly keyPrefix = 'nauth_';

  /**
   * Creates a new RedisStorageAdapter instance
   *
   * @param redisClient - Redis client instance from `redis` package (node-redis)
   * @param logger - Logger service for error and debug logging (optional, will be injected by NestJS if not provided)
   * @throws {NAuthException} If client is missing required methods or is invalid
   */
  constructor(
    private readonly redisClient: unknown,
    private logger?: LoggerService,
  ) {
    // Validation deferred to initialize() because:
    // - node-redis v4+ methods are available before connection, but we validate during init
    // - This allows factory to create adapter with unconnected client
    // Logger is optional - will be injected by NestJS when adapter is used as a provider
  }

  /**
   * Validate that the client is a Redis-compatible client
   * Type guard to ensure client implements RedisClientLike interface
   *
   * In node-redis v5+, command methods (get, hget, etc.) are dynamically added
   * and may not be available until after connection. We check for known Redis client
   * indicators instead of individual command methods.
   *
   * @param client - Client instance to validate
   * @throws NAuthException if client doesn't appear to be a Redis client
   */
  private validateClient(client: unknown): asserts client is RedisClientLike {
    if (!client || typeof client !== 'object') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Redis client must be an object instance');
    }

    const clientObj = client as Record<string, unknown>;

    // Check for known Redis client indicators:
    // - node-redis v4+: has sendCommand method
    // - node-redis v5+: has sendCommand or command methods (may be dynamic)
    // - Other Redis clients: typically have sendCommand or ping method

    const hasSendCommand = typeof clientObj.sendCommand === 'function';
    const hasPing = typeof clientObj.ping === 'function';
    const hasGet = typeof clientObj.get === 'function';

    // At least one of these should exist for a valid Redis client
    if (!hasSendCommand && !hasPing && !hasGet) {
      // Additional check: some clients expose connect/command methods even before connection
      const hasConnect = typeof clientObj.connect === 'function';
      const hasCommand = typeof (clientObj as { command?: unknown }).command === 'function';

      if (!hasConnect && !hasCommand) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Invalid Redis client. Expected a node-redis client instance. ' +
            'Client should have methods like sendCommand, ping, get, or connect. ' +
            `Received: ${clientObj.constructor?.name || typeof client}. ` +
            'Use createClient from the "redis" package or createRedisStorageAdapter() factory function.',
        );
      }
    }

    // Note: We don't validate individual command methods here because:
    // 1. node-redis v5+ adds them dynamically
    // 2. They're accessed via Proxy or similar mechanism
    // 3. Actual method availability is verified during runtime calls
  }

  /**
   * Set logger instance (called by AuthModule to inject logger after factory creation)
   *
   * @param logger - Logger service instance
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Get prefixed key to avoid collisions with other application keys
   *
   * @param key - Original key
   * @returns Prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Initialize the storage adapter
   * Performs health check via PING command
   * Connects the Redis client if not already connected (node-redis v4+)
   *
   * @throws {NAuthException} If Redis connection health check fails or client is invalid
   */
  async initialize(): Promise<void> {
    // Validate client before attempting connection
    this.validateClient(this.redisClient);

    try {
      // Ensure Redis client is connected (for node-redis v4+)
      const client = this.redisClient as RedisClientLike & { connect?: () => Promise<void> };
      if (client.connect && typeof client.connect === 'function') {
        // Attempt to connect (safe to call multiple times - will handle already-connected state)
        // Must call connect() on the client object to preserve 'this' context
        try {
          if (this.logger?.debug) {
            this.logger.debug('Connecting Redis client...');
          }
          await client.connect();
        } catch (connectError: unknown) {
          // Ignore "already connected" errors - client might already be connected
          const errorMsg = connectError instanceof Error ? connectError.message : String(connectError);
          if (!errorMsg.includes('already') && !errorMsg.includes('connected')) {
            // Re-throw non-connection errors
            throw connectError;
          }
        }
      }

      const healthy = await this.isHealthy();
      if (!healthy) {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Redis connection health check failed');
      }
      if (this.logger) {
        this.logger.log('RedisStorageAdapter initialized successfully');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to initialize RedisStorageAdapter', error);
      }
      throw error;
    }
  }

  /**
   * Check if the storage adapter is healthy
   * Uses PING command to verify Redis connectivity
   *
   * @returns True if Redis is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      const client = this.redisClient as RedisClientLike;
      await client.ping();
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error('RedisStorageAdapter health check failed', error);
      }
      return false;
    }
  }

  // ============================================================================
  // Basic Key-Value Operations
  // ============================================================================

  /**
   * Get a value by key
   *
   * @param key - The key to retrieve
   * @returns The stored value or null if not found
   */
  async get(key: string): Promise<string | null> {
    const client = this.redisClient as RedisClientLike;
    return await client.get(this.getPrefixedKey(key));
  }

  /**
   * Set a key-value pair with optional TTL (time to live)
   *
   * @param key - The key to store
   * @param value - The value to store
   * @param ttlSeconds - Time to live in seconds (optional)
   * @param options - Additional options like nx (set if not exists)
   * @returns The value if set successfully, null if nx is true and key already exists
   */
  async set(key: string, value: string, ttlSeconds?: number, options?: { nx?: boolean }): Promise<string | null> {
    const client = this.redisClient as RedisClientLike;
    const prefixedKey = this.getPrefixedKey(key);

    if (options?.nx) {
      // Use SET with NX option (only set if key does not exist)
      // Redis SET key value NX EX seconds - returns 'OK' if set, null if key exists
      // node-redis (redis package): SET key value { EX: seconds, NX: true }
      const setOptions: { NX?: boolean; EX?: number } = { NX: true };
      if (ttlSeconds) {
        setOptions.EX = ttlSeconds;
      }

      const result = await client.set(prefixedKey, value, setOptions);
      // Redis returns 'OK' on success, null on failure (key exists)
      return result === 'OK' ? value : null;
    } else {
      // Regular SET operation (overwrites existing key)
      if (ttlSeconds) {
        // node-redis supports { EX: seconds } option
        await client.set(prefixedKey, value, { EX: ttlSeconds });
      } else {
        await client.set(prefixedKey, value);
      }
      return value;
    }
  }

  /**
   * Delete a key from storage
   *
   * @param key - The key to delete
   */
  async del(key: string): Promise<void> {
    const client = this.redisClient as RedisClientLike;
    await client.del(this.getPrefixedKey(key));
  }

  /**
   * Check if a key exists
   *
   * @param key - The key to check
   * @returns True if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    const client = this.redisClient as RedisClientLike;
    const result = await client.exists(this.getPrefixedKey(key));

    // Handle both boolean (ioredis) and number (redis) return types
    return typeof result === 'boolean' ? result : result > 0;
  }

  // ============================================================================
  // Atomic Operations (for counters and rate limiting)
  // ============================================================================

  /**
   * Increment a counter stored at key
   * Uses Redis native INCR for atomic operation
   *
   * @param key - The key to increment
   * @param ttlSeconds - Optional TTL in seconds to set when creating a new key (only applied if key doesn't exist)
   * @returns The new value after incrementing
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const client = this.redisClient as RedisClientLike;
    const prefixedKey = this.getPrefixedKey(key);

    // Check if key exists to determine if we should set TTL
    const exists = await client.exists(prefixedKey);
    const value = await client.incr(prefixedKey);

    // If key didn't exist before incrementing (value is now 1) and TTL provided, set expiration
    if (ttlSeconds !== undefined && exists === 0 && value === 1) {
      await client.expire(prefixedKey, ttlSeconds);
    }

    return value;
  }

  /**
   * Decrement a counter stored at key
   * Uses Redis native DECR for atomic operation
   *
   * @param key - The key to decrement
   * @returns The new value after decrementing
   */
  async decr(key: string): Promise<number> {
    const client = this.redisClient as RedisClientLike;
    return await client.decr(this.getPrefixedKey(key));
  }

  /**
   * Set expiration time on an existing key
   *
   * @param key - The key to set expiration on
   * @param ttl - Time to live in seconds
   */
  async expire(key: string, ttl: number): Promise<void> {
    const client = this.redisClient as RedisClientLike;
    await client.expire(this.getPrefixedKey(key), ttl);
  }

  /**
   * Get the time to live (TTL) for a key
   *
   * @param key - The key to check
   * @returns Seconds until expiration, -1 if no expiration, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    const client = this.redisClient as RedisClientLike;
    return await client.ttl(this.getPrefixedKey(key));
  }

  // ============================================================================
  // Hash Operations
  // ============================================================================

  /**
   * Get a field value from a hash
   *
   * @param key - Hash key
   * @param field - Field name
   * @returns Field value or null if not found
   */
  async hget(key: string, field: string): Promise<string | null> {
    const client = this.redisClient as RedisClientLike;
    return await client.hget(this.getPrefixedKey(key), field);
  }

  /**
   * Set a field value in a hash
   *
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    const client = this.redisClient as RedisClientLike;
    await client.hset(this.getPrefixedKey(key), field, value);
  }

  /**
   * Get all fields and values from a hash
   *
   * @param key - Hash key
   * @returns Object with all field-value pairs
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    const client = this.redisClient as RedisClientLike;
    return await client.hgetall(this.getPrefixedKey(key));
  }

  /**
   * Delete one or more fields from a hash
   *
   * @param key - Hash key
   * @param fields - Field names to delete
   * @returns Number of fields deleted
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const client = this.redisClient as RedisClientLike;
    return await client.hdel(this.getPrefixedKey(key), ...fields);
  }

  // ============================================================================
  // List Operations
  // ============================================================================

  /**
   * Push value to the left (beginning) of a list
   *
   * @param key - List key
   * @param value - Value to push
   */
  async lpush(key: string, value: string): Promise<void> {
    const client = this.redisClient as RedisClientLike;
    await client.lpush(this.getPrefixedKey(key), value);
  }

  /**
   * Get a range of elements from a list
   *
   * @param key - List key
   * @param start - Start index (0-based)
   * @param stop - Stop index (-1 for end of list)
   * @returns Array of values in range
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = this.redisClient as RedisClientLike;
    return await client.lrange(this.getPrefixedKey(key), start, stop);
  }

  /**
   * Get the length of a list
   *
   * @param key - List key
   * @returns List length
   */
  async llen(key: string): Promise<number> {
    const client = this.redisClient as RedisClientLike;
    return await client.llen(this.getPrefixedKey(key));
  }

  // ============================================================================
  // Pattern Operations
  // ============================================================================

  /**
   * Find all keys matching a pattern
   * Uses SCAN under the hood to avoid blocking the Redis server.
   *
   * @param pattern - Glob pattern (* and ? wildcards)
   * @returns Array of matching keys (without prefix)
   */
  async keys(pattern: string): Promise<string[]> {
    // Implement using iterative SCAN to avoid blocking in production
    const allKeys: string[] = [];
    let cursor = 0;
    const countPerScan = 1000;
    do {
      const [nextCursor, keys] = await this.scan(cursor, pattern, countPerScan);
      cursor = nextCursor;
      if (keys && keys.length > 0) {
        allKeys.push(...keys);
      }
    } while (cursor !== 0);

    return allKeys;
  }

  /**
   * Iterate over keys matching a pattern (cursor-based)
   * Uses Redis SCAN command (recommended for production)
   *
   * @param cursor - Cursor position (0 to start)
   * @param pattern - Glob pattern
   * @param count - Number of keys to return per iteration
   * @returns Tuple of [new cursor, keys array] (keys without prefix)
   */
  async scan(cursor: number, pattern: string, count: number): Promise<[number, string[]]> {
    const client = this.redisClient as RedisClientLike;
    const prefixedPattern = `${this.keyPrefix}${pattern}`;

    // node-redis takes the cursor as a string and the modifiers as an options object.
    // The variadic `scan(cursor, 'MATCH', pattern, 'COUNT', count)` form is ioredis's,
    // and node-redis v5 rejects it outright: its encoder requires every argument to be
    // a string or Buffer, so a numeric cursor throws before the command is sent.
    const result = await client.scan(String(cursor), { MATCH: prefixedPattern, COUNT: count });

    // Handle both array format [cursor, keys] and object format { cursor, keys }
    let newCursor: number;
    let keys: string[];

    if (Array.isArray(result)) {
      newCursor = Number(result[0]);
      keys = result[1];
    } else {
      // v5 answers with a string cursor, v4 with a number.
      newCursor = Number(result.cursor);
      keys = result.keys || [];
    }

    // Remove prefix from keys
    const unprefixedKeys = keys.map((key: string) => key.replace(new RegExp(`^${this.keyPrefix}`), ''));

    return [newCursor, unprefixedKeys];
  }

  // ============================================================================
  // Cleanup & Lifecycle
  // ============================================================================

  /**
   * Run cleanup of expired keys
   * No-op for Redis (expiration is handled automatically)
   */
  async cleanup(): Promise<void> {
    // Redis handles expiration automatically via TTL
    // No manual cleanup needed
    if (this.logger?.debug) {
      this.logger.debug('RedisStorageAdapter cleanup: expiration handled automatically by Redis');
    }
  }

  /**
   * Disconnect and cleanup all resources
   * No-op for Redis (client connection managed by consumer)
   */
  async disconnect(): Promise<void> {
    // Consumer manages Redis client lifecycle
    // Adapter doesn't own the connection
    if (this.logger?.debug) {
      this.logger.debug('RedisStorageAdapter disconnected');
    }
  }
}
