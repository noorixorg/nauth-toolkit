/**
 * Browser Storage Unit Tests
 */

import { BrowserStorage } from './browser';

describe('BrowserStorage', () => {
  let storage: BrowserStorage;
  let mockLocalStorage: jest.Mocked<Storage>;

  beforeEach(() => {
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    } as any;

    storage = new BrowserStorage(mockLocalStorage);
  });

  describe('getItem', () => {
    it('should get item from storage', async () => {
      mockLocalStorage.getItem.mockReturnValue('value');
      const result = await storage.getItem('key');
      expect(result).toBe('value');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('key');
    });

    it('should return null for missing item', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      const result = await storage.getItem('missing');
      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    it('should set item in storage', async () => {
      await storage.setItem('key', 'value');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('removeItem', () => {
    it('should remove item from storage', async () => {
      await storage.removeItem('key');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('key');
    });
  });

  describe('clear', () => {
    it('should clear all items from storage', async () => {
      await storage.clear();
      expect(mockLocalStorage.clear).toHaveBeenCalled();
    });
  });
});
