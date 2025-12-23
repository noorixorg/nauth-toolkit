import { AccountLockoutStorageService } from './account-lockout-storage.service';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Account Lockout Storage Service Unit Tests
 *
 * Tests IP-based account lockout storage operations.
 * Covers failed attempt tracking, lock/unlock operations, and expiration handling.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('AccountLockoutStorageService', () => {
  let service: AccountLockoutStorageService;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;

  beforeEach(() => {
    // Create mock storage adapter
    mockStorageAdapter = {
      initialize: jest.fn(),
      isHealthy: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Instantiate service directly
    service = new AccountLockoutStorageService(mockStorageAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // recordFailedAttempt() Method
  // ============================================================================

  describe('recordFailedAttempt', () => {
    it('should increment failed attempts counter', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);

      const result = await service.recordFailedAttempt('192.168.1.1');

      expect(result).toBe(1);
      expect(mockStorageAdapter.incr).toHaveBeenCalledWith('nauth:lockout:ip:192.168.1.1');
    });

    it('should return incremented count', async () => {
      mockStorageAdapter.incr.mockResolvedValue(5);

      const result = await service.recordFailedAttempt('192.168.1.1');

      expect(result).toBe(5);
    });

    it('should use correct key prefix', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);

      await service.recordFailedAttempt('10.0.0.1');

      expect(mockStorageAdapter.incr).toHaveBeenCalledWith('nauth:lockout:ip:10.0.0.1');
    });
  });

  // ============================================================================
  // getFailedAttempts() Method
  // ============================================================================

  describe('getFailedAttempts', () => {
    it('should return failed attempts count', async () => {
      mockStorageAdapter.get.mockResolvedValue('3');

      const result = await service.getFailedAttempts('192.168.1.1');

      expect(result).toBe(3);
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('nauth:lockout:ip:192.168.1.1');
    });

    it('should return 0 when no attempts recorded', async () => {
      mockStorageAdapter.get.mockResolvedValue(null);

      const result = await service.getFailedAttempts('192.168.1.1');

      expect(result).toBe(0);
    });

    it('should parse string value to number', async () => {
      mockStorageAdapter.get.mockResolvedValue('10');

      const result = await service.getFailedAttempts('192.168.1.1');

      expect(result).toBe(10);
    });

    it('should handle empty string', async () => {
      mockStorageAdapter.get.mockResolvedValue('');

      const result = await service.getFailedAttempts('192.168.1.1');

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // isAccountLocked() Method
  // ============================================================================

  describe('isAccountLocked', () => {
    it('should return true when account is locked', async () => {
      mockStorageAdapter.exists.mockResolvedValue(true);

      const result = await service.isAccountLocked('192.168.1.1');

      expect(result).toBe(true);
      expect(mockStorageAdapter.exists).toHaveBeenCalledWith('nauth:locked:ip:192.168.1.1');
    });

    it('should return false when account is not locked', async () => {
      mockStorageAdapter.exists.mockResolvedValue(false);

      const result = await service.isAccountLocked('192.168.1.1');

      expect(result).toBe(false);
    });

    it('should use correct lock key prefix', async () => {
      mockStorageAdapter.exists.mockResolvedValue(false);

      await service.isAccountLocked('10.0.0.1');

      expect(mockStorageAdapter.exists).toHaveBeenCalledWith('nauth:locked:ip:10.0.0.1');
    });
  });

  // ============================================================================
  // lockIpAddress() Method
  // ============================================================================

  describe('lockIpAddress', () => {
    it('should lock account with correct data', async () => {
      mockStorageAdapter.set.mockResolvedValue();

      await service.lockIpAddress('192.168.1.1', 300, 'too_many_failed_attempts');

      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'nauth:locked:ip:192.168.1.1',
        (expect as any).stringContaining('too_many_failed_attempts'),
        300,
      );
    });

    it('should include lockedAt timestamp', async () => {
      const beforeLock = new Date();
      mockStorageAdapter.set.mockResolvedValue();

      await service.lockIpAddress('192.168.1.1', 300, 'test_reason');

      const afterLock = new Date();
      const callArgs = mockStorageAdapter.set.mock.calls[0];
      const lockData = JSON.parse(callArgs[1] as string);

      expect(lockData.reason).toBe('test_reason');
      expect(new Date(lockData.lockedAt).getTime()).toBeGreaterThanOrEqual(beforeLock.getTime());
      expect(new Date(lockData.lockedAt).getTime()).toBeLessThanOrEqual(afterLock.getTime());
    });

    it('should calculate lockedUntil correctly', async () => {
      const duration = 600; // 10 minutes
      mockStorageAdapter.set.mockResolvedValue();

      await service.lockIpAddress('192.168.1.1', duration, 'test_reason');

      const callArgs = mockStorageAdapter.set.mock.calls[0];
      const lockData = JSON.parse(callArgs[1] as string);
      const lockedUntil = new Date(lockData.lockedUntil);
      const expectedTime = Date.now() + duration * 1000;

      expect(lockedUntil.getTime()).toBeCloseTo(expectedTime, -2); // Within 1 second
    });

    it('should set TTL equal to duration', async () => {
      const duration = 300;
      mockStorageAdapter.set.mockResolvedValue();

      await service.lockIpAddress('192.168.1.1', duration, 'test_reason');

      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'nauth:locked:ip:192.168.1.1',
        (expect as any).anything(),
        duration,
      );
    });
  });

  // ============================================================================
  // unlockIpAddress() Method
  // ============================================================================

  describe('unlockIpAddress', () => {
    it('should delete lock key and reset failed attempts', async () => {
      mockStorageAdapter.del.mockResolvedValue();

      await service.unlockIpAddress('192.168.1.1');

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:locked:ip:192.168.1.1');
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:lockout:ip:192.168.1.1');
      expect(mockStorageAdapter.del).toHaveBeenCalledTimes(2);
    });

    it('should unlock account and reset counter', async () => {
      mockStorageAdapter.del.mockResolvedValue();

      await service.unlockIpAddress('10.0.0.1');

      // Should delete both lock key and attempt counter
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:locked:ip:10.0.0.1');
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:lockout:ip:10.0.0.1');
      expect(mockStorageAdapter.del).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // resetFailedAttempts() Method
  // ============================================================================

  describe('resetFailedAttempts', () => {
    it('should delete failed attempts counter', async () => {
      mockStorageAdapter.del.mockResolvedValue();

      await service.resetFailedAttempts('192.168.1.1');

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:lockout:ip:192.168.1.1');
    });

    it('should reset counter for correct IP', async () => {
      mockStorageAdapter.del.mockResolvedValue();

      await service.resetFailedAttempts('10.0.0.1');

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:lockout:ip:10.0.0.1');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should track failed attempts and lock account', async () => {
      mockStorageAdapter.incr
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(5);
      mockStorageAdapter.set.mockResolvedValue();
      mockStorageAdapter.exists.mockResolvedValue(false).mockResolvedValue(true);

      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await service.recordFailedAttempt('192.168.1.1');
      }

      // Lock account
      await service.lockIpAddress('192.168.1.1', 300, 'max_attempts_exceeded');

      // Verify locked
      const isLocked = await service.isAccountLocked('192.168.1.1');
      expect(isLocked).toBe(true);
    });

    it('should unlock and reset attempts', async () => {
      mockStorageAdapter.del.mockResolvedValue();
      mockStorageAdapter.exists.mockResolvedValue(false);
      mockStorageAdapter.get.mockResolvedValue(null);

      await service.unlockIpAddress('192.168.1.1');

      const isLocked = await service.isAccountLocked('192.168.1.1');
      const attempts = await service.getFailedAttempts('192.168.1.1');

      expect(isLocked).toBe(false);
      expect(attempts).toBe(0);
    });
  });
});
