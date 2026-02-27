import { StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Internal structure for storing values with optional expiration
 */
interface StoredValue {
  value: string;
  expiresAt?: number; // Unix timestamp in milliseconds
}

/**
 * In-memory storage adapter for development and single-server deployments
 *
 * CRITICAL LIMITATIONS FOR PRODUCTION:
 * - Data is lost on server restart
 * - Data is NOT shared across multiple server instances/containers
 * - Rate limiting may be bypassed in ECS/multi-container deployments
 * - NOT suitable for production clusters with multiple containers
 *
 * RECOMMENDATIONS:
 * - Single ECS task: Acceptable (data lost on restart)
 * - Multi-task/container ECS: Use Redis adapter (coming soon)
 * - Production: Plan to implement Redis-backed storage adapter
 *
 * CURRENT BEHAVIOR:
 * Rate limiting works per-container, not globally across containers
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorageAdapter();
 * await storage.initialize();
 * await storage.set('key', 'value', 60); // Set with 60 second TTL
 * const value = await storage.get('key');
 * ```
 */
export class MemoryStorageAdapter implements StorageAdapter {
  // Main key-value store with expiration support
  private store: Map<string, StoredValue> = new Map();

  // Hash storage for complex data structures (similar to Redis hashes)
  private hashes: Map<string, Map<string, string>> = new Map();

  // List storage for ordered collections (similar to Redis lists)
  private lists: Map<string, string[]> = new Map();

  // Interval timer for automatic cleanup of expired keys
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the storage adapter
   * Starts a background cleanup job to remove expired keys
   */
  async initialize(): Promise<void> {
    // Start cleanup interval to remove expired keys every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // 60,000ms = 1 minute
  }

  /**
   * Check if the storage adapter is healthy and operational
   * @returns Always returns true for in-memory storage
   */
  async isHealthy(): Promise<boolean> {
    return true;
  }

  // ============================================================================
  // Basic Key-Value Operations
  // ============================================================================

  /**
   * Get a value by key
   * Automatically removes and returns null if the key has expired
   *
   * @param key - The key to retrieve
   * @returns The stored value or null if not found/expired
   */
  async get(key: string): Promise<string | null> {
    const stored = this.store.get(key);

    // Key doesn't exist
    if (!stored) return null;

    // Check if key has expired
    if (stored.expiresAt && stored.expiresAt < Date.now()) {
      this.store.delete(key); // Clean up expired key
      return null;
    }

    return stored.value;
  }

  /**
   * Set a key-value pair with optional TTL (time to live)
   *
   * @param key - The key to store
   * @param value - The value to store
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttlSeconds?: number, options?: { nx?: boolean }): Promise<string | null> {
    // For NX option, check if key exists and is not expired
    if (options?.nx) {
      const existing = this.store.get(key);
      if (existing) {
        // Check if existing key is expired
        if (existing.expiresAt && existing.expiresAt < Date.now()) {
          // Key exists but is expired - treat as non-existent and allow set
          this.store.delete(key);
        } else {
          // Key exists and is not expired - NX failed
          return null;
        }
      }
    }

    const stored: StoredValue = { value };

    // If TTL is provided, calculate expiration timestamp
    if (ttlSeconds) {
      stored.expiresAt = Date.now() + ttlSeconds * 1000; // Convert seconds to milliseconds
    }

    this.store.set(key, stored);
    return value;
  }

  /**
   * Delete a key from storage
   * @param key - The key to delete
   */
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Check if a key exists and is not expired
   * @param key - The key to check
   * @returns True if key exists and is valid, false otherwise
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
   * If the key doesn't exist, it's initialized to 0 before incrementing
   * Preserves TTL if the key already exists with an expiration
   *
   * @param key - The key to increment
   * @param ttlSeconds - Optional TTL in seconds to set when creating a new key (only applied if key doesn't exist)
   * @returns The new value after incrementing
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const stored = this.store.get(key);

    // Check if key exists and is not expired
    let currentValue = '0';
    let existingExpiry: number | undefined;
    const wasNewKey = !stored || (stored.expiresAt && stored.expiresAt < Date.now());

    if (stored) {
      if (stored.expiresAt && stored.expiresAt < Date.now()) {
        // Key expired - treat as non-existent
        this.store.delete(key);
      } else {
        // Key exists and is valid - preserve expiry
        currentValue = stored.value;
        existingExpiry = stored.expiresAt;
      }
    }

    const newValue = (parseInt(currentValue || '0', 10) + 1).toString();
    const newStored: StoredValue = { value: newValue };

    // Use provided TTL for new keys, otherwise preserve existing expiry
    if (wasNewKey && ttlSeconds !== undefined) {
      newStored.expiresAt = Date.now() + ttlSeconds * 1000;
    } else if (existingExpiry) {
      newStored.expiresAt = existingExpiry;
    }

    this.store.set(key, newStored);
    return parseInt(newValue, 10);
  }

  /**
   * Decrement a counter stored at key
   * If the key doesn't exist, it's initialized to 0 before decrementing
   *
   * @param key - The key to decrement
   * @returns The new value after decrementing
   */
  async decr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = (parseInt(current || '0', 10) - 1).toString();
    await this.set(key, newValue);
    return parseInt(newValue, 10);
  }

  /**
   * Set expiration time on an existing key
   * @param key - The key to set expiration on
   * @param ttl - Time to live in seconds
   */
  async expire(key: string, ttl: number): Promise<void> {
    const stored = this.store.get(key);
    if (stored) {
      stored.expiresAt = Date.now() + ttl * 1000; // Convert to milliseconds
      this.store.set(key, stored);
    }
  }

  /**
   * Get the time to live (TTL) for a key
   * @param key - The key to check
   * @returns Seconds until expiration, -1 if no expiration, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    const stored = this.store.get(key);

    // Key doesn't exist
    if (!stored) return -2;

    // Key exists but has no expiration
    if (!stored.expiresAt) return -1;

    // Calculate remaining seconds
    const remaining = Math.floor((stored.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // Return -2 if already expired
  }

  // ============================================================================
  // Hash Operations (for complex data structures)
  // ============================================================================

  /**
   * Get a field value from a hash
   * @param key - Hash key
   * @param field - Field name
   * @returns Field value or null if not found
   */
  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    return hash?.get(field) ?? null;
  }

  /**
   * Set a field value in a hash
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    hash.set(field, value);
  }

  /**
   * Get all fields and values from a hash
   * @param key - Hash key
   * @returns Object with all field-value pairs
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};

    return Object.fromEntries(hash.entries());
  }

  /**
   * Delete one or more fields from a hash
   * @param key - Hash key
   * @param fields - Field names to delete
   * @returns Number of fields deleted
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) {
        deleted++;
      }
    }

    // Clean up empty hash
    if (hash.size === 0) {
      this.hashes.delete(key);
    }

    return deleted;
  }

  // ============================================================================
  // List Operations (for ordered collections)
  // ============================================================================

  /**
   * Push value to the left (beginning) of a list
   * @param key - List key
   * @param value - Value to push
   */
  async lpush(key: string, value: string): Promise<void> {
    let list = this.lists.get(key);
    if (!list) {
      list = [];
      this.lists.set(key, list);
    }
    list.unshift(value); // Add to beginning
  }

  /**
   * Get a range of elements from a list
   * @param key - List key
   * @param start - Start index (0-based)
   * @param stop - Stop index (-1 for end of list)
   * @returns Array of values in range
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key);
    if (!list) return [];

    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  /**
   * Get the length of a list
   * @param key - List key
   * @returns List length
   */
  async llen(key: string): Promise<number> {
    const list = this.lists.get(key);
    return list?.length ?? 0;
  }

  // ============================================================================
  // Pattern Operations (for bulk operations)
  // ============================================================================

  /**
   * Find all keys matching a pattern
   * @param pattern - Glob pattern (* and ? wildcards supported)
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    const regex = this.patternToRegex(pattern);
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  }

  /**
   * Iterate over keys matching a pattern (cursor-based)
   * @param cursor - Cursor position (0 to start)
   * @param pattern - Glob pattern
   * @param count - Number of keys to return
   * @returns Tuple of [new cursor, keys array]
   */
  async scan(cursor: number, pattern: string, count: number): Promise<[number, string[]]> {
    const allKeys = await this.keys(pattern);
    const start = cursor;
    const end = Math.min(cursor + count, allKeys.length);
    const keys = allKeys.slice(start, end);
    const newCursor = end >= allKeys.length ? 0 : end;
    return [newCursor, keys];
  }

  // ============================================================================
  // Cleanup & Lifecycle
  // ============================================================================

  /**
   * Run cleanup of expired keys
   */
  async cleanup(): Promise<void> {
    this.cleanupExpired();
  }

  /**
   * Disconnect and cleanup all resources
   */
  async disconnect(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all storage
    this.store.clear();
    this.hashes.clear();
    this.lists.clear();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Remove all expired keys from storage
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Find all expired keys
    for (const [key, stored] of this.store.entries()) {
      if (stored.expiresAt && stored.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    // Delete expired keys
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }

  /**
   * Convert a glob pattern to a regular expression
   * @param pattern - Glob pattern (* and ? wildcards)
   * @returns RegExp for pattern matching
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape regex special characters except * and ?
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // Convert glob wildcards to regex
    const regex = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');

    return new RegExp(`^${regex}$`);
  }
}
