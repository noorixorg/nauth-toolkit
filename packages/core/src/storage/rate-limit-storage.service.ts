import { RateLimitStorage, StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Rate limit storage implementation using StorageAdapter (Platform-Agnostic)
 */
export class RateLimitStorageService implements RateLimitStorage {
  private readonly keyPrefix = 'nauth:ratelimit:';

  constructor(private readonly storageAdapter: StorageAdapter) {}

  async incrementRateLimit(identifier: string, endpoint: string, windowMs: number): Promise<number> {
    const key = this.getKey(identifier, endpoint);
    const count = await this.storageAdapter.incr(key);

    if (count === 1) {
      // First request in this window, set expiry
      const ttl = Math.ceil(windowMs / 1000);
      await this.storageAdapter.expire(key, ttl);
    }

    return count;
  }

  async getRateLimit(identifier: string, endpoint: string): Promise<number> {
    const key = this.getKey(identifier, endpoint);
    const value = await this.storageAdapter.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  async resetRateLimit(identifier: string, endpoint: string): Promise<void> {
    const key = this.getKey(identifier, endpoint);
    await this.storageAdapter.del(key);
  }

  private getKey(identifier: string, endpoint: string): string {
    return `${this.keyPrefix}${identifier}:${endpoint}`;
  }
}
