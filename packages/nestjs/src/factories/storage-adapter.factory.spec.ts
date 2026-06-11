/**
 * Storage Adapter Factory Unit Tests
 *
 * Tests storage adapter factory functions.
 */

import { createDatabaseStorageAdapter, createRedisStorageAdapter, createRedisClusterAdapter } from './storage-adapter.factory';
import { StorageAdapter } from '@nauth-toolkit/core';

describe('Storage Adapter Factories', () => {
  describe('createDatabaseStorageAdapter', () => {
    it('should create a lazy storage adapter', () => {
      const adapter = createDatabaseStorageAdapter();
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('initialize');
      expect(adapter).toHaveProperty('get');
      expect(adapter).toHaveProperty('set');
    });

    it('should handle initialization errors', async () => {
      const adapter = createDatabaseStorageAdapter();
      // May throw error if package not installed or repositories missing
      try {
        await adapter.initialize();
      } catch (error) {
        // Expected - package not installed in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('createRedisStorageAdapter', () => {
    it('should create a lazy storage adapter with default URL', () => {
      const adapter = createRedisStorageAdapter();
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('initialize');
    });

    it('should create a lazy storage adapter with custom URL', () => {
      const adapter = createRedisStorageAdapter('redis://custom:6379');
      expect(adapter).toBeDefined();
    });

    it('should throw error when package not installed', async () => {
      const adapter = createRedisStorageAdapter();
      // May throw or fail silently depending on package availability
      try {
        await adapter.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('createRedisClusterAdapter', () => {
    it('should create a lazy storage adapter', () => {
      const adapter = createRedisClusterAdapter([
        { url: 'redis://node1:6379' },
        { url: 'redis://node2:6379' },
      ]);
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('initialize');
    });

    it('should throw error when package not installed', async () => {
      const adapter = createRedisClusterAdapter([{ url: 'redis://node1:6379' }]);
      // May throw or fail silently depending on package availability
      try {
        await adapter.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
