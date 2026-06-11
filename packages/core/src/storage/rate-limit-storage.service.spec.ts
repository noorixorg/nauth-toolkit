import { RateLimitStorageService } from './rate-limit-storage.service';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * Rate Limit Storage Service Unit Tests
 *
 * Tests rate limiting storage operations.
 * Covers counter increment, window management, and expiration handling.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('RateLimitStorageService', () => {
  let service: RateLimitStorageService;
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
    service = new RateLimitStorageService(mockStorageAdapter);
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
  // incrementRateLimit() Method
  // ============================================================================

  describe('incrementRateLimit', () => {
    it('should increment counter and return count', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.expire.mockResolvedValue();

      const result = await service.incrementRateLimit('user-123', '/api/login', 60000);

      expect(result).toBe(1);
      expect(mockStorageAdapter.incr).toHaveBeenCalledWith('nauth:ratelimit:user-123:/api/login');
    });

    it('should set expiry on first request in window', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.expire.mockResolvedValue();

      await service.incrementRateLimit('user-123', '/api/login', 60000);

      expect(mockStorageAdapter.expire).toHaveBeenCalledWith(
        'nauth:ratelimit:user-123:/api/login',
        60, // 60000ms = 60 seconds
      );
    });

    it('should not set expiry on subsequent requests', async () => {
      mockStorageAdapter.incr.mockResolvedValue(2);
      mockStorageAdapter.expire.mockResolvedValue();

      await service.incrementRateLimit('user-123', '/api/login', 60000);

      expect(mockStorageAdapter.expire).not.toHaveBeenCalled();
    });

    it('should convert windowMs to seconds for TTL', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.expire.mockResolvedValue();

      await service.incrementRateLimit('user-123', '/api/login', 120000); // 2 minutes

      expect(mockStorageAdapter.expire).toHaveBeenCalledWith(
        'nauth:ratelimit:user-123:/api/login',
        120, // 120000ms = 120 seconds
      );
    });

    it('should round up windowMs to seconds', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.expire.mockResolvedValue();

      await service.incrementRateLimit('user-123', '/api/login', 1500); // 1.5 seconds

      expect(mockStorageAdapter.expire).toHaveBeenCalledWith(
        'nauth:ratelimit:user-123:/api/login',
        2, // Math.ceil(1500 / 1000) = 2
      );
    });

    it('should use correct key format', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.expire.mockResolvedValue();

      await service.incrementRateLimit('ip-192.168.1.1', '/api/signup', 30000);

      expect(mockStorageAdapter.incr).toHaveBeenCalledWith('nauth:ratelimit:ip-192.168.1.1:/api/signup');
    });
  });

  // ============================================================================
  // getRateLimit() Method
  // ============================================================================

  describe('getRateLimit', () => {
    it('should return current rate limit count', async () => {
      mockStorageAdapter.get.mockResolvedValue('5');

      const result = await service.getRateLimit('user-123', '/api/login');

      expect(result).toBe(5);
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('nauth:ratelimit:user-123:/api/login');
    });

    it('should return 0 when no limit recorded', async () => {
      mockStorageAdapter.get.mockResolvedValue(null);

      const result = await service.getRateLimit('user-123', '/api/login');

      expect(result).toBe(0);
    });

    it('should parse string value to number', async () => {
      mockStorageAdapter.get.mockResolvedValue('10');

      const result = await service.getRateLimit('user-123', '/api/login');

      expect(result).toBe(10);
    });

    it('should handle empty string', async () => {
      mockStorageAdapter.get.mockResolvedValue('');

      const result = await service.getRateLimit('user-123', '/api/login');

      expect(result).toBe(0);
    });

    it('should use correct key format', async () => {
      mockStorageAdapter.get.mockResolvedValue('3');

      await service.getRateLimit('ip-10.0.0.1', '/api/reset-password');

      expect(mockStorageAdapter.get).toHaveBeenCalledWith('nauth:ratelimit:ip-10.0.0.1:/api/reset-password');
    });
  });

  // ============================================================================
  // resetRateLimit() Method
  // ============================================================================

  describe('resetRateLimit', () => {
    it('should delete rate limit counter', async () => {
      mockStorageAdapter.del.mockResolvedValue();

      await service.resetRateLimit('user-123', '/api/login');

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:ratelimit:user-123:/api/login');
    });

    it('should reset limit for correct identifier and endpoint', async () => {
      mockStorageAdapter.del.mockResolvedValue();

      await service.resetRateLimit('ip-192.168.1.1', '/api/signup');

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('nauth:ratelimit:ip-192.168.1.1:/api/signup');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should track rate limit across multiple requests', async () => {
      mockStorageAdapter.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
      mockStorageAdapter.expire.mockResolvedValue();
      mockStorageAdapter.get.mockResolvedValue('3');

      // Make 3 requests
      await service.incrementRateLimit('user-123', '/api/login', 60000);
      await service.incrementRateLimit('user-123', '/api/login', 60000);
      await service.incrementRateLimit('user-123', '/api/login', 60000);

      const count = await service.getRateLimit('user-123', '/api/login');

      expect(count).toBe(3);
      expect(mockStorageAdapter.expire).toHaveBeenCalledTimes(1); // Only on first request
    });

    it('should reset rate limit correctly', async () => {
      mockStorageAdapter.incr.mockResolvedValue(5);
      mockStorageAdapter.expire.mockResolvedValue();
      mockStorageAdapter.del.mockResolvedValue();
      mockStorageAdapter.get.mockResolvedValue(null);

      await service.incrementRateLimit('user-123', '/api/login', 60000);
      await service.resetRateLimit('user-123', '/api/login');

      const count = await service.getRateLimit('user-123', '/api/login');

      expect(count).toBe(0);
    });

    it('should handle different endpoints independently', async () => {
      mockStorageAdapter.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      mockStorageAdapter.expire.mockResolvedValue();
      mockStorageAdapter.get.mockResolvedValueOnce('1').mockResolvedValueOnce('1');

      await service.incrementRateLimit('user-123', '/api/login', 60000);
      await service.incrementRateLimit('user-123', '/api/signup', 60000);

      const loginCount = await service.getRateLimit('user-123', '/api/login');
      const signupCount = await service.getRateLimit('user-123', '/api/signup');

      expect(loginCount).toBe(1);
      expect(signupCount).toBe(1);
    });
  });
});
