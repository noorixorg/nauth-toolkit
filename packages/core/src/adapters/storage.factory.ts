/**
 * Storage Adapter Factory Functions
 *
 * Provides clean factory functions for creating storage adapters.
 * These factories handle proper initialization and simplify configuration.
 *
 * @example
 * ```typescript
 * import { createDatabaseStorageAdapter, createRedisStorageAdapter } from '@nauth-toolkit/express';
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

import { StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Create a database storage adapter
 *
 * Uses the existing TypeORM connection. Make sure storage entities are included
 * in your DataSource configuration:
 *
 * ```typescript
 * import { getNAuthStorageEntities } from '@nauth-toolkit/database-typeorm-postgres';
 * const dataSource = new DataSource({
 *   entities: [...getNAuthEntities(), ...getNAuthStorageEntities()],
 * });
 * ```
 *
 * @returns DatabaseStorageAdapter instance
 *
 * @example
 * ```typescript
 * import { createDatabaseStorageAdapter } from '@nauth-toolkit/express';
 *
 * export const authConfig = {
 *   storageAdapter: createDatabaseStorageAdapter(),
 *   // ... other config
 * };
 * ```
 */
export function createDatabaseStorageAdapter(): StorageAdapter {
  // Lazy import to avoid bundling if not used
  const { DatabaseStorageAdapter } = require('@nauth-toolkit/storage-database');
  return new DatabaseStorageAdapter(null, null, null);
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
 * import { createRedisStorageAdapter, createRedisClusterAdapter } from '@nauth-toolkit/express';
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
  // Lazy import to avoid bundling if not used
  const { RedisStorageAdapter } = require('@nauth-toolkit/storage-redis');
  const { createClient } = require('redis');

  const redisClient = createClient({ url });

  // Don't connect here - let adapter.initialize() handle connection
  // This ensures proper error handling and allows initialize() to wait for connection

  return new RedisStorageAdapter(redisClient);
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
 * import { createRedisClusterAdapter } from '@nauth-toolkit/express';
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
  // Lazy import to avoid bundling if not used
  const { RedisStorageAdapter } = require('@nauth-toolkit/storage-redis');
  const { createCluster } = require('redis');

  const clusterClient = createCluster({
    rootNodes: nodes,
  });

  // Don't connect here - let adapter.initialize() handle connection
  // This ensures proper error handling and allows initialize() to wait for connection

  return new RedisStorageAdapter(clusterClient);
}
