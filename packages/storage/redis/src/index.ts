/**
 * Redis Storage Adapter Package
 *
 * Provides RedisStorageAdapter for high-performance transient state storage
 * using the `redis` package (node-redis). Supports both single-instance Redis
 * and Redis Cluster for high-availability production deployments.
 *
 * @example
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
 */

export { RedisStorageAdapter } from './redis-storage.adapter';
export { RedisClientLike } from './redis-client.interface';
