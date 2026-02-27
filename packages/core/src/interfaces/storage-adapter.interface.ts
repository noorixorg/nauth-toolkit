/**
 * Storage adapter interface for shared state management
 * Critical for multi-server deployments
 */
export interface StorageAdapter {
  /**
   * Initialize the storage adapter
   */
  initialize(): Promise<void>;

  /**
   * Check if adapter is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Basic key-value operations
   */
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number, options?: { nx?: boolean }): Promise<string | null | void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  /**
   * Atomic operations
   */
  incr(key: string, ttlSeconds?: number): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;

  /**
   * Hash operations (for complex data structures)
   */
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;

  /**
   * List operations (for token families)
   */
  lpush(key: string, value: string): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  llen(key: string): Promise<number>;

  /**
   * Pattern operations
   */
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, pattern: string, count: number): Promise<[number, string[]]>;

  /**
   * Cleanup and disconnect
   */
  cleanup(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Rate limiting specific operations
 */
export interface RateLimitStorage {
  incrementRateLimit(identifier: string, endpoint: string, windowMs: number): Promise<number>;
  getRateLimit(identifier: string, endpoint: string): Promise<number>;
  resetRateLimit(identifier: string, endpoint: string): Promise<void>;
}

/**
 * Account lockout specific operations
 *
 * SECURITY: Uses IP addresses instead of user identifiers to prevent
 * attackers from locking out legitimate users by guessing their email/username.
 */
export interface AccountLockoutStorage {
  /**
   * Record a failed login attempt for an IP address.
   *
   * SECURITY NOTE:
   * Use an expiry window to prevent counters from accumulating indefinitely, which can cause
   * unexpected lockouts long after the original failures.
   *
   * @param ipAddress - IP address that made the failed attempt
   * @param ttlSeconds - Optional TTL (seconds) applied when the counter key is first created
   * @returns Number of failed attempts for this IP within the active window
   */
  recordFailedAttempt(ipAddress: string, ttlSeconds?: number): Promise<number>;
  getFailedAttempts(ipAddress: string): Promise<number>;
  isAccountLocked(ipAddress: string): Promise<boolean>;
  lockIpAddress(ipAddress: string, duration: number, reason: string): Promise<void>;
  unlockIpAddress(ipAddress: string): Promise<void>;
  resetFailedAttempts(ipAddress: string): Promise<void>;
}
