/**
 * Storage Factory Unit Tests
 *
 * Tests storage adapter factory functions including:
 * - Database storage adapter creation
 * - Redis storage adapter creation
 * - Redis cluster adapter creation
 * - Factory function return types
 */

import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { createDatabaseStorageAdapter, createRedisStorageAdapter, createRedisClusterAdapter } from './storage.factory';

describe('Storage Factory', () => {
  describe('createDatabaseStorageAdapter', () => {
    it('should return a StorageAdapter instance', () => {
      const adapter = createDatabaseStorageAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.initialize).toBe('function');
      expect(typeof adapter.isHealthy).toBe('function');
      expect(typeof adapter.get).toBe('function');
      expect(typeof adapter.set).toBe('function');
      expect(typeof adapter.del).toBe('function');
    });

    it('should return adapter that implements StorageAdapter interface', () => {
      const adapter = createDatabaseStorageAdapter();
      expect(adapter).toHaveProperty('initialize');
      expect(adapter).toHaveProperty('isHealthy');
      expect(adapter).toHaveProperty('get');
      expect(adapter).toHaveProperty('set');
      expect(adapter).toHaveProperty('del');
      expect(adapter).toHaveProperty('exists');
      expect(adapter).toHaveProperty('incr');
      expect(adapter).toHaveProperty('decr');
      expect(adapter).toHaveProperty('expire');
      expect(adapter).toHaveProperty('ttl');
      expect(adapter).toHaveProperty('hget');
      expect(adapter).toHaveProperty('hset');
      expect(adapter).toHaveProperty('hgetall');
      expect(adapter).toHaveProperty('hdel');
      expect(adapter).toHaveProperty('lpush');
      expect(adapter).toHaveProperty('lrange');
      expect(adapter).toHaveProperty('llen');
      expect(adapter).toHaveProperty('keys');
      expect(adapter).toHaveProperty('scan');
      expect(adapter).toHaveProperty('cleanup');
      expect(adapter).toHaveProperty('disconnect');
    });

    it('should support setLogger method', () => {
      const adapter = createDatabaseStorageAdapter();
      expect(typeof (adapter as any).setLogger).toBe('function');
    });

    it('should support setRepositories method', () => {
      const adapter = createDatabaseStorageAdapter();
      expect(typeof (adapter as any).setRepositories).toBe('function');
    });
  });

  describe('createRedisStorageAdapter', () => {
    it('should return a StorageAdapter instance with default URL', () => {
      const adapter = createRedisStorageAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.initialize).toBe('function');
    });

    it('should return a StorageAdapter instance with custom URL', () => {
      const adapter = createRedisStorageAdapter('redis://localhost:6379');
      expect(adapter).toBeDefined();
      expect(typeof adapter.initialize).toBe('function');
    });

    it('should return adapter that implements StorageAdapter interface', () => {
      const adapter = createRedisStorageAdapter();
      expect(adapter).toHaveProperty('initialize');
      expect(adapter).toHaveProperty('isHealthy');
      expect(adapter).toHaveProperty('get');
      expect(adapter).toHaveProperty('set');
    });

    it('should support setLogger method', () => {
      const adapter = createRedisStorageAdapter();
      expect(typeof (adapter as any).setLogger).toBe('function');
    });

    it('should support setRepositories method', () => {
      const adapter = createRedisStorageAdapter();
      expect(typeof (adapter as any).setRepositories).toBe('function');
    });
  });

  describe('createRedisClusterAdapter', () => {
    it('should return a StorageAdapter instance', () => {
      const nodes = [{ url: 'redis://node1:6379' }, { url: 'redis://node2:6379' }];
      const adapter = createRedisClusterAdapter(nodes);
      expect(adapter).toBeDefined();
      expect(typeof adapter.initialize).toBe('function');
    });

    it('should return adapter that implements StorageAdapter interface', () => {
      const nodes = [{ url: 'redis://node1:6379' }];
      const adapter = createRedisClusterAdapter(nodes);
      expect(adapter).toHaveProperty('initialize');
      expect(adapter).toHaveProperty('isHealthy');
      expect(adapter).toHaveProperty('get');
      expect(adapter).toHaveProperty('set');
    });

    it('should support setLogger method', () => {
      const nodes = [{ url: 'redis://node1:6379' }];
      const adapter = createRedisClusterAdapter(nodes);
      expect(typeof (adapter as any).setLogger).toBe('function');
    });

    it('should support setRepositories method', () => {
      const nodes = [{ url: 'redis://node1:6379' }];
      const adapter = createRedisClusterAdapter(nodes);
      expect(typeof (adapter as any).setRepositories).toBe('function');
    });
  });
});
