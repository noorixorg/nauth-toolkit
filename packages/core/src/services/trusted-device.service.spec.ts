import { Repository } from 'typeorm';
import { TrustedDeviceService } from './trusted-device.service';
import { BaseTrustedDevice } from '../entities/trusted-device.entity';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';

/**
 * Trusted Device Service Unit Tests
 *
 * Tests device trust management for "remember device" feature.
 * Covers device creation, validation, revocation, and expiration handling.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;
  let mockRepository: jest.Mocked<Repository<BaseTrustedDevice>>;
  let mockLogger: jest.Mocked<NAuthLogger>;

  const mockConfig: Partial<NAuthConfig> = {
    mfa: {
      enabled: true,
      rememberDevices: 'user_opt_in',
      rememberDeviceDays: 30,
    },
  };

  const mockTrustedDevice: Partial<BaseTrustedDevice> = {
    id: 1,
    userId: 1,
    deviceTokenHash: 'hashed-token-123',
    deviceName: 'My Device',
    deviceType: 'desktop',
    ipAddress: '1.2.3.4',
    userAgent: 'test-user-agent',
    platform: 'Windows',
    browser: 'Chrome',
    trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    lastUsedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    } as any;

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Instantiate service directly
    service = new TrustedDeviceService(mockConfig as NAuthConfig, mockLogger, mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore crypto.randomUUID if it was mocked
    jest.restoreAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // createTrustedDevice() Method
  // ============================================================================

  describe('createTrustedDevice', () => {
    it('should create trusted device successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockTrustedDevice as any);
      mockRepository.save.mockResolvedValue(mockTrustedDevice as any);

      const result = await service.createTrustedDevice(
        1,
        'My Device',
        'desktop',
        '1.2.3.4',
        'test-user-agent',
        'Windows',
        'Chrome',
      );

      // Verify result is a valid UUID format
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error when rememberDevices is not enabled', async () => {
      const configDisabled: Partial<NAuthConfig> = {
        mfa: {
          enabled: true,
          rememberDevices: 'never',
        },
      };

      const serviceDisabled = new TrustedDeviceService(configDisabled as NAuthConfig, mockLogger, mockRepository);

      try {
        await serviceDisabled.createTrustedDevice(1);
        fail('Should have thrown Error');
      } catch (error: any) {
        expect(error.message).toContain('rememberDevices is not enabled');
      }
    });

    it('should throw error when repository not available', async () => {
      const serviceWithoutRepo = new TrustedDeviceService(mockConfig as NAuthConfig, mockLogger, undefined);

      try {
        await serviceWithoutRepo.createTrustedDevice(1);
        fail('Should have thrown Error');
      } catch (error: any) {
        expect(error.message).toContain('TrustedDeviceRepository not available');
      }
    });

    it('should update existing device if already trusted', async () => {
      const existingDevice = { ...mockTrustedDevice };
      // Calculate hash for the device token that will be generated
      const createHash = (await import('crypto')).createHash;
      // We'll verify the hash was calculated correctly by checking the update was called

      mockRepository.findOne.mockResolvedValue(existingDevice as any);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.createTrustedDevice(1, 'Updated Device Name');

      // Verify result is a valid UUID format
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(mockRepository.update).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should calculate expiry based on rememberDeviceDays', async () => {
      const configWithDays: Partial<NAuthConfig> = {
        mfa: {
          enabled: true,
          rememberDevices: 'user_opt_in',
          rememberDeviceDays: 60,
        },
      };

      const serviceWithDays = new TrustedDeviceService(configWithDays as NAuthConfig, mockLogger, mockRepository);

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockTrustedDevice as any);
      mockRepository.save.mockResolvedValue(mockTrustedDevice as any);

      await serviceWithDays.createTrustedDevice(1);

      // Verify trustedUntil is set correctly (60 days from now)
      const createCall = mockRepository.create.mock.calls[0][0] as any;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 60);
      expect(new Date(createCall.trustedUntil).getTime()).toBeCloseTo(expectedDate.getTime(), -3); // Within 1 second
    });

    it('should store all device information', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockTrustedDevice as any);
      mockRepository.save.mockResolvedValue(mockTrustedDevice as any);

      await service.createTrustedDevice(1, 'My Device', 'desktop', '1.2.3.4', 'test-user-agent', 'Windows', 'Chrome');

      expect(mockRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          deviceName: 'My Device',
          deviceType: 'desktop',
          ipAddress: '1.2.3.4',
          userAgent: 'test-user-agent',
          platform: 'Windows',
          browser: 'Chrome',
        }),
      );
    });

    it('should handle null/undefined device information', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockTrustedDevice as any);
      mockRepository.save.mockResolvedValue(mockTrustedDevice as any);

      await service.createTrustedDevice(1, null, null, null, null, null, null);

      expect(mockRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          deviceName: null,
          deviceType: null,
          ipAddress: null,
          userAgent: null,
          platform: null,
          browser: null,
        }),
      );
    });
  });

  // ============================================================================
  // isDeviceTrusted() Method
  // ============================================================================

  describe('isDeviceTrusted', () => {
    it('should return false when deviceToken is null', async () => {
      const result = await service.isDeviceTrusted(null, 1);

      expect(result).toBe(false);
    });

    it('should return false when deviceToken is undefined', async () => {
      const result = await service.isDeviceTrusted(undefined, 1);

      expect(result).toBe(false);
    });

    it('should return false when repository not available', async () => {
      const serviceWithoutRepo = new TrustedDeviceService(mockConfig as NAuthConfig, mockLogger, undefined);

      const result = await serviceWithoutRepo.isDeviceTrusted('token', 1);

      expect(result).toBe(false);
    });

    it('should return false when rememberDevices is not enabled', async () => {
      const configDisabled: Partial<NAuthConfig> = {
        mfa: {
          enabled: true,
          rememberDevices: 'never',
        },
      };

      const serviceDisabled = new TrustedDeviceService(configDisabled as NAuthConfig, mockLogger, mockRepository);

      const result = await serviceDisabled.isDeviceTrusted('token', 1);

      expect(result).toBe(false);
    });

    it('should return true when device is trusted and not expired', async () => {
      const deviceToken = 'device-token-uuid-123';
      const trustedDevice = {
        ...mockTrustedDevice,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Future date
      };

      mockRepository.findOne.mockResolvedValue(trustedDevice as any);

      const result = await service.isDeviceTrusted(deviceToken, 1);

      expect(result).toBe(true);
    });

    it('should return false when device not found', async () => {
      const deviceToken = 'device-token-uuid-123';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.isDeviceTrusted(deviceToken, 1);

      expect(result).toBe(false);
    });

    it('should return false and delete when device expired', async () => {
      const deviceToken = 'device-token-uuid-123';
      const expiredDevice = {
        ...mockTrustedDevice,
        trustedUntil: new Date(Date.now() - 1000), // Past date
      };

      mockRepository.findOne.mockResolvedValue(expiredDevice as any);
      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.isDeviceTrusted(deviceToken, 1);

      expect(result).toBe(false);
      expect(mockRepository.delete).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith((expect as any).stringContaining('Trusted device expired'));
    });

    it('should update lastUsedAt when device is trusted', async () => {
      const deviceToken = 'device-token-uuid-123';
      const trustedDevice = {
        ...mockTrustedDevice,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      };

      mockRepository.findOne.mockResolvedValue(trustedDevice as any);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.isDeviceTrusted(deviceToken, 1);

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should throttle lastUsedAt updates to once per 15 minutes', async () => {
      const deviceToken = 'device-token-uuid-123';
      const trustedDevice = {
        ...mockTrustedDevice,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(), // Just now
      };

      mockRepository.findOne.mockResolvedValue(trustedDevice as any);

      await service.isDeviceTrusted(deviceToken, 1);

      // Should not update if lastUsedAt is recent
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // validateDeviceToken() Method
  // ============================================================================

  describe('validateDeviceToken', () => {
    it('should return not suspicious when token is null', async () => {
      const result = await service.validateDeviceToken(null, 1);

      expect(result).toEqual({ isValid: false, isSuspicious: false });
    });

    it('should return not suspicious when token is undefined', async () => {
      const result = await service.validateDeviceToken(undefined, 1);

      expect(result).toEqual({ isValid: false, isSuspicious: false });
    });

    it('should return valid and not suspicious when device is trusted', async () => {
      const deviceToken = 'device-token-uuid-123';
      const trustedDevice = {
        ...mockTrustedDevice,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      mockRepository.findOne.mockResolvedValue(trustedDevice as any);

      const result = await service.validateDeviceToken(deviceToken, 1);

      expect(result).toEqual({ isValid: true, isSuspicious: false });
    });

    it('should return suspicious when token provided but not trusted', async () => {
      const deviceToken = 'device-token-uuid-123';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateDeviceToken(deviceToken, 1);

      expect(result).toEqual({ isValid: false, isSuspicious: true });
    });

    it('should return suspicious when token provided but expired', async () => {
      const deviceToken = 'device-token-uuid-123';
      const expiredDevice = {
        ...mockTrustedDevice,
        trustedUntil: new Date(Date.now() - 1000),
      };

      mockRepository.findOne.mockResolvedValue(expiredDevice as any);
      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.validateDeviceToken(deviceToken, 1);

      expect(result).toEqual({ isValid: false, isSuspicious: true });
    });
  });

  // ============================================================================
  // revokeTrustedDevice() Method
  // ============================================================================

  describe('revokeTrustedDevice', () => {
    it('should revoke trusted device successfully', async () => {
      const deviceToken = 'device-token-uuid-123';

      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.revokeTrustedDevice(deviceToken, 1);

      expect(mockRepository.delete).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith((expect as any).stringContaining('Revoked trusted device'));
    });

    it('should return early when repository not available', async () => {
      const serviceWithoutRepo = new TrustedDeviceService(mockConfig as NAuthConfig, mockLogger, undefined);

      await serviceWithoutRepo.revokeTrustedDevice('token', 1);

      // Should not throw, just return early
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should delete device by hash', async () => {
      const deviceToken = 'device-token-uuid-123';
      const createHash = (await import('crypto')).createHash;
      const hash = createHash('sha256').update(deviceToken).digest('hex');

      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.revokeTrustedDevice(deviceToken, 1);

      expect(mockRepository.delete).toHaveBeenCalledWith({
        userId: 1,
        deviceTokenHash: hash,
      });
    });
  });

  describe('revokeTrustedDeviceById', () => {
    it('should revoke a device by id scoped to the owning user', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.revokeTrustedDeviceById(42, 1);

      expect(result).toBe(true);
      // Scoped by userId as well as id, so another user's device id cannot match
      expect(mockRepository.delete).toHaveBeenCalledWith({ id: 42, userId: 1 });
    });

    it('should report false when no device matched', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await service.revokeTrustedDeviceById(42, 1);

      expect(result).toBe(false);
    });

    it('should report false when repository not available', async () => {
      const serviceWithoutRepo = new TrustedDeviceService(mockConfig as NAuthConfig, mockLogger, undefined);

      const result = await serviceWithoutRepo.revokeTrustedDeviceById(42, 1);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // getUserTrustedDevices() Method
  // ============================================================================

  describe('getUserTrustedDevices', () => {
    it('should return user trusted devices', async () => {
      const devices = [
        { ...mockTrustedDevice, id: 1 },
        { ...mockTrustedDevice, id: 2 },
      ];

      mockRepository.find.mockResolvedValue(devices as any);

      const result = await service.getUserTrustedDevices(1);

      expect(result.length).toBe(2);
      expect('deviceTokenHash' in result[0]).toBe(false);
      expect('deviceTokenHash' in result[1]).toBe(false);
    });

    it('should return empty array when repository not available', async () => {
      const serviceWithoutRepo = new TrustedDeviceService(mockConfig as NAuthConfig, mockLogger, undefined);

      const result = await serviceWithoutRepo.getUserTrustedDevices(1);

      expect(result).toEqual([]);
    });

    it('should filter out expired devices', async () => {
      const devices = [
        { ...mockTrustedDevice, id: 1, trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        { ...mockTrustedDevice, id: 2, trustedUntil: new Date(Date.now() - 1000) }, // Expired
      ];

      mockRepository.find.mockResolvedValue(devices as any);

      const result = await service.getUserTrustedDevices(1);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('should order devices by lastUsedAt DESC', async () => {
      const devices = [
        { ...mockTrustedDevice, id: 1, lastUsedAt: new Date('2025-01-01') },
        { ...mockTrustedDevice, id: 2, lastUsedAt: new Date('2025-01-02') },
      ];

      mockRepository.find.mockResolvedValue(devices as any);

      await service.getUserTrustedDevices(1);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { lastUsedAt: 'DESC' },
      });
    });

    it('should exclude deviceTokenHash from results', async () => {
      const devices = [
        {
          ...mockTrustedDevice,
          id: 1,
          deviceTokenHash: 'hash-123',
          trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ];

      mockRepository.find.mockResolvedValue(devices as any);

      const result = await service.getUserTrustedDevices(1);

      expect('deviceTokenHash' in result[0]).toBe(false);
      expect('id' in result[0]).toBe(true);
      expect('userId' in result[0]).toBe(true);
    });
  });
});
