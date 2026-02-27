/**
 * Memory Storage Unit Tests
 */

import { InMemoryStorage } from './memory';

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  describe('getItem', () => {
    it('should return null for missing item', async () => {
      const result = await storage.getItem('missing');
      expect(result).toBeNull();
    });

    it('should return stored value', async () => {
      await storage.setItem('key', 'value');
      const result = await storage.getItem('key');
      expect(result).toBe('value');
    });
  });

  describe('setItem', () => {
    it('should store value', async () => {
      await storage.setItem('key', 'value');
      const result = await storage.getItem('key');
      expect(result).toBe('value');
    });

    it('should overwrite existing value', async () => {
      await storage.setItem('key', 'value1');
      await storage.setItem('key', 'value2');
      const result = await storage.getItem('key');
      expect(result).toBe('value2');
    });
  });

  describe('removeItem', () => {
    it('should remove stored item', async () => {
      await storage.setItem('key', 'value');
      await storage.removeItem('key');
      const result = await storage.getItem('key');
      expect(result).toBeNull();
    });

    it('should handle removing non-existent item', async () => {
      await expect(storage.removeItem('missing')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all items', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');
      await storage.clear();
      expect(await storage.getItem('key1')).toBeNull();
      expect(await storage.getItem('key2')).toBeNull();
    });
  });
});
