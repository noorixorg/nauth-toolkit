import { NAuthStorageAdapter } from './interface';

/**
 * Browser storage adapter wrapping localStorage or sessionStorage.
 */
export class BrowserStorage implements NAuthStorageAdapter {
  private readonly storage: Storage;

  /**
   * Create a browser storage adapter.
   *
   * @param storage - Storage implementation (localStorage by default)
   */
  constructor(storage: Storage = window.localStorage) {
    this.storage = storage;
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.removeItem(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}
