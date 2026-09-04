/**
 * Redis Client Interface
 *
 * Minimal interface for Redis clients from the `redis` package (node-redis).
 * Supports both single-instance Redis clients and Redis Cluster clients.
 *
 * Consumer applications must provide a Redis client instance from the `redis` package.
 * Works with:
 * - `redis` package (node-redis v5+) - single instance
 * - `redis` package (node-redis v5+) - Redis Cluster via createCluster()
 * - Dragonfly (Redis-protocol compatible, works with same client)
 */
export interface RedisClientLike {
  /**
   * Get a value by key
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a key-value pair with optional expiration
   * node-redis supports { EX: seconds, NX: true } options
   */
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<string | void>;

  /**
   * Delete one or more keys
   */
  del(key: string): Promise<number>;

  /**
   * Increment a counter
   */
  incr(key: string): Promise<number>;

  /**
   * Decrement a counter
   */
  decr(key: string): Promise<number>;

  /**
   * Set expiration time on a key
   * Returns boolean (client may return boolean or number depending on implementation)
   */
  expire(key: string, seconds: number): Promise<boolean | number>;

  /**
   * Check if a key exists
   * Returns number or boolean depending on client
   */
  exists(key: string): Promise<number | boolean>;

  /**
   * Get time to live for a key
   */
  ttl(key: string): Promise<number>;

  /**
   * Iterate the keyspace.
   *
   * node-redis takes the cursor as a string and the modifiers as an options object,
   * and answers `{ cursor, keys }` — a string cursor in v5, a number in v4. The array
   * form is accepted too, for clients that answer the way Redis itself does.
   */
  scan(
    cursor: string,
    options?: { MATCH?: string; COUNT?: number },
  ): Promise<{ cursor: string | number; keys: string[] } | [string | number, string[]]>;

  /**
   * Get a field value from a hash
   */
  hget(key: string, field: string): Promise<string | null>;

  /**
   * Set a field value in a hash
   */
  hset(key: string, field: string, value: string): Promise<number>;

  /**
   * Get all fields and values from a hash
   */
  hgetall(key: string): Promise<Record<string, string>>;

  /**
   * Delete one or more fields from a hash
   */
  hdel(key: string, ...fields: string[]): Promise<number>;

  /**
   * Push value to the left of a list
   */
  lpush(key: string, value: string): Promise<number>;

  /**
   * Get a range of elements from a list
   */
  lrange(key: string, start: number, stop: number): Promise<string[]>;

  /**
   * Get the length of a list
   */
  llen(key: string): Promise<number>;

  /**
   * Ping the Redis server
   */
  ping(): Promise<string>;
}
