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
 * Check whether an unknown error is a Node "MODULE_NOT_FOUND" for a specific module.
 *
 * We intentionally match by both error code and the module name inside the message to avoid
 * incorrectly catching nested missing modules.
 *
 * @param error - Unknown caught error
 * @param moduleName - The module name we expect to be missing (e.g. '@nauth-toolkit/storage-database')
 * @returns True if this error represents "moduleName is not installed"
 */
function isModuleNotFoundFor(error: unknown, moduleName: string): boolean {
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
  // Lazy import to avoid bundling if not used.
  // ⚠️ Note: This adapter lives in a separate package and must be installed by the consumer app.
  let DatabaseStorageAdapterCtor: new (
    rateLimitRepo: unknown,
    storageLockRepo: unknown,
    logger: unknown,
  ) => StorageAdapter;

  try {
    const mod = require('@nauth-toolkit/storage-database') as { DatabaseStorageAdapter: typeof DatabaseStorageAdapterCtor };
    DatabaseStorageAdapterCtor = mod.DatabaseStorageAdapter;
  } catch (error: unknown) {
    if (isModuleNotFoundFor(error, '@nauth-toolkit/storage-database')) {
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
    throw error;
  }

  // Repositories are injected by AuthModule via setRepositories (when available).
  return new DatabaseStorageAdapterCtor(null, null, null);
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
  // Lazy import to avoid bundling if not used.
  // ⚠️ Note: This adapter + the redis client are separate deps that must be installed by the consumer app.
  let RedisStorageAdapterCtor: new (redisClient: unknown) => StorageAdapter;
  try {
    const mod = require('@nauth-toolkit/storage-redis') as { RedisStorageAdapter: typeof RedisStorageAdapterCtor };
    RedisStorageAdapterCtor = mod.RedisStorageAdapter;
  } catch (error: unknown) {
    if (isModuleNotFoundFor(error, '@nauth-toolkit/storage-redis')) {
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
    throw error;
  }

  let createClientFn: (options: { url: string }) => unknown;
  try {
    const redisMod = require('redis') as { createClient: typeof createClientFn };
    createClientFn = redisMod.createClient;
  } catch (error: unknown) {
    if (isModuleNotFoundFor(error, 'redis')) {
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
    throw error;
  }

  const redisClient = createClientFn({ url });

  // Don't connect here - let adapter.initialize() handle connection
  // This ensures proper error handling and allows initialize() to wait for connection

  return new RedisStorageAdapterCtor(redisClient);
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
  // Lazy import to avoid bundling if not used.
  // ⚠️ Note: This adapter + the redis client are separate deps that must be installed by the consumer app.
  let RedisStorageAdapterCtor: new (redisClient: unknown) => StorageAdapter;
  try {
    const mod = require('@nauth-toolkit/storage-redis') as { RedisStorageAdapter: typeof RedisStorageAdapterCtor };
    RedisStorageAdapterCtor = mod.RedisStorageAdapter;
  } catch (error: unknown) {
    if (isModuleNotFoundFor(error, '@nauth-toolkit/storage-redis')) {
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
    throw error;
  }

  let createClusterFn: (options: { rootNodes: Array<{ url: string }> }) => unknown;
  try {
    const redisMod = require('redis') as { createCluster: typeof createClusterFn };
    createClusterFn = redisMod.createCluster;
  } catch (error: unknown) {
    if (isModuleNotFoundFor(error, 'redis')) {
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
    throw error;
  }

  const clusterClient = createClusterFn({
    rootNodes: nodes,
  });

  // Don't connect here - let adapter.initialize() handle connection
  // This ensures proper error handling and allows initialize() to wait for connection

  return new RedisStorageAdapterCtor(clusterClient);
}
