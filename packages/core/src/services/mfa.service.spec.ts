import { Repository } from 'typeorm';
import { MFAService } from './mfa.service';
import { BaseMFADevice, BaseUser } from '../entities';
import { IUser, IMFADevice } from '../interfaces/entities.interface';
import { IMFAProviderService } from '../interfaces/mfa-provider.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { MFAMethod, MFADeviceMethod } from '../enums/mfa-method.enum';
import { ChallengeService } from './challenge.service';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ClientInfoService } from './client-info.service';
import { SetMFAExemptionDTO } from '../dto';
import { ContextStorage } from '../utils/context-storage';
import { SetupMFADTO } from '../dto/setup-mfa.dto';
import { SetPreferredMethodDTO } from '../dto/set-preferred-method.dto';

/**
 * MFA Service Unit Tests
 *
 * Tests MFA provider registry, verification routing, device management,
 * and user preference updates.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('MFAService', () => {
  let service: MFAService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockProvider1: jest.Mocked<IMFAProviderService>;
  let mockProvider2: jest.Mocked<IMFAProviderService>;

  const mockConfig: Partial<NAuthConfig> = {
    mfa: {
      enabled: true,
      enforcement: 'OPTIONAL',
      allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.PASSKEY],
    },
  };

  const mockUser: Partial<IUser> = {
    id: 1,
    sub: 'a21b654c-2746-4168-acee-c175083a65cd',
    email: 'test@example.com',
    mfaEnabled: true,
    mfaMethods: ['totp'],
    preferredMfaMethod: 'totp',
  };

  const mockDevice: Partial<IMFADevice> = {
    id: 1,
    userId: 1,
    type: 'totp' as MFADeviceMethod,
    name: 'My Device',
    isActive: true,
    isPrimary: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Create mock providers
    mockProvider1 = {
      methodName: 'totp',
      isMethodAllowed: jest.fn().mockReturnValue(true),
      setup: jest.fn(),
      verifySetup: jest.fn(),
      verify: jest.fn(),
    } as any;

    mockProvider2 = {
      methodName: 'sms',
      isMethodAllowed: jest.fn().mockReturnValue(true),
      setup: jest.fn(),
      verifySetup: jest.fn(),
      verify: jest.fn(),
    } as any;

    // Create mock repositories
    mockMfaDeviceRepository = {
      find: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    // Create mock services
    mockChallengeService = {
      createChallengeSession: jest.fn(),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn(),
    } as any;

    mockClientInfoService = {
      get: jest.fn(),
    } as any;

    // Instantiate service directly
    service = new MFAService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockChallengeService,
      mockConfig as NAuthConfig,
      mockLogger,
      mockAuditService,
      mockClientInfoService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // setMFAExemption() Method
  // ============================================================================

  describe('setMFAExemption', () => {
    it('should throw when user is not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const dto = new SetMFAExemptionDTO();
      dto.sub = 'a21b654c-2746-4168-acee-c175083a65cd';
      dto.exempt = true;
      dto.reason = 'Admin override';
      dto.grantedBy = 'admin@example.com';

      await expect(service.setMFAExemption(dto)).rejects.toThrow(NAuthException);
    });

    it('should grant exemption by resolving user via UUID sub identifier', async () => {
      const userSub = 'a21b654c-2746-4168-acee-c175083a65cd';
      const userEntity = {
        id: 42,
        sub: userSub,
        mfaEnabled: false,
        mfaExempt: false,
      } as unknown as BaseUser;

      mockUserRepository.findOne.mockImplementation(async (opts: unknown) => {
        const typed = opts as { where?: Partial<BaseUser>; select?: string[] };
        if (typed.where?.sub === userSub) {
          return userEntity;
        }
        if (typed.where?.id === userEntity.id && Array.isArray(typed.select)) {
          return {
            mfaExempt: true,
            mfaExemptReason: 'Admin override',
            mfaExemptGrantedAt: new Date('2024-01-01T00:00:00.000Z'),
          } as unknown as BaseUser;
        }
        return null;
      });

      mockUserRepository.update.mockResolvedValue({} as never);

      const dto = new SetMFAExemptionDTO();
      dto.sub = userSub;
      dto.exempt = true;
      dto.reason = 'Admin override';
      dto.grantedBy = 'admin@example.com';

      const result = await service.setMFAExemption(dto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: userSub } });
      expect(mockUserRepository.update).toHaveBeenCalledWith(userEntity.id, expect.objectContaining({ mfaExempt: true }));
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userEntity.id,
          eventType: AuthAuditEventType.MFA_EXEMPTION_GRANTED,
        }),
      );
      expect(result).toEqual({
        mfaExempt: true,
        mfaExemptReason: 'Admin override',
        mfaExemptGrantedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
    });

    it('should include performedByName in audit metadata when admin user is in context', async () => {
      const userSub = 'a21b654c-2746-4168-acee-c175083a65cd';
      const adminSub = 'admin-uuid-1234';
      const adminUser: Partial<IUser> = {
        id: 99,
        sub: adminSub,
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Admin',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: false,
        isLocked: false,
        mustChangePassword: false,
        mfaEnabled: false,
        hasSocialAuth: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const userEntity = {
        id: 42,
        sub: userSub,
        mfaEnabled: false,
        mfaExempt: false,
      } as unknown as BaseUser;

      // Set admin user in context
      ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', adminUser as IUser);

        mockUserRepository.findOne.mockImplementation(async (opts: unknown) => {
          const typed = opts as { where?: Partial<BaseUser>; select?: string[] };
          if (typed.where?.sub === userSub) {
            return userEntity;
          }
          if (typed.where?.id === userEntity.id && Array.isArray(typed.select)) {
            return {
              mfaExempt: true,
              mfaExemptReason: 'Admin override',
              mfaExemptGrantedAt: new Date('2024-01-01T00:00:00.000Z'),
            } as unknown as BaseUser;
          }
          return null;
        });

        mockUserRepository.update.mockResolvedValue({} as never);

        const dto = new SetMFAExemptionDTO();
        dto.sub = userSub;
        dto.exempt = true;
        dto.reason = 'Admin override';
        dto.grantedBy = adminSub;

        await service.setMFAExemption(dto);

        // Verify audit was called with performedByName in metadata
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: userEntity.id,
            eventType: AuthAuditEventType.MFA_EXEMPTION_GRANTED,
            performedBy: adminSub,
            metadata: expect.objectContaining({
              performedByName: 'John Admin',
            }),
          }),
        );
      });
    });

    it('should use email for performedByName when admin has no firstName/lastName', async () => {
      const userSub = 'a21b654c-2746-4168-acee-c175083a65cd';
      const adminSub = 'admin-uuid-5678';
      const adminUser: Partial<IUser> = {
        id: 100,
        sub: adminSub,
        email: 'admin2@example.com',
        firstName: null,
        lastName: null,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: false,
        isLocked: false,
        mustChangePassword: false,
        mfaEnabled: false,
        hasSocialAuth: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const userEntity = {
        id: 43,
        sub: userSub,
        mfaEnabled: false,
        mfaExempt: false,
      } as unknown as BaseUser;

      // Set admin user in context
      ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', adminUser as IUser);

        mockUserRepository.findOne.mockImplementation(async (opts: unknown) => {
          const typed = opts as { where?: Partial<BaseUser>; select?: string[] };
          if (typed.where?.sub === userSub) {
            return userEntity;
          }
          if (typed.where?.id === userEntity.id && Array.isArray(typed.select)) {
            return {
              mfaExempt: true,
              mfaExemptReason: 'Admin override',
              mfaExemptGrantedAt: new Date('2024-01-01T00:00:00.000Z'),
            } as unknown as BaseUser;
          }
          return null;
        });

        mockUserRepository.update.mockResolvedValue({} as never);

        const dto = new SetMFAExemptionDTO();
        dto.sub = userSub;
        dto.exempt = true;
        dto.reason = 'Admin override';
        dto.grantedBy = adminSub;

        await service.setMFAExemption(dto);

        // Verify audit was called with email as performedByName
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: userEntity.id,
            eventType: AuthAuditEventType.MFA_EXEMPTION_GRANTED,
            performedBy: adminSub,
            metadata: expect.objectContaining({
              performedByName: 'admin2@example.com',
            }),
          }),
        );
      });
    });
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // registerProvider() Method
  // ============================================================================

  describe('registerProvider', () => {
    it('should register provider successfully', () => {
      service.registerProvider(mockProvider1);

      expect(service.hasProvider({ methodName: 'totp' }).hasProvider).toBe(true);
    });

    it('should throw error when provider already registered', () => {
      service.registerProvider(mockProvider1);

      expect(() => service.registerProvider(mockProvider1)).toThrow(NAuthException);
      expect(() => service.registerProvider(mockProvider1)).toThrow('already registered');
    });

    it('should allow multiple different providers', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      expect(service.hasProvider({ methodName: 'totp' }).hasProvider).toBe(true);
      expect(service.hasProvider({ methodName: 'sms' }).hasProvider).toBe(true);
    });
  });

  // ============================================================================
  // getProvider() Method
  // ============================================================================

  describe('getProvider', () => {
    it('should return registered provider', () => {
      service.registerProvider(mockProvider1);

      const provider = service.getProvider('totp');

      expect(provider).toBe(mockProvider1);
    });

    it('should throw error when provider not registered', () => {
      expect(() => service.getProvider('totp')).toThrow(NAuthException);
      expect(() => service.getProvider('totp')).toThrow('not registered');
    });
  });

  // ============================================================================
  // hasProvider() Method
  // ============================================================================

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      service.registerProvider(mockProvider1);

      expect(service.hasProvider({ methodName: 'totp' }).hasProvider).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(service.hasProvider({ methodName: 'totp' }).hasProvider).toBe(false);
    });
  });

  // ============================================================================
  // listProviders() Method
  // ============================================================================

  describe('listProviders', () => {
    it('should return empty array when no providers registered', () => {
      expect(service.listProviders().providers).toEqual([]);
    });

    it('should return all registered provider names', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      const providers = service.listProviders().providers;

      expect(providers).toContain('totp');
      expect(providers).toContain('sms');
      expect(providers.length).toBe(2);
    });
  });

  // ============================================================================
  // getAvailableMethods() Method
  // ============================================================================

  describe('getAvailableMethods', () => {
    beforeEach(() => {
      mockUserRepository.findOne = jest.fn().mockResolvedValue(mockUser);
    });

    it('should return only allowed methods', async () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      const methods = await service.getAvailableMethods({ sub: mockUser.sub! });

      expect(methods.availableMethods).toContain('totp');
      expect(methods.availableMethods).toContain('sms');
    });

    it('should filter out methods not allowed by provider', async () => {
      const restrictedProvider = {
        ...mockProvider1,
        isMethodAllowed: jest.fn().mockReturnValue(false),
      };

      service.registerProvider(restrictedProvider);

      const methods = await service.getAvailableMethods({ sub: mockUser.sub! });

      expect(methods.availableMethods).not.toContain('totp');
    });

    it('should return empty array when no providers registered', async () => {
      const methods = await service.getAvailableMethods({ sub: mockUser.sub! });

      expect(methods).toEqual({ availableMethods: [] });
    });
  });

  // ============================================================================
  // verifyCode() Method
  // ============================================================================

  describe('verifyCode', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      mockUserRepository.findOne = jest.fn().mockResolvedValue(mockUser);
    });

    it('should route verification to correct provider', async () => {
      mockProvider1.verify.mockResolvedValue(true);

      const result = await service.verifyCode({ sub: mockUser.sub!, methodName: 'totp', code: '123456' });

      expect(result).toEqual({ valid: true });
      expect(mockProvider1.verify).toHaveBeenCalledWith('123456', undefined);
    });

    it('should throw error when provider not registered', async () => {
      try {
        await service.verifyCode({ sub: mockUser.sub!, methodName: 'sms', code: '123456' });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
      }
    });

    it('should handle backup code verification', async () => {
      // Create a new service instance to avoid provider already registered error
      const serviceForBackupTest = new MFAService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockChallengeService,
        mockConfig as NAuthConfig,
        mockLogger,
        mockAuditService,
        mockClientInfoService,
      );

      const providerWithBackup = {
        ...mockProvider1,
        verifyBackupCode: jest.fn().mockResolvedValue(true),
      };

      serviceForBackupTest.registerProvider(providerWithBackup);

      const result = await serviceForBackupTest.verifyCode({ sub: mockUser.sub!, methodName: MFAMethod.BACKUP, code: 'ABC12345' });

      expect(result).toEqual({ valid: true });
      expect(providerWithBackup.verifyBackupCode).toHaveBeenCalledWith(mockUser as IUser, 'ABC12345');
    });

    it('should throw error when backup code verification not available', async () => {
      try {
        await service.verifyCode({ sub: mockUser.sub!, methodName: MFAMethod.BACKUP, code: 'ABC12345' });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Backup code verification not available');
      }
    });

    it('should pass deviceId to provider', async () => {
      mockProvider1.verify.mockResolvedValue(true);

      await service.verifyCode({ sub: mockUser.sub!, methodName: 'totp', code: '123456', deviceId: 1 });

      expect(mockProvider1.verify).toHaveBeenCalledWith('123456', 1);
    });
  });

  // ============================================================================
  // setup() Method
  // ============================================================================

  describe('setup', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
    });

    it('should route setup to correct provider', async () => {
      const setupData = { secret: 'test-secret', qrCode: 'data:image/png;base64,...' };
      mockProvider1.setup.mockResolvedValue(setupData);

      const result = await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser as IUser);
        const dto = Object.assign(new SetupMFADTO(), { methodName: 'totp' });
        return await service.setup(dto);
      });

      expect(result).toEqual({ setupData });
      expect(mockProvider1.setup).toHaveBeenCalledWith(undefined);
    });

    it('should throw error when provider not registered', async () => {
      try {
        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', mockUser as IUser);
          const dto = Object.assign(new SetupMFADTO(), { methodName: 'sms' });
          return await service.setup(dto);
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
      }
    });

    it('should pass setupData to provider', async () => {
      const setupData = { secret: 'test-secret' };
      mockProvider1.setup.mockResolvedValue(setupData);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser as IUser);
        const dto = Object.assign(new SetupMFADTO(), { methodName: 'totp', setupData: { phoneNumber: '+1234567890' } });
        return await service.setup(dto);
      });

      expect(mockProvider1.setup).toHaveBeenCalledWith({ phoneNumber: '+1234567890' });
    });
  });

  // ============================================================================
  // getUserDevices() Method
  // ============================================================================

  describe('getUserDevices', () => {
    it('should return user devices ordered by primary and creation date', async () => {
      const devices = [
        { ...mockDevice, id: 1, isPrimary: true },
        { ...mockDevice, id: 2, isPrimary: false },
      ];

      mockMfaDeviceRepository.find.mockResolvedValue(devices as any);

      const result = await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser as IUser);
        return await service.getUserDevices({});
      });

      expect(result).toEqual({ devices: devices as any });
      expect(mockMfaDeviceRepository.find).toHaveBeenCalledWith({
        where: { userId: 1, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when no devices found', async () => {
      mockMfaDeviceRepository.find.mockResolvedValue([]);

      const result = await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser as IUser);
        return await service.getUserDevices({});
      });

      expect(result).toEqual({ devices: [] });
    });
  });

  // ============================================================================
  // removeDevices() Method
  // ============================================================================

  describe('removeDevices', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
    });

    it('should remove devices of specified method type', async () => {
      const userEntity = { ...mockUser, id: 1, preferredMfaMethod: 'totp' };
      const devices = [
        { ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true },
        { ...mockDevice, id: 2, type: 'sms' as MFADeviceMethod, isActive: true },
      ];

      mockMfaDeviceRepository.find
        .mockResolvedValueOnce(devices as any) // getUserDevices call
        .mockResolvedValueOnce([devices[1]] as any); // After deletion
      mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.save.mockResolvedValue(userEntity as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      const result = await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as IUser);
        return await service.removeDevices({ methodType: 'totp' } as any);
      });

      expect(result.deletedCount).toBe(1);
      expect(result.mfaDisabled).toBe(false);
      expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw error when method type is invalid', async () => {
      try {
        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', mockUser as IUser);
          return await service.removeDevices({ methodType: 'invalid' } as any);
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Validation failed');
      }
    });

    it('should throw error when no devices of method type found', async () => {
      const userEntity = { ...mockUser, id: 1 };
      const devices = [{ ...mockDevice, id: 1, type: 'sms' as MFADeviceMethod, isActive: true }];

      mockMfaDeviceRepository.find.mockResolvedValue(devices as any);

      try {
        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', userEntity as IUser);
          return await service.removeDevices({ methodType: 'totp' } as any);
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('No active totp MFA devices found');
      }
    });

    it('should disable MFA when last device removed', async () => {
      const userEntity = { ...mockUser, id: 1, mfaEnabled: true, mfaMethods: ['totp'] };
      const devices = [{ ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true }];

      mockMfaDeviceRepository.find
        .mockResolvedValueOnce(devices as any) // getUserDevices call
        .mockResolvedValueOnce([]); // After deletion - no devices remain
      mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      const result = await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as IUser);
        return await service.removeDevices({ methodType: 'totp' } as any);
      });

      expect(result.mfaDisabled).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 1 } as any,
        { mfaEnabled: false, mfaMethods: [], preferredMfaMethod: null } as any,
      );
    });

    it('should create MFA_SETUP_REQUIRED challenge when MFA disabled and enforcement is REQUIRED', async () => {
      const userEntity = {
        ...mockUser,
        id: 1,
        mfaEnabled: true,
        mfaMethods: ['totp'],
      };
      const devices = [{ ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true }];
      const configWithEnforcement: Partial<NAuthConfig> = {
        mfa: {
          enabled: true,
          enforcement: 'REQUIRED',
          allowedMethods: [MFAMethod.TOTP as any, MFAMethod.SMS as any],
        },
      };

      const serviceWithEnforcement = new MFAService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockChallengeService,
        configWithEnforcement as NAuthConfig,
        mockLogger,
        mockAuditService,
        mockClientInfoService,
      );

      mockMfaDeviceRepository.find.mockResolvedValueOnce(devices as any).mockResolvedValueOnce([]);
      mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.save.mockResolvedValue(userEntity as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);
      mockChallengeService.createChallengeSession.mockResolvedValue({} as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as IUser);
        return await serviceWithEnforcement.removeDevices({ methodType: 'totp' } as any);
      });

      expect(mockChallengeService.createChallengeSession).toHaveBeenCalledWith(
        userEntity as IUser,
        AuthChallenge.MFA_SETUP_REQUIRED,
        (expect as any).objectContaining({
          allowedMethods: ['totp', 'sms'],
          requiresSetup: true,
        }),
      );
    });

    it('should update preferred method when removed method was preferred', async () => {
      const userEntity = { ...mockUser, id: 1, preferredMfaMethod: 'totp' };
      const devices = [
        { ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true },
        { ...mockDevice, id: 2, type: 'sms' as MFADeviceMethod, isActive: true },
      ];

      mockMfaDeviceRepository.find.mockResolvedValueOnce(devices as any).mockResolvedValueOnce([devices[1]] as any);
      mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockMfaDeviceRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as IUser);
        return await service.removeDevices({ methodType: 'totp' } as any);
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 1 } as any,
        expect.objectContaining({ preferredMfaMethod: 'sms' }) as any,
      );
      expect(mockMfaDeviceRepository.update).toHaveBeenCalledWith({ id: 2 } as any, { isPrimary: true } as any);
    });

    it('should record audit event when device removed', async () => {
      const userEntity = { ...mockUser, id: 1 };
      const devices = [{ ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true }];

      mockMfaDeviceRepository.find.mockResolvedValueOnce(devices as any).mockResolvedValueOnce([]);
      mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.save.mockResolvedValue(userEntity as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as IUser);
        return await service.removeDevices({ methodType: 'totp' } as any);
      });

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          eventType: AuthAuditEventType.MFA_DISABLED,
          eventStatus: 'INFO',
          reason: 'all_devices_removed',
        }),
      );
    });
  });

  // ============================================================================
  // setPreferredMethod() Method
  // ============================================================================

  describe('setPreferredMethod', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
    });

    it('should set preferred method successfully', async () => {
      const userEntity = { ...mockUser, id: 1, preferredMfaMethod: 'totp' };
      const devices = [
        { ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true },
        { ...mockDevice, id: 2, type: 'sms' as MFADeviceMethod, isActive: true },
      ];

      mockMfaDeviceRepository.find.mockResolvedValue(devices as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockMfaDeviceRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as unknown as IUser);
        const dto = Object.assign(new SetPreferredMethodDTO(), { methodType: 'sms' });
        return await service.setPreferredMethod(dto);
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith({ id: 1 } as any, { preferredMfaMethod: 'sms' } as any);
      expect(mockMfaDeviceRepository.update).toHaveBeenCalledWith({ id: 2 } as any, { isPrimary: true } as any);
    });

    it('should throw error when method type is invalid', async () => {
      try {
        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', mockUser as IUser);
          const dto = Object.assign(new SetPreferredMethodDTO(), { methodType: 'invalid' });
          return await service.setPreferredMethod(dto);
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Validation failed');
      }
    });

    it('should throw error when user not found', async () => {
      try {
        const dto = Object.assign(new SetPreferredMethodDTO(), { methodType: 'totp' });
        await service.setPreferredMethod(dto);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.FORBIDDEN);
      }
    });

    it('should throw error when method not configured for user', async () => {
      const userEntity = { ...mockUser, id: 1 };
      const devices = [{ ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true }];

      mockMfaDeviceRepository.find.mockResolvedValue(devices as any);

      try {
        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', userEntity as unknown as IUser);
          const dto = Object.assign(new SetPreferredMethodDTO(), { methodType: 'sms' });
          return await service.setPreferredMethod(dto);
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('is not configured for this user');
      }
    });

    it('should update device primary flags correctly', async () => {
      const userEntity = { ...mockUser, id: 1 };
      const devices = [
        { ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true },
        { ...mockDevice, id: 2, type: 'sms' as MFADeviceMethod, isActive: true },
        { ...mockDevice, id: 3, type: 'sms' as MFADeviceMethod, isActive: true },
      ];

      mockMfaDeviceRepository.find.mockResolvedValue(devices as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockMfaDeviceRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as unknown as IUser);
        const dto = Object.assign(new SetPreferredMethodDTO(), { methodType: 'sms' });
        return await service.setPreferredMethod(dto);
      });

      // Should set device 2 (first SMS device) as primary
      expect(mockMfaDeviceRepository.update).toHaveBeenCalledWith({ id: 2 } as any, { isPrimary: true } as any);
      // Should unset primary on other devices
      expect(mockMfaDeviceRepository.update).toHaveBeenCalledWith({ id: 1 } as any, { isPrimary: false } as any);
      expect(mockMfaDeviceRepository.update).toHaveBeenCalledWith({ id: 3 } as any, { isPrimary: false } as any);
    });

    it('should record audit event when preferred method updated', async () => {
      const userEntity = { ...mockUser, id: 1, preferredMfaMethod: 'totp' };
      const devices = [
        { ...mockDevice, id: 1, type: 'totp' as MFADeviceMethod, isActive: true },
        { ...mockDevice, id: 2, type: 'sms' as MFADeviceMethod, isActive: true },
      ];

      mockMfaDeviceRepository.find.mockResolvedValue(devices as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockMfaDeviceRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue({} as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userEntity as unknown as IUser);
        const dto = Object.assign(new SetPreferredMethodDTO(), { methodType: 'sms' });
        return await service.setPreferredMethod(dto);
      });

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          eventType: AuthAuditEventType.MFA_PREFERRED_METHOD_UPDATED,
          eventStatus: 'INFO',
          metadata: (expect as any).objectContaining({
            previousMethod: 'totp',
            newMethod: 'sms',
            deviceId: 2,
          }),
        }),
      );
    });
  });
});
