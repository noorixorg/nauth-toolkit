import { AccountLockoutStorage, StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Account lockout storage implementation using StorageAdapter (Platform-Agnostic)
 *
 * SECURITY: Uses IP addresses instead of user identifiers to prevent
 * attackers from locking out legitimate users by guessing their email/username.
 */
export class AccountLockoutStorageService implements AccountLockoutStorage {
  private readonly keyPrefix = 'nauth:lockout:ip:';
  private readonly lockKeyPrefix = 'nauth:locked:ip:';

  constructor(private readonly storageAdapter: StorageAdapter) {}

  /**
   * Record failed login attempt for an IP address
   * @param ipAddress - IP address that made the failed attempt
   * @returns Number of failed attempts for this IP
   */
  async recordFailedAttempt(ipAddress: string): Promise<number> {
    const key = this.getKey(ipAddress);
    return await this.storageAdapter.incr(key);
  }

  /**
   * Get failed attempts count for an IP address
   * @param ipAddress - IP address to check
   * @returns Number of failed attempts
   */
  async getFailedAttempts(ipAddress: string): Promise<number> {
    const key = this.getKey(ipAddress);
    const value = await this.storageAdapter.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Check if an IP address is locked out
   * @param ipAddress - IP address to check
   * @returns True if IP is locked out
   */
  async isAccountLocked(ipAddress: string): Promise<boolean> {
    const lockKey = this.getLockKey(ipAddress);
    return await this.storageAdapter.exists(lockKey);
  }

  /**
   * Lock an IP address for a specified duration
   * @param ipAddress - IP address to lock
   * @param duration - Lock duration in seconds
   * @param reason - Reason for lockout
   */
  async blockIpAdresss(ipAddress: string, duration: number, reason: string): Promise<void> {
    const lockKey = this.getLockKey(ipAddress);
    const lockData = JSON.stringify({
      reason,
      lockedAt: new Date().toISOString(),
      lockedUntil: new Date(Date.now() + duration * 1000).toISOString(),
    });

    await this.storageAdapter.set(lockKey, lockData, duration);
  }

  /**
   * Unlock an IP address and reset failed attempts
   * @param ipAddress - IP address to unlock
   */
  async unblockIPAdress(ipAddress: string): Promise<void> {
    const lockKey = this.getLockKey(ipAddress);
    await this.storageAdapter.del(lockKey);
    await this.resetFailedAttempts(ipAddress);
  }

  /**
   * Reset failed attempts counter for an IP address
   * @param ipAddress - IP address to reset
   */
  async resetFailedAttempts(ipAddress: string): Promise<void> {
    const key = this.getKey(ipAddress);
    await this.storageAdapter.del(key);
  }

  private getKey(ipAddress: string): string {
    return `${this.keyPrefix}${ipAddress}`;
  }

  private getLockKey(ipAddress: string): string {
    return `${this.lockKeyPrefix}${ipAddress}`;
  }
}
