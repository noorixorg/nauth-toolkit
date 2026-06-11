/**
 * Storage Adapter Factory Functions
 *
 * Provides clean factory functions for creating storage adapters.
 * These factories handle proper initialization and simplify configuration.
 *
 * @example
 * ```typescript
 * import { createDatabaseStorageAdapter, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
 *
 * export const authConfig = {
 *   // Database adapter (uses existing TypeORM connection)
 *   storageAdapter: createDatabaseStorageAdapter(),
 *
 *   // Or Redis adapter
 *   storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL),
 * };
 * ```
 */

import { StorageAdapter } from '@nauth-toolkit/core';

/**
 * Import an optional dependency at runtime without creating a compile-time dependency.
 *
 * IMPORTANT: moduleName is intentionally typed as `string` to avoid TypeScript errors
 * when the optional package isn't installed.
 */
async function importOptional<TModule>(moduleName: string): Promise<TModule | null> {
  try {
    return (await import(moduleName)) as unknown as TModule;
  } catch {
    return null;
  }
}

/**
 * Lazy storage adapter wrapper.
 *
 * Avoids `require()` while keeping the factory API synchronous for config objects.
 * The real adapter is imported and constructed on the first `initialize()` call.
 */
class LazyStorageAdapter implements StorageAdapter {
  private inner: StorageAdapter | null = null;
  private initPromise: Promise<void> | null = null;
  private logger: unknown = null;
  private repos: { rateLimitRepo: unknown; storageLockRepo: unknown } | null = null;

  constructor(private readonly factory: () => Promise<StorageAdapter>) {}

  // Optional hook used by AuthModule
  setLogger(logger: unknown): void {
    this.logger = logger;
    const maybe = this.inner as unknown as { setLogger?: (l: unknown) => void };
    if (this.inner && typeof maybe.setLogger === 'function') {
      maybe.setLogger(logger);
    }
  }

  // Optional hook used by AuthModule
  setRepositories(rateLimitRepo: unknown, storageLockRepo: unknown): void {
    this.repos = { rateLimitRepo, storageLockRepo };
    const maybe = this.inner as unknown as { setRepositories?: (r: unknown, s: unknown) => void };
    if (this.inner && typeof maybe.setRepositories === 'function') {
      maybe.setRepositories(rateLimitRepo, storageLockRepo);
    }
  }

  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  async isHealthy(): Promise<boolean> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).isHealthy();
  }

  async get(key: string): Promise<string | null> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).get(key);
  }
  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
    options?: { nx?: boolean },
  ): Promise<string | null | void> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).set(key, value, ttlSeconds, options);
  }
  async del(key: string): Promise<void> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).del(key);
  }
  async exists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).exists(key);
  }
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).incr(key, ttlSeconds);
  }
  async decr(key: string): Promise<number> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).decr(key);
  }
  async expire(key: string, ttl: number): Promise<void> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).expire(key, ttl);
  }
  async ttl(key: string): Promise<number> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).ttl(key);
  }
  async hget(key: string, field: string): Promise<string | null> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).hget(key, field);
  }
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).hset(key, field, value);
  }
  async hgetall(key: string): Promise<Record<string, string>> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).hgetall(key);
  }
  async hdel(key: string, ...fields: string[]): Promise<number> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).hdel(key, ...fields);
  }
  async lpush(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).lpush(key, value);
  }
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).lrange(key, start, stop);
  }
  async llen(key: string): Promise<number> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).llen(key);
  }
  async keys(pattern: string): Promise<string[]> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).keys(pattern);
  }
  async scan(cursor: number, pattern: string, count: number): Promise<[number, string[]]> {
    await this.ensureInitialized();
    return await (this.inner as StorageAdapter).scan(cursor, pattern, count);
  }
  async cleanup(): Promise<void> {
    if (!this.inner) return;
    return await this.inner.cleanup();
  }
  async disconnect(): Promise<void> {
    if (!this.inner) return;
    return await this.inner.disconnect();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.inner) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.inner = await this.factory();
        const maybeLoggerAware = this.inner as unknown as { setLogger?: (l: unknown) => void };
        if (this.logger && typeof maybeLoggerAware.setLogger === 'function') {
          maybeLoggerAware.setLogger(this.logger);
        }
        const maybeRepoAware = this.inner as unknown as { setRepositories?: (r: unknown, s: unknown) => void };
        if (this.repos && typeof maybeRepoAware.setRepositories === 'function') {
          maybeRepoAware.setRepositories(this.repos.rateLimitRepo, this.repos.storageLockRepo);
        }
        await this.inner.initialize();
      })();
    }
    await this.initPromise;
  }
}

