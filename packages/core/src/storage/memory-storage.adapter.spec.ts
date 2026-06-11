/**
 * Memory Storage Adapter Unit Tests
 *
 * Tests in-memory storage adapter functionality including:
 * - Basic key-value operations
 * - TTL and expiration
 * - Atomic operations (incr/decr)
 * - Hash operations
 * - List operations
 * - Pattern matching
 * - Cleanup
 */

import 'reflect-metadata';
import { MemoryStorageAdapter } from './memory-storage.adapter';

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe('initialize', () => {
    it('should start cleanup interval', async () => {
      await adapter.initialize();
      expect(adapter).toBeDefined();
    });
  });

  describe('isHealthy', () => {
    it('should always return true', async () => {
      const healthy = await adapter.isHealthy();
      expect(healthy).toBe(true);
    });
  });

  describe('get and set', () => {
    it('should set and get a value', async () => {
      await adapter.set('key1', 'value1');
      const value = await adapter.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const value = await adapter.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should set value with TTL', async () => {
      await adapter.set('key1', 'value1', 1);
      const value = await adapter.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for expired key', async () => {
      await adapter.set('key1', 'value1', 0.001); // 1ms TTL
      await new Promise((resolve) => setTimeout(resolve, 10));
      const value = await adapter.get('key1');
      expect(value).toBeNull();
    });

    it('should handle NX option - set when key does not exist', async () => {
      const result = await adapter.set('key1', 'value1', undefined, { nx: true });
      expect(result).toBe('value1');
      const value = await adapter.get('key1');
      expect(value).toBe('value1');
    });

    it('should handle NX option - fail when key exists', async () => {
      await adapter.set('key1', 'value1');
      const result = await adapter.set('key1', 'value2', undefined, { nx: true });
      expect(result).toBeNull();
      const value = await adapter.get('key1');
      expect(value).toBe('value1');
    });

    it('should handle NX option with expired key', async () => {
      await adapter.set('key1', 'value1', 0.001);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await adapter.set('key1', 'value2', undefined, { nx: true });
      expect(result).toBe('value2');
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await adapter.set('key1', 'value1');
      await adapter.del('key1');
      const value = await adapter.get('key1');
      expect(value).toBeNull();
    });

    it('should handle deleting non-existent key', async () => {
      await expect(adapter.del('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await adapter.set('key1', 'value1');
      const exists = await adapter.exists('key1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await adapter.exists('nonexistent');
      expect(exists).toBe(false);
    });

    it('should return false for expired key', async () => {
      await adapter.set('key1', 'value1', 0.001);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const exists = await adapter.exists('key1');
      expect(exists).toBe(false);
    });
  });

  describe('incr', () => {
    it('should increment a new key', async () => {
      const value = await adapter.incr('counter');
      expect(value).toBe(1);
    });

    it('should increment an existing key', async () => {
      await adapter.set('counter', '5');
      const value = await adapter.incr('counter');
      expect(value).toBe(6);
    });

    it('should preserve TTL when incrementing existing key', async () => {
      await adapter.set('counter', '5', 60);
      await adapter.incr('counter');
      const ttl = await adapter.ttl('counter');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should set TTL for new key when provided', async () => {
      await adapter.incr('counter', 30);
      const ttl = await adapter.ttl('counter');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30);
    });

    it('should handle expired key as new key', async () => {
      await adapter.set('counter', '5', 0.001);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const value = await adapter.incr('counter');
      expect(value).toBe(1);
    });
  });

  describe('decr', () => {
    it('should decrement a new key', async () => {
      const value = await adapter.decr('counter');
      expect(value).toBe(-1);
    });

    it('should decrement an existing key', async () => {
      await adapter.set('counter', '5');
      const value = await adapter.decr('counter');
      expect(value).toBe(4);
    });
  });

  describe('expire', () => {
    it('should set expiration on existing key', async () => {
      await adapter.set('key1', 'value1');
      await adapter.expire('key1', 60);
      const ttl = await adapter.ttl('key1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should handle expire on non-existent key', async () => {
      await expect(adapter.expire('nonexistent', 60)).resolves.not.toThrow();
    });
  });

  describe('ttl', () => {
    it('should return -1 for key without expiration', async () => {
      await adapter.set('key1', 'value1');
      const ttl = await adapter.ttl('key1');
      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      const ttl = await adapter.ttl('nonexistent');
      expect(ttl).toBe(-2);
    });

    it('should return remaining seconds for key with expiration', async () => {
      await adapter.set('key1', 'value1', 60);
      const ttl = await adapter.ttl('key1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should return -2 for expired key', async () => {
      await adapter.set('key1', 'value1', 0.001);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const ttl = await adapter.ttl('key1');
      expect(ttl).toBe(-2);
    });
  });

  describe('hash operations', () => {
    it('should set and get hash field', async () => {
      await adapter.hset('hash1', 'field1', 'value1');
      const value = await adapter.hget('hash1', 'field1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent hash field', async () => {
      const value = await adapter.hget('hash1', 'field1');
      expect(value).toBeNull();
    });

    it('should get all hash fields', async () => {
      await adapter.hset('hash1', 'field1', 'value1');
      await adapter.hset('hash1', 'field2', 'value2');
      const all = await adapter.hgetall('hash1');
      expect(all).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('should return empty object for non-existent hash', async () => {
      const all = await adapter.hgetall('nonexistent');
      expect(all).toEqual({});
    });

    it('should delete hash fields', async () => {
      await adapter.hset('hash1', 'field1', 'value1');
      await adapter.hset('hash1', 'field2', 'value2');
      const deleted = await adapter.hdel('hash1', 'field1');
      expect(deleted).toBe(1);
      const value = await adapter.hget('hash1', 'field1');
      expect(value).toBeNull();
      const value2 = await adapter.hget('hash1', 'field2');
      expect(value2).toBe('value2');
    });

    it('should delete multiple hash fields', async () => {
      await adapter.hset('hash1', 'field1', 'value1');
      await adapter.hset('hash1', 'field2', 'value2');
      await adapter.hset('hash1', 'field3', 'value3');
      const deleted = await adapter.hdel('hash1', 'field1', 'field2');
      expect(deleted).toBe(2);
    });

    it('should clean up empty hash', async () => {
      await adapter.hset('hash1', 'field1', 'value1');
      await adapter.hdel('hash1', 'field1');
      const all = await adapter.hgetall('hash1');
      expect(all).toEqual({});
    });
  });

  describe('list operations', () => {
    it('should push to left of list', async () => {
      await adapter.lpush('list1', 'value1');
      await adapter.lpush('list1', 'value2');
      const range = await adapter.lrange('list1', 0, -1);
      expect(range).toEqual(['value2', 'value1']);
    });

    it('should get range from list', async () => {
      await adapter.lpush('list1', 'value1');
      await adapter.lpush('list1', 'value2');
      await adapter.lpush('list1', 'value3');
      const range = await adapter.lrange('list1', 0, 1);
      expect(range).toEqual(['value3', 'value2']);
    });

    it('should get all elements with -1 stop', async () => {
      await adapter.lpush('list1', 'value1');
      await adapter.lpush('list1', 'value2');
      const range = await adapter.lrange('list1', 0, -1);
      expect(range).toEqual(['value2', 'value1']);
    });

    it('should return empty array for non-existent list', async () => {
      const range = await adapter.lrange('nonexistent', 0, -1);
      expect(range).toEqual([]);
    });

    it('should get list length', async () => {
      await adapter.lpush('list1', 'value1');
      await adapter.lpush('list1', 'value2');
      const length = await adapter.llen('list1');
      expect(length).toBe(2);
    });

    it('should return 0 for non-existent list', async () => {
      const length = await adapter.llen('nonexistent');
      expect(length).toBe(0);
    });
  });

  describe('pattern operations', () => {
    beforeEach(async () => {
      await adapter.set('user:1', 'value1');
      await adapter.set('user:2', 'value2');
      await adapter.set('session:1', 'value3');
      await adapter.set('key1', 'value4');
    });

    it('should find keys matching pattern', async () => {
      const keys = await adapter.keys('user:*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('session:1');
    });

    it('should find all keys with *', async () => {
      const keys = await adapter.keys('*');
      expect(keys.length).toBeGreaterThanOrEqual(4);
    });

    it('should find keys with ? wildcard', async () => {
      const keys = await adapter.keys('key?');
      expect(keys).toContain('key1');
    });

    it('should scan keys with cursor', async () => {
      const [cursor1, keys1] = await adapter.scan(0, '*', 2);
      expect(keys1.length).toBeLessThanOrEqual(2);
      expect(cursor1).toBeGreaterThan(0);

      const [cursor2, keys2] = await adapter.scan(cursor1, '*', 2);
      expect(keys2.length).toBeLessThanOrEqual(2);
    });

    it('should return cursor 0 when scan complete', async () => {
      const [cursor, keys] = await adapter.scan(0, '*', 100);
      expect(cursor).toBe(0);
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired keys', async () => {
      await adapter.set('key1', 'value1', 0.001);
      await adapter.set('key2', 'value2', 60);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await adapter.cleanup();
      const value1 = await adapter.get('key1');
      const value2 = await adapter.get('key2');
      expect(value1).toBeNull();
      expect(value2).toBe('value2');
    });
  });

  describe('disconnect', () => {
    it('should clear all storage and stop cleanup', async () => {
      await adapter.initialize();
      await adapter.set('key1', 'value1');
      await adapter.hset('hash1', 'field1', 'value1');
      await adapter.lpush('list1', 'value1');

      await adapter.disconnect();

      const value = await adapter.get('key1');
      expect(value).toBeNull();
      const hash = await adapter.hgetall('hash1');
      expect(hash).toEqual({});
      const list = await adapter.lrange('list1', 0, -1);
      expect(list).toEqual([]);
    });
  });
});
