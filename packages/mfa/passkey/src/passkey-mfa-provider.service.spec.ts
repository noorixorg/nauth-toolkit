import 'reflect-metadata';
import { Repository } from 'typeorm';
import { PasskeyMFAProviderService } from './passkey-mfa-provider.service';
import { PasskeyService } from './passkey.service';
import {
  BaseMFADevice,
  BaseUser,
  IUser,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  MFAMethod,
  IMFADevice,
} from '@nauth-toolkit/core';
import { SetupPasskeyResponseDTO, VerifyPasskeySetupDTO, GetPasskeyChallengeResponseDTO } from './dto/mfa.dto';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';

/**
 * Passkey MFA Provider Service Unit Tests
 *
 * Tests Passkey MFA provider implementation including setup, verification,
 * challenge generation, and device management. Uses direct instantiation, no NestJS dependencies.
 */
describe('PasskeyMFAProviderService', () => {
  let service: PasskeyMFAProviderService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockPasswordService: unknown;
  let mockPasskeyService: jest.Mocked<PasskeyService>;
  let mockUser: IUser;

  beforeEach(() => {
    // Create mock repositories
    mockMfaDeviceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as any;

    // Create mock transactional entity manager factory
    const createMockTransactionalEntityManager = () => {
      const mockDeviceRepo = {
        create: jest.fn((data) => ({ id: 1, userId: 1, type: MFAMethod.PASSKEY, ...data })),
        save: jest.fn((data) => Promise.resolve({ id: 1, userId: 1, type: MFAMethod.PASSKEY, ...data })),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null), // No existing device
        })),
      };

      return {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 1 }), // User exists
        })),
        getRepository: jest.fn(() => mockDeviceRepo),
      };
    };

    mockUserRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      target: BaseUser,
      manager: {
        transaction: jest.fn(async (callback) => {
          // Create fresh mock transactional entity manager for each transaction
          const mockTransactionalEntityManager = createMockTransactionalEntityManager();
          return await callback(mockTransactionalEntityManager);
        }),
      },
    } as any;

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock config
    mockConfig = {
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.PASSKEY as any],
      },
    } as NAuthConfig;

    // Create mock password service
    mockPasswordService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };

    // Create mock passkey service
    mockPasskeyService = {
      generateRegistrationOptions: jest.fn(),
      verifyRegistration: jest.fn(),
      generateAuthenticationOptions: jest.fn(),
      verifyAuthentication: jest.fn(),
    } as any;

    // Create mock user
    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      mfaEnabled: false,
    } as IUser;

    // Instantiate service directly
    service = new PasskeyMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      mockPasswordService,
      mockPasskeyService,
      undefined, // challengeService (optional)
      undefined, // auditService (optional)
      undefined, // clientInfoService (optional)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.methodName).toBe(MFAMethod.PASSKEY);
  });

  // ============================================================================
  // isMethodAllowed() Method
  // ============================================================================

  describe('isMethodAllowed', () => {
    it('should return true when Passkey is in allowed methods', () => {
      const result = service.isMethodAllowed();
      expect(result).toBe(true);
    });

    it('should return false when Passkey is not in allowed methods', () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];
      const result = service.isMethodAllowed();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // setup() Method
  // ============================================================================

  describe('setup', () => {
    it('should generate registration options', async () => {
      const mockOptions: SetupPasskeyResponseDTO = {
        options: {
          challenge: 'base64-challenge',
          rp: { name: 'TestApp', id: 'testapp.com' },
          user: { id: 'user-id', name: 'user@example.com', displayName: 'John Doe' },
          pubKeyCredParams: [],
          timeout: 60000,
          attestation: 'none',
        },
      };

      mockMfaDeviceRepository.find.mockResolvedValue([]);
      mockPasskeyService.generateRegistrationOptions.mockResolvedValue(mockOptions);

      const result = await service.setup(mockUser);

      expect(result).toEqual(mockOptions);
      expect(mockPasskeyService.generateRegistrationOptions).toHaveBeenCalledWith(
        'user-123',
        'user@example.com',
        'John Doe',
        [],
      );
      const logCalls = (mockLogger.log as jest.Mock).mock.calls;
      const hasSetupCall = logCalls.some(
        (call: any[]) => call[0] && typeof call[0] === 'string' && call[0].includes('Setting up passkey'),
      );
      expect(hasSetupCall).toBe(true);
    });

    it('should exclude existing passkey devices', async () => {
      const existingDevices = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.PASSKEY,
          name: 'Existing Device',
          credentialId: 'existing-cred-id',
          isActive: true,
        },
      ];

      const mockOptions: SetupPasskeyResponseDTO = {
        options: {
          challenge: 'base64-challenge',
          rp: { name: 'TestApp', id: 'testapp.com' },
          user: { id: 'user-id', name: 'user@example.com', displayName: 'John Doe' },
          pubKeyCredParams: [],
          timeout: 60000,
          attestation: 'none',
        },
      };

      mockMfaDeviceRepository.find.mockResolvedValue(existingDevices as any);
      mockPasskeyService.generateRegistrationOptions.mockResolvedValue(mockOptions);

      await service.setup(mockUser);

      expect(mockPasskeyService.generateRegistrationOptions).toHaveBeenCalledWith(
        'user-123',
        'user@example.com',
        'John Doe',
        existingDevices as any,
      );
    });

    it('should throw error when Passkey is not enabled', async () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];

      try {
        await service.setup(mockUser);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Passkey is not enabled');
      }
    });
  });

  // ============================================================================
  // verifySetup() Method
  // ============================================================================

  describe('verifySetup', () => {
    const mockCredential: RegistrationResponseJSON = {
      id: 'credential-id',
      rawId: 'base64-raw-id',
      response: {
        clientDataJSON: 'base64-client-data',
        attestationObject: 'base64-attestation',
        clientExtensionResults: {},
      },
      type: 'public-key',
      clientExtensionResults: {},
    } as RegistrationResponseJSON;

    const verifyDto: VerifyPasskeySetupDTO = {
      credential: mockCredential,
      deviceName: 'iPhone 15 Pro',
    };

    it('should verify passkey registration and create device', async () => {
      const mockVerification = {
        verified: true,
        credentialId: 'credential-id',
        publicKey: 'public-key-base64url',
        counter: 0,
        transports: ['usb'],
      };

      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.PASSKEY,
        name: 'iPhone 15 Pro',
        credentialId: 'credential-id',
        publicKey: 'public-key-base64url',
        counter: 0,
        transports: ['usb'],
        isActive: true,
        isPrimary: true,
      };

      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      mockPasskeyService.verifyRegistration.mockResolvedValue(mockVerification);
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const verificationData = {
        credential: verifyDto,
        expectedChallenge: 'expected-challenge',
        transports: ['usb'],
      };

      const result = await service.verifySetup(mockUser, verificationData);

      expect(result).toBe(1);
      expect(mockPasskeyService.verifyRegistration).toHaveBeenCalledWith(mockCredential, 'expected-challenge', ['usb']);
      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw error when expectedChallenge is missing', async () => {
      const verificationData = {
        credential: verifyDto,
      } as any;

      try {
        await service.verifySetup(mockUser, verificationData as any);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Passkey verification requires');
      }
    });

    it('should throw error when credential structure is invalid', async () => {
      const invalidCredential = {
        credential: {
          id: 'credential-id',
          // Missing rawId and response
        },
        expectedChallenge: 'expected-challenge',
      };

      try {
        await service.verifySetup(mockUser, invalidCredential as any);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Credential is required');
      }
    });

    it('should throw error when verification fails', async () => {
      const mockVerification = {
        verified: false,
        credentialId: 'credential-id',
        publicKey: 'public-key-base64url',
        counter: 0,
        transports: ['usb'],
      };

      mockPasskeyService.verifyRegistration.mockResolvedValue(mockVerification);

      const verificationData = {
        credential: verifyDto,
        expectedChallenge: 'expected-challenge',
      };

      try {
        await service.verifySetup(mockUser, verificationData);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Passkey verification failed');
      }
    });

    it('should use deviceName parameter if provided', async () => {
      const mockVerification = {
        verified: true,
        credentialId: 'credential-id',
        publicKey: 'public-key-base64url',
        counter: 0,
        transports: [],
      };

      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.PASSKEY,
        name: 'Custom Device Name',
        credentialId: 'credential-id',
        publicKey: 'public-key-base64url',
        counter: 0,
        isActive: true,
        isPrimary: true,
      };

      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      mockPasskeyService.verifyRegistration.mockResolvedValue(mockVerification);
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const verificationData = {
        credential: verifyDto,
        expectedChallenge: 'expected-challenge',
      };

      await service.verifySetup(mockUser, verificationData, 'Custom Device Name');

      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // verify() Method
  // ============================================================================

  describe('verify', () => {
    const mockCredential: AuthenticationResponseJSON = {
      id: 'credential-id',
      rawId: 'base64-raw-id',
      response: {
        clientDataJSON: 'base64-client-data',
        authenticatorData: 'base64-authenticator-data',
        signature: 'base64-signature',
        userHandle: undefined,
      },
      type: 'public-key',
      clientExtensionResults: {},
    } as AuthenticationResponseJSON;

    const mockDevice = {
      id: 1,
      userId: 1,
      type: MFAMethod.PASSKEY,
      name: 'Device 1',
      credentialId: 'credential-id',
      publicKey: 'public-key-base64url',
      counter: 0,
      isActive: true,
    };

    it('should verify passkey authentication successfully', async () => {
      const mockVerification = {
        verified: true,
        newCounter: 1,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockPasskeyService.verifyAuthentication.mockResolvedValue(mockVerification);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);

      const verificationData = {
        credential: mockCredential,
        expectedChallenge: 'expected-challenge',
      };

      const result = await service.verify(mockUser, verificationData);

      expect(result).toBe(true);
      expect(mockPasskeyService.verifyAuthentication).toHaveBeenCalledWith(
        mockCredential,
        'expected-challenge',
        (expect as any).objectContaining({
          credentialId: 'credential-id',
        }),
      );
      expect(mockMfaDeviceRepository.save).toHaveBeenCalled();
    });

    it('should return false for invalid verification data format', async () => {
      const result = await service.verify(mockUser, null as any);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid passkey verification data format');
    });

    it('should return false when device not found', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(null);

      const verificationData = {
        credential: mockCredential,
        expectedChallenge: 'expected-challenge',
      };

      const result = await service.verify(mockUser, verificationData);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Passkey device not found');
    });

    it('should find device by credential ID when deviceId not provided', async () => {
      const mockVerification = {
        verified: true,
        newCounter: 1,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockPasskeyService.verifyAuthentication.mockResolvedValue(mockVerification);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);

      const verificationData = {
        credential: mockCredential,
        expectedChallenge: 'expected-challenge',
      };

      await service.verify(mockUser, verificationData);

      expect(mockMfaDeviceRepository.findOne).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          where: (expect as any).objectContaining({
            credentialId: 'credential-id',
          }),
        }),
      );
    });

    it('should update device counter and usage on successful verification', async () => {
      const mockVerification = {
        verified: true,
        newCounter: 1,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockPasskeyService.verifyAuthentication.mockResolvedValue(mockVerification);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);

      const verificationData = {
        credential: mockCredential,
        expectedChallenge: 'expected-challenge',
      };

      await service.verify(mockUser, verificationData);

      const saveCall = mockMfaDeviceRepository.save.mock.calls[0][0] as any;
      expect(saveCall.counter).toBe(1);
      expect(saveCall.lastUsedAt).toBeInstanceOf(Date);
      expect(saveCall.usageCount).toBeGreaterThan(0);
    });

    it('should return false when verification fails', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockPasskeyService.verifyAuthentication.mockRejectedValue(
        new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Verification failed'),
      );

      const verificationData = {
        credential: mockCredential,
        expectedChallenge: 'expected-challenge',
      };

      const result = await service.verify(mockUser, verificationData);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // sendChallenge() Method
  // ============================================================================

  describe('sendChallenge', () => {
    it('should generate authentication options', async () => {
      const mockDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.PASSKEY,
          name: 'Device 1',
          credentialId: 'credential-id',
          isActive: true,
        } as IMFADevice,
      ];

      const mockOptions: GetPasskeyChallengeResponseDTO = {
        options: {
          challenge: 'base64-challenge',
          timeout: 60000,
          rpId: 'testapp.com',
          allowCredentials: [],
          userVerification: 'preferred',
        },
      };

      mockMfaDeviceRepository.find.mockResolvedValue(mockDevices as any);
      mockPasskeyService.generateAuthenticationOptions.mockResolvedValue(mockOptions);

      const result = await service.sendChallenge(mockUser);

      expect(result).toEqual(mockOptions);
      expect(mockPasskeyService.generateAuthenticationOptions).toHaveBeenCalledWith(mockDevices);
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Generating passkey challenge'));
    });

    it('should throw error when no passkey devices registered', async () => {
      mockMfaDeviceRepository.find.mockResolvedValue([]);

      try {
        await service.sendChallenge(mockUser);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.NOT_FOUND);
        expect((error as NAuthException).message).toContain('No passkey devices registered');
      }
    });

    it('should filter only active passkey devices', async () => {
      const mockDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.PASSKEY,
          name: 'Active Device',
          credentialId: 'credential-id',
          isActive: true,
        } as IMFADevice,
        {
          id: 2,
          userId: 1,
          type: MFAMethod.PASSKEY,
          name: 'Inactive Device',
          credentialId: 'credential-id-2',
          isActive: false,
        } as IMFADevice,
      ];

      const mockOptions: GetPasskeyChallengeResponseDTO = {
        options: {
          challenge: 'base64-challenge',
          timeout: 60000,
          rpId: 'testapp.com',
          allowCredentials: [],
          userVerification: 'preferred',
        },
      };

      mockMfaDeviceRepository.find.mockResolvedValue(mockDevices as any);
      mockPasskeyService.generateAuthenticationOptions.mockResolvedValue(mockOptions);

      await service.sendChallenge(mockUser);

      expect(mockPasskeyService.generateAuthenticationOptions).toHaveBeenCalledWith(
        (expect as any).arrayContaining([
          (expect as any).objectContaining({
            isActive: true,
          }),
        ]),
      );
    });
  });
});