/**
 * Check whether an unknown error is a Node "MODULE_NOT_FOUND" for a specific module.
 *
 * We intentionally match by both error code and the module name inside the message to avoid
 * incorrectly catching nested missing modules.
 *
 * @param error - Unknown caught error
 * @param moduleName - The module name we expect to be missing (e.g. '@nauth-toolkit/storage-database')
 * @returns True if this error represents "moduleName is not installed"
 */
function _isModuleNotFoundFor(error: unknown, moduleName: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errno = error as NodeJS.ErrnoException;
  if (errno.code !== 'MODULE_NOT_FOUND') {
    return false;
  }

  // Node error messages usually contain: "Cannot find module '<name>'"
  return typeof error.message === 'string' && error.message.includes(`'${moduleName}'`);
}

/**
 * Create a database storage adapter
 *
 * Uses the existing TypeORM connection. Make sure storage entities are included
 * in your TypeORM.forRoot() configuration:
 *
 * ```typescript
 * import { getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';
 * TypeOrmModule.forRoot({
 *   entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
 * });
 * ```
 *
 * @returns DatabaseStorageAdapter instance
 *
 * @example
 * ```typescript
 * import { createDatabaseStorageAdapter } from '@nauth-toolkit/nestjs';
 *
 * export const authConfig = {
 *   storageAdapter: createDatabaseStorageAdapter(),
 *   // ... other config
 * };
 * ```
 */
export function createDatabaseStorageAdapter(): StorageAdapter {
  return new LazyStorageAdapter(async () => {
    type Ctor = new (rateLimitRepo: unknown, storageLockRepo: unknown, logger: unknown) => StorageAdapter;
    type Mod = { DatabaseStorageAdapter: Ctor };
    const mod = await importOptional<Mod>('@nauth-toolkit/storage-database' as string);
    if (!mod) {
      throw new Error(
        [
          'Missing dependency: @nauth-toolkit/storage-database',
          '',
          'You called createDatabaseStorageAdapter(), but the database storage adapter package is not installed.',
          '',
          'Install it:',
          '  yarn add @nauth-toolkit/storage-database',
        ].join('\n'),
      );
    }
    return new mod.DatabaseStorageAdapter(null, null, null);
  });
}

/**
 * Create a Redis storage adapter
 *
 * Creates and connects a Redis client automatically using the `redis` package (node-redis).
 * The client connection is managed internally by the adapter.
 *
 * Supports both single-instance Redis and Redis Cluster configurations.
 *
 * @param url - Redis connection URL (default: 'redis://localhost:6379')
 *   Supports authentication in URL format:
 *   - redis://localhost:6379 (no auth)
 *   - redis://:password@localhost:6379 (password only)
 *   - redis://username:password@localhost:6379 (username + password)
 *   - rediss://localhost:6379 (TLS/SSL, with optional auth)
 * @returns RedisStorageAdapter instance
 *
 * @example
 * ```typescript
 * import { createRedisStorageAdapter, createRedisClusterAdapter } from '@nauth-toolkit/nestjs';
 *
 * export const authConfig = {
 *   // Single-instance Redis
 *   storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL),
 *
 *   // Or Redis Cluster (for production high-availability)
 *   storageAdapter: createRedisClusterAdapter([
 *     { url: 'redis://redis-node-1:6379' },
 *     { url: 'redis://redis-node-2:6379' },
 *     { url: 'redis://redis-node-3:6379' },
 *   ]),
 * };
 * ```
 */
