/**
 * Context Storage Unit Tests
 *
 * Tests request-scoped context storage functionality.
 */

import { ContextStorage } from './context-storage';

describe('ContextStorage', () => {
  beforeEach(() => {
    // Clear any existing context
    const store = ContextStorage.getStore();
    if (store) {
      store.clear();
    }
  });

  describe('run', () => {
    it('should execute callback within new context', () => {
      const result = ContextStorage.run(() => {
        ContextStorage.set('key', 'value');
        return 'result';
      });

      expect(result).toBe('result');
    });

    it('should isolate context between runs', () => {
      ContextStorage.run(() => {
        ContextStorage.set('key1', 'value1');
      });

      ContextStorage.run(() => {
        ContextStorage.set('key2', 'value2');
        expect(ContextStorage.get('key1')).toBeUndefined();
      });
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      ContextStorage.run(() => {
        ContextStorage.set('userId', '123');
        ContextStorage.set('clientInfo', { ip: '1.2.3.4' });

        expect(ContextStorage.get<string>('userId')).toBe('123');
        expect(ContextStorage.get<{ ip: string }>('clientInfo')).toEqual({ ip: '1.2.3.4' });
      });
    });

    it('should throw error when set called outside context', () => {
      expect(() => {
        ContextStorage.set('key', 'value');
      }).toThrow('Context not initialized');
    });

    it('should return undefined for non-existent key', () => {
      ContextStorage.run(() => {
        expect(ContextStorage.get('nonExistent')).toBeUndefined();
      });
    });
  });

  describe('has', () => {
    it('should return true when key exists', () => {
      ContextStorage.run(() => {
        ContextStorage.set('key', 'value');
        expect(ContextStorage.has('key')).toBe(true);
      });
    });

    it('should return false when key does not exist', () => {
      ContextStorage.run(() => {
        expect(ContextStorage.has('nonExistent')).toBe(false);
      });
    });

    it('should return false when called outside context', () => {
      expect(ContextStorage.has('key')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      ContextStorage.run(() => {
        ContextStorage.set('key', 'value');
        const deleted = ContextStorage.delete('key');
        expect(deleted).toBe(true);
        expect(ContextStorage.get('key')).toBeUndefined();
      });
    });

    it('should return false when key does not exist', () => {
      ContextStorage.run(() => {
        const deleted = ContextStorage.delete('nonExistent');
        expect(deleted).toBe(false);
      });
    });

    it('should return false when called outside context', () => {
      expect(ContextStorage.delete('key')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all values from context', () => {
      ContextStorage.run(() => {
        ContextStorage.set('key1', 'value1');
        ContextStorage.set('key2', 'value2');
        ContextStorage.clear();
        expect(ContextStorage.get('key1')).toBeUndefined();
        expect(ContextStorage.get('key2')).toBeUndefined();
      });
    });

    it('should not throw when called outside context', () => {
      expect(() => {
        ContextStorage.clear();
      }).not.toThrow();
    });
  });

  describe('keys', () => {
    it('should return all keys in context', () => {
      ContextStorage.run(() => {
        ContextStorage.set('key1', 'value1');
        ContextStorage.set('key2', 'value2');
        const keys = ContextStorage.keys();
        expect(keys).toContain('key1');
        expect(keys).toContain('key2');
        expect(keys.length).toBe(2);
      });
    });

    it('should return empty array when called outside context', () => {
      expect(ContextStorage.keys()).toEqual([]);
    });
  });

  describe('getStore', () => {
    it('should return store when in context', () => {
      ContextStorage.run(() => {
        const store = ContextStorage.getStore();
        expect(store).toBeDefined();
        expect(store instanceof Map).toBe(true);
      });
    });

    it('should return undefined when outside context', () => {
      expect(ContextStorage.getStore()).toBeUndefined();
    });
  });

  describe('enterStore', () => {
    it('should enter existing store', () => {
      const store = new Map<string, unknown>();
      store.set('key', 'value');

      const result = ContextStorage.enterStore(store, () => {
        return ContextStorage.get<string>('key');
      });

      expect(result).toBe('value');
    });
  });
});
