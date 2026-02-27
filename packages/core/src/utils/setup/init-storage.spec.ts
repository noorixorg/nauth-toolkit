/**
 * Init Storage Unit Tests
 *
 * Tests storage adapter initialization functionality including:
 * - Logger injection
 * - Repository injection
 * - Adapter initialization
 * - Fallback to DatabaseStorageAdapter
 * - Error handling
 */

import { Repository } from 'typeorm';
import { initStorage } from './init-storage';
import { NAuthConfig } from '../../interfaces/config.interface';
import { StorageAdapter } from '../../interfaces/storage-adapter.interface';
import { LoggerService } from '../../interfaces/config.interface';
import { NAuthException, AuthErrorCode } from '../../index';

// Mock dynamic imports
jest.mock('@nauth-toolkit/storage-database', () => ({
  DatabaseStorageAdapter: jest.fn(),
}), { virtual: true });

describe('initStorage', () => {
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockRateLimitRepo: Repository<Record<string, unknown>> | null;
  let mockStorageLockRepo: Repository<Record<string, unknown>> | null;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
    } as NAuthConfig;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockRateLimitRepo = {} as Repository<Record<string, unknown>>;
    mockStorageLockRepo = {} as Repository<Record<string, unknown>>;

    mockStorageAdapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      incr: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(undefined),
      ttl: jest.fn().mockResolvedValue(-1),
      hget: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(undefined),
      hgetall: jest.fn().mockResolvedValue({}),
      hdel: jest.fn().mockResolvedValue(0),
      lpush: jest.fn().mockResolvedValue(undefined),
      lrange: jest.fn().mockResolvedValue([]),
      llen: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([]),
      scan: jest.fn().mockResolvedValue([0, []]),
      cleanup: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should initialize provided storage adapter', async () => {
    mockConfig.storageAdapter = mockStorageAdapter;

    const result = await initStorage(mockConfig, mockRateLimitRepo, mockStorageLockRepo, mockLogger);

    expect(result).toBe(mockStorageAdapter);
    expect(mockStorageAdapter.initialize).toHaveBeenCalled();
  });

  it('should inject logger if adapter supports it', async () => {
    const setLogger = jest.fn();
    const adapterWithLogger = {
      ...mockStorageAdapter,
      setLogger,
    };
    mockConfig.storageAdapter = adapterWithLogger as any;

    await initStorage(mockConfig, mockRateLimitRepo, mockStorageLockRepo, mockLogger);

    expect(setLogger).toHaveBeenCalledWith(mockLogger);
  });

  it('should inject repositories if adapter supports it', async () => {
    const setRepositories = jest.fn();
    const adapterWithRepos = {
      ...mockStorageAdapter,
      setRepositories,
    };
    mockConfig.storageAdapter = adapterWithRepos as any;

    await initStorage(mockConfig, mockRateLimitRepo, mockStorageLockRepo, mockLogger);

    expect(setRepositories).toHaveBeenCalledWith(mockRateLimitRepo, mockStorageLockRepo);
  });

  it('should not inject repositories if adapter does not support it', async () => {
    mockConfig.storageAdapter = mockStorageAdapter;

    await initStorage(mockConfig, mockRateLimitRepo, mockStorageLockRepo, mockLogger);

    expect(mockStorageAdapter.initialize).toHaveBeenCalled();
  });

  it('should throw error when no adapter provided and no repositories available', async () => {
    mockConfig.storageAdapter = undefined;

    await expect(
      initStorage(mockConfig, null, null, mockLogger),
    ).rejects.toThrow(NAuthException);

    await expect(
      initStorage(mockConfig, null, null, mockLogger),
    ).rejects.toThrow('Storage adapter is REQUIRED');
  });

  it('should throw error with AuthErrorCode.VALIDATION_FAILED', async () => {
    mockConfig.storageAdapter = undefined;

    try {
      await initStorage(mockConfig, null, null, mockLogger);
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NAuthException);
      expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
    }
  });
});