export function createRedisStorageAdapter(url: string = 'redis://localhost:6379'): StorageAdapter {
  return new LazyStorageAdapter(async () => {
    type RedisAdapterMod = { RedisStorageAdapter: new (client: unknown) => StorageAdapter };
    const adapterMod = await importOptional<RedisAdapterMod>('@nauth-toolkit/storage-redis' as string);
    if (!adapterMod) {
      throw new Error(
        [
          'Missing dependency: @nauth-toolkit/storage-redis',
          '',
          'You called createRedisStorageAdapter(), but the Redis storage adapter package is not installed.',
          '',
          'Install it:',
          '  yarn add @nauth-toolkit/storage-redis redis',
        ].join('\n'),
      );
    }

    type RedisClientMod = { createClient: (options: { url: string }) => unknown };
    const redisMod = await importOptional<RedisClientMod>('redis' as string);
    if (!redisMod) {
      throw new Error(
        [
          'Missing dependency: redis',
          '',
          'You called createRedisStorageAdapter(), but the "redis" client package is not installed.',
          '',
          'Install it:',
          '  yarn add redis',
        ].join('\n'),
      );
    }

    const client = redisMod.createClient({ url });
    return new adapterMod.RedisStorageAdapter(client);
  });
}

/**
 * Create a Redis Cluster storage adapter
 *
 * Creates and connects a Redis Cluster client automatically using the `redis` package (node-redis).
 * The cluster client handles automatic topology discovery, command routing, and failover.
 *
 * **Production Use:**
 * Use Redis Cluster for high-availability production deployments. The cluster automatically:
 * - Discovers cluster topology
 * - Routes commands to correct nodes based on key hash slots
 * - Handles node failures and redirects (MOVED/ASK errors)
 * - Provides high availability and horizontal scaling
 *
 * @param nodes - Array of cluster node URLs
 * @returns RedisStorageAdapter instance
 *
 * @example
 * ```typescript
 * import { createRedisClusterAdapter } from '@nauth-toolkit/nestjs';
 *
 * export const authConfig = {
 *   // Redis Cluster with 3 nodes
 *   storageAdapter: createRedisClusterAdapter([
 *     { url: 'redis://redis-node-1:6379' },
 *     { url: 'redis://redis-node-2:6379' },
 *     { url: 'redis://redis-node-3:6379' },
 *   ]),
 * };
 * ```
 */
export function createRedisClusterAdapter(nodes: Array<{ url: string }>): StorageAdapter {
  return new LazyStorageAdapter(async () => {
    type RedisAdapterMod = { RedisStorageAdapter: new (client: unknown) => StorageAdapter };
    const adapterMod = await importOptional<RedisAdapterMod>('@nauth-toolkit/storage-redis' as string);
    if (!adapterMod) {
      throw new Error(
        [
          'Missing dependency: @nauth-toolkit/storage-redis',
          '',
          'You called createRedisClusterAdapter(), but the Redis storage adapter package is not installed.',
          '',
          'Install it:',
          '  yarn add @nauth-toolkit/storage-redis redis',
        ].join('\n'),
      );
    }

    type RedisClientMod = { createCluster: (options: { rootNodes: Array<{ url: string }> }) => unknown };
    const redisMod = await importOptional<RedisClientMod>('redis' as string);
    if (!redisMod) {
      throw new Error(
        [
          'Missing dependency: redis',
          '',
          'You called createRedisClusterAdapter(), but the "redis" client package is not installed.',
          '',
          'Install it:',
          '  yarn add redis',
        ].join('\n'),
      );
    }

    const client = redisMod.createCluster({ rootNodes: nodes });
    return new adapterMod.RedisStorageAdapter(client);
  });
}
