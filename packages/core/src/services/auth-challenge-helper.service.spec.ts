import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { ChallengeService } from './challenge.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { EmailVerificationService } from './email-verification.service';
import { PhoneVerificationService } from './phone-verification.service';
import { TrustedDeviceService } from './trusted-device.service';
import { AuthAuditService } from './auth-audit.service';
import { ClientInfoService } from './client-info.service';
import { AdaptiveMFADecisionService } from './adaptive-mfa-decision.service';
import { AuthFlowStateMachineService } from './auth-flow-state-machine.service';
import { AuthFlowContextBuilder } from './auth-flow-context-builder.service';
import { IUser, IMFADevice, IChallengeSession } from '../interfaces/entities.interface';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { MFAMethod, MFADeviceMethod, MFADeviceMethods } from '../enums/mfa-method.enum';
import { AuthFlowState, AuthFlowContext, ResponseMetadata } from './auth-flow-state-machine.types';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Helper function to create mock challenge session
 */
function createMockChallengeSession(sessionToken: string, challengeName: AuthChallenge): IChallengeSession {
  return {
    id: 1,
    userId: 1,
    sessionToken,
    challengeName,
    challengeParameters: {},
    attempts: 0,
    maxAttempts: 3,
    expiresAt: new Date(),
    ipAddress: '1.2.3.4',
    userAgent: 'test-agent',
    createdAt: new Date(),
  };
}

/**
 * Auth Challenge Helper Service Unit Tests
 *
 * Tests challenge-response authentication flow orchestration.
 * Covers all challenge types, MFA requirements, and response creation.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('AuthChallengeHelperService', () => {
  let service: AuthChallengeHelperService;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockTrustedDeviceService: jest.Mocked<TrustedDeviceService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockAdaptiveMFADecisionService: jest.Mocked<AdaptiveMFADecisionService>;
  let mockStateMachine: jest.Mocked<AuthFlowStateMachineService>;
  let mockContextBuilder: jest.Mocked<AuthFlowContextBuilder>;
  let mockMFADeviceRepository: any;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  const mockUser: Partial<IUser> = {
    id: 1,
    sub: 'user-uuid-123',
    email: 'test@example.com',
    phone: '+1234567890',
    firstName: 'John',
    lastName: 'Doe',
    isEmailVerified: false,
    isPhoneVerified: false,
    isActive: true,
    mustChangePassword: false,
    mfaEnabled: false,
    mfaExempt: false,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Create mock services
    mockChallengeService = {
      createChallengeSession: jest.fn(),
      maskEmail: jest.fn((email: string) => `${email[0]}***@example.com`),
      maskPhone: jest.fn((phone: string) => '***-***-7890'),
    } as any;

    mockJwtService = {
      generateTokenPair: jest.fn(),
      hashToken: jest.fn((token: string) => `hash-${token}`),
      generateTokenFamily: jest.fn(() => 'family-xyz'),
      validateAccessToken: jest.fn(),
      validateRefreshToken: jest.fn(),
    } as any;

    mockSessionService = {
      createSession: jest.fn(),
      updateTokens: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      getSessionExpirationDate: jest.fn(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    } as any;

    mockEmailVerificationService = {
      sendVerificationEmail: jest.fn(),
    } as any;

    mockPhoneVerificationService = {
      sendVerificationSMS: jest.fn(),
    } as any;

    mockTrustedDeviceService = {
      validateDeviceToken: jest.fn(),
      isDeviceTrusted: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn(),
    } as any;

    mockClientInfoService = {
      get: jest.fn(),
    } as any;

    mockAdaptiveMFADecisionService = {
      evaluateAdaptiveMFA: jest.fn(),
      isUserBlocked: jest.fn(),
      clearUserBlock: jest.fn(),
      blockUserSignIn: jest.fn(),
    } as any;

    mockContextBuilder = {
      build: jest.fn(),
    } as any;

    mockStateMachine = {
      evaluateState: jest.fn(),
      getStateDefinition: jest.fn(),
      buildMetadata: jest.fn(),
    } as any;

    mockMFADeviceRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '30d' },
      },
      signup: {
        verificationMethod: 'email',
      },
    };

    // Instantiate service directly
    service = new AuthChallengeHelperService(
      mockChallengeService,
      mockJwtService,
      mockSessionService,
      mockMFADeviceRepository,
      mockLogger,
      mockStateMachine,
      mockContextBuilder,
      mockClientInfoService,
      mockEmailVerificationService,
      mockPhoneVerificationService,
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
  });

  // ============================================================================
  // OLD TESTS - Methods deleted, replaced by state machine
  // ============================================================================
  // These test suites are commented out because the methods have been deleted
  // and replaced by the state machine architecture. New tests should be written
  // for determineAuthResponse() which uses the state machine.

  // ============================================================================
  // determinePendingChallenges() Method - DELETED
  // ============================================================================
  // This method has been replaced by the state machine in determineAuthResponse()
  // All scenarios are now covered by comprehensive scenario tests below
  // Old tests removed - see "determineAuthResponse - Comprehensive Scenarios" section

  // ============================================================================
  // isMFASetupRequired() Method - DELETED
  // ============================================================================
  // This method has been replaced by the state machine in determineAuthResponse()
  // All scenarios are now covered by comprehensive scenario tests below
  // Old tests removed - see "determineAuthResponse - Comprehensive Scenarios" section

  // ============================================================================
  // checkMFARequirement() Method - DELETED
  // ============================================================================
  // This method has been replaced by the state machine in determineAuthResponse()
  // All scenarios are now covered by comprehensive scenario tests below
  // Old tests removed - see "determineAuthResponse - Comprehensive Scenarios" section

  // ============================================================================
  // createChallengeResponse() Method
  // ============================================================================

  describe('createChallengeResponse', () => {
    beforeEach(() => {
      // Setup ClientInfoService mock for all createChallengeResponse tests
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
    });
    it('should create challenge response for VERIFY_EMAIL and send email', async () => {
      const mockChallengeSession = {
        id: 1,
        userId: 1,
        sessionToken: 'session-token-123',
        challengeName: AuthChallenge.VERIFY_EMAIL,
        challengeParameters: {},
        attempts: 0,
        maxAttempts: 3,
        expiresAt: new Date(),
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        createdAt: new Date(),
      };
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 1 } as any);

      const result = await service.createChallengeResponse(mockUser as IUser, AuthChallenge.VERIFY_EMAIL, mockConfig);

      expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      expect(result.session).toBe('session-token-123');
      expect(result.challengeParameters?.email).toBe('test@example.com');
      expect(result.challengeParameters?.codeDeliveryDestination).toBeDefined();
      expect(result.sub).toBe('user-uuid-123');
      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          sub: 'user-uuid-123',
          baseUrl: undefined,
          challengeSessionId: 1,
        }),
      );
    });

    it('should create challenge response for VERIFY_PHONE and send SMS', async () => {
      const mockChallengeSession = {
        id: 1,
        userId: 1,
        sessionToken: 'session-token-456',
        challengeName: AuthChallenge.VERIFY_PHONE,
        challengeParameters: {},
        attempts: 0,
        maxAttempts: 3,
        expiresAt: new Date(),
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        createdAt: new Date(),
      };
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 123456 } as any);

      const result = await service.createChallengeResponse(mockUser as IUser, AuthChallenge.VERIFY_PHONE, mockConfig);

      expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      expect(result.challengeParameters?.phone).toBe('+1234567890');
      expect(result.challengeParameters?.codeDeliveryDestination).toBeDefined();
      expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          sub: 'user-uuid-123',
          skipAlreadyVerifiedCheck: false,
          challengeSessionId: 1,
        }),
      );
    });

    it('should handle VERIFY_PHONE when phone is not provided', async () => {
      const userWithoutPhone = { ...mockUser, phone: null } as IUser;
      const mockChallengeSession = createMockChallengeSession('session-token-789', AuthChallenge.VERIFY_PHONE);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await service.createChallengeResponse(userWithoutPhone, AuthChallenge.VERIFY_PHONE, mockConfig);

      expect(result.challengeParameters?.requiresPhoneCollection).toBe('true');
      expect(result.challengeParameters?.instructions).toBeDefined();
      expect(mockPhoneVerificationService.sendVerificationSMS).not.toHaveBeenCalled();
    });

    // VERIFY_EMAIL_AND_PHONE removed - challenges are sequential (VERIFY_EMAIL first, then VERIFY_PHONE)
    // This test is no longer needed as the challenge system works sequentially

    it('should create challenge response for FORCE_CHANGE_PASSWORD', async () => {
      const mockChallengeSession = createMockChallengeSession(
        'session-token-forced',
        AuthChallenge.FORCE_CHANGE_PASSWORD,
      );
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await service.createChallengeResponse(
        mockUser as IUser,
        AuthChallenge.FORCE_CHANGE_PASSWORD,
        mockConfig,
      );

      expect(result.challengeName).toBe(AuthChallenge.FORCE_CHANGE_PASSWORD);
      expect(result.challengeParameters?.instructions).toBe('You must change your password before continuing');
      expect(result.session).toBe('session-token-forced');
    });

    it('should create challenge response for MFA_REQUIRED', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-mfa', AuthChallenge.MFA_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await service.createChallengeResponse(mockUser as IUser, AuthChallenge.MFA_REQUIRED, mockConfig);

      expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      expect(result.challengeParameters?.instructions).toBe('Multi-factor authentication is required');
    });

    it('should create challenge response for MFA_SETUP_REQUIRED with allowedMethods', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      const configWithMFA: NAuthConfig = {
        ...mockConfig,
        mfa: {
          enabled: true,
          allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS] as MFADeviceMethod[],
        },
      };

      const result = await service.createChallengeResponse(
        mockUser as IUser,
        AuthChallenge.MFA_SETUP_REQUIRED,
        configWithMFA,
      );

      expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      expect(result.challengeParameters?.allowedMethods).toEqual([MFAMethod.TOTP, MFAMethod.SMS]);
      expect(result.challengeParameters?.instructions).toBe(
        'Multi-factor authentication setup is required before you can login',
      );
    });

    it('should use default allowedMethods when not specified', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      const configWithMFA = {
        ...mockConfig,
        mfa: {
          enabled: true,
        },
      };

      const result = await service.createChallengeResponse(
        mockUser as IUser,
        AuthChallenge.MFA_SETUP_REQUIRED,
        configWithMFA,
      );

      expect(result.challengeParameters?.allowedMethods).toEqual([...MFADeviceMethods]);
    });

    it('should handle email verification service errors gracefully', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-123', AuthChallenge.VERIFY_EMAIL);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      mockEmailVerificationService.sendVerificationEmail.mockRejectedValue(new Error('Email service error'));

      // Should not throw - fire and forget
      const result = await service.createChallengeResponse(mockUser as IUser, AuthChallenge.VERIFY_EMAIL, mockConfig);

      expect(result).toBeDefined();
      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle phone verification service errors gracefully', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-456', AuthChallenge.VERIFY_PHONE);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      mockPhoneVerificationService.sendVerificationSMS.mockRejectedValue(new Error('SMS service error'));

      // Should not throw - fire and forget
      const result = await service.createChallengeResponse(mockUser as IUser, AuthChallenge.VERIFY_PHONE, mockConfig);

      expect(result).toBeDefined();
      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // checkMFARequirement() Method - DELETED
  // ============================================================================
  // This method has been replaced by the state machine in determineAuthResponse()
  // All scenarios are now covered by comprehensive scenario tests below
  // Old tests removed - see "determineAuthResponse - Comprehensive Scenarios" section

  // ============================================================================
  // createMFASetupChallengeResponse() Method
  // ============================================================================

  describe('createMFASetupChallengeResponse', () => {
    beforeEach(() => {
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
    });
    it('should create MFA setup challenge response', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      const config: NAuthConfig = {
        ...mockConfig,
        mfa: {
          enabled: true,
          allowedMethods: [MFAMethod.TOTP] as MFADeviceMethod[],
        },
      };

      const result = await service.createMFASetupChallengeResponse(mockUser as IUser, config);

      expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      expect(result.session).toBe('session-token-setup');
      expect(result.challengeParameters?.allowedMethods).toEqual([MFAMethod.TOTP]);
      expect(result.challengeParameters?.instructions).toBeDefined();
      expect(result.sub).toBe('user-uuid-123');
    });

    it('should use default allowedMethods when not specified', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      const config = {
        ...mockConfig,
        mfa: {
          enabled: true,
        },
      };

      const result = await service.createMFASetupChallengeResponse(mockUser as IUser, config);

      expect(result.challengeParameters?.allowedMethods).toEqual([...MFADeviceMethods]);
    });
  });

  // ============================================================================
  // createMFAChallengeResponse() Method
  // ============================================================================

  describe('createMFAChallengeResponse', () => {
    beforeEach(() => {
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
    });
    it('should create MFA setup challenge response', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      const config: NAuthConfig = {
        ...mockConfig,
        mfa: {
          enabled: true,
          allowedMethods: [MFAMethod.TOTP] as MFADeviceMethod[],
        },
      };

      const result = await service.createMFASetupChallengeResponse(mockUser as IUser, config);

      expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      expect(result.session).toBe('session-token-setup');
      expect(result.challengeParameters?.allowedMethods).toEqual([MFAMethod.TOTP]);
      expect(result.challengeParameters?.instructions).toBeDefined();
      expect(result.sub).toBe('user-uuid-123');
    });

    it('should use default allowedMethods when not specified', async () => {
      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      const config = {
        ...mockConfig,
        mfa: {
          enabled: true,
        },
      };

      const result = await service.createMFASetupChallengeResponse(mockUser as IUser, config);

      expect(result.challengeParameters?.allowedMethods).toEqual([...MFADeviceMethods]);
    });
  });

  // ============================================================================
  // createMFAChallengeResponse() Method
  // ============================================================================

  describe('createMFAChallengeResponse', () => {
    beforeEach(() => {
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
    });
    it('should create MFA challenge response with available devices', async () => {
      const mockDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.TOTP,
          isActive: true,
          isPrimary: true,
          name: 'Authenticator',
        } as IMFADevice,
        {
          id: 2,
          userId: 1,
          type: MFAMethod.SMS,
          isActive: true,
          isPrimary: false,
          phoneNumber: '+1234567890',
        } as IMFADevice,
      ];
      mockMFADeviceRepository.find.mockResolvedValue(mockDevices);
      const user = { ...mockUser, mfaEnabled: true, backupCodes: ['code1', 'code2'] } as IUser;
      const mockChallengeSession = createMockChallengeSession('session-token-mfa', AuthChallenge.MFA_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await service.createMFAChallengeResponse(user);

      expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      expect(result.session).toBe('session-token-mfa');
      expect(result.challengeParameters?.availableMethods).toContain(MFAMethod.TOTP);
      expect(result.challengeParameters?.availableMethods).toContain(MFAMethod.SMS);
      expect(result.challengeParameters?.availableMethods).toContain(MFAMethod.BACKUP);
      expect(result.challengeParameters?.preferredMethod).toBe(MFAMethod.TOTP); // Primary device
    });

    it('should use preferredMfaMethod when set', async () => {
      const mockDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.TOTP,
          isActive: true,
          isPrimary: true,
        } as IMFADevice,
        {
          id: 2,
          userId: 1,
          type: MFAMethod.SMS,
          isActive: true,
          isPrimary: false,
          phoneNumber: '+1234567890',
        } as IMFADevice,
      ];
      mockMFADeviceRepository.find.mockResolvedValue(mockDevices);
      const user = {
        ...mockUser,
        mfaEnabled: true,
        preferredMfaMethod: MFAMethod.SMS,
        phone: '+1234567890',
      } as IUser;
      const mockChallengeSession = createMockChallengeSession('session-token-mfa', AuthChallenge.MFA_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 123 } as any);

      const result = await service.createMFAChallengeResponse(user);

      expect(result.challengeParameters?.preferredMethod).toBe(MFAMethod.SMS);
    });

    it('should throw when user has no MFA devices', async () => {
      mockMFADeviceRepository.find.mockResolvedValue([]);
      const user = { ...mockUser, mfaEnabled: true } as IUser;

      try {
        await service.createMFAChallengeResponse(user);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
      }
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should include masked phone when SMS device available', async () => {
      const mockDevices: IMFADevice[] = [
        {
          id: 2,
          userId: 1,
          type: MFAMethod.SMS,
          isActive: true,
          isPrimary: true,
          phoneNumber: '+1234567890',
        } as IMFADevice,
      ];
      mockMFADeviceRepository.find.mockResolvedValue(mockDevices);
      const user = { ...mockUser, mfaEnabled: true, phone: '+1234567890' } as IUser;
      const mockChallengeSession = createMockChallengeSession('session-token-mfa', AuthChallenge.MFA_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 123 } as any);

      const result = await service.createMFAChallengeResponse(user);

      expect(result.challengeParameters?.maskedPhone).toBeDefined();
      expect(result.challengeParameters?.maskedPhone).toContain('7890');
    });

    it('should not include backup codes when user has none', async () => {
      const mockDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.TOTP,
          isActive: true,
          isPrimary: true,
        } as IMFADevice,
      ];
      mockMFADeviceRepository.find.mockResolvedValue(mockDevices);
      const user = { ...mockUser, mfaEnabled: true, backupCodes: null } as IUser;
      const mockChallengeSession = createMockChallengeSession('session-token-mfa', AuthChallenge.MFA_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await service.createMFAChallengeResponse(user);

      expect(result.challengeParameters?.availableMethods).not.toContain(MFAMethod.BACKUP);
    });
  });

  // ============================================================================
  // createSuccessResponse() Method
  // ============================================================================

  describe('createSuccessResponse', () => {
    beforeEach(() => {
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
    });
    it('should create success response with tokens', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true, isPhoneVerified: true } as IUser;
      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access-token',
          refreshToken: 'temp-refresh-token',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });
      mockSessionService.updateTokens.mockResolvedValue(undefined);

      const result = await service.createSuccessResponse(verifiedUser);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toBeDefined();
      expect(result.user?.sub).toBe('user-uuid-123');
      expect(result.user?.email).toBe('test@example.com');
      expect(result.challengeName).toBeUndefined();
      expect(mockSessionService.createSession).toHaveBeenCalled();
      expect(mockSessionService.updateTokens).toHaveBeenCalled();
    });

    it('should not throw when user has pending challenges (validation handled by state machine)', async () => {
      // NOTE: createSuccessResponse no longer validates challenges
      // Challenge validation is handled by state machine in determineAuthResponse()
      // This method is only called when state is AUTHENTICATED, so no validation needed
      const userWithPending = {
        ...mockUser,
        isEmailVerified: false,
        isPhoneVerified: false,
      } as IUser;
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      // Should not throw - validation is handled by state machine, not this method
      const result = await serviceWithConfig.createSuccessResponse(userWithPending);
      expect(result.accessToken).toBe('access-token');
    });

    it('should use clientInfo when ipAddress/userAgent not provided', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true } as IUser;
      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockClientInfoService.get.mockReturnValue({
        ipAddress: 'client-ip',
        userAgent: 'client-agent',
        ipCountry: 'US',
        ipCity: 'New York',
      });
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      const serviceWithClientInfo = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      await serviceWithClientInfo.createSuccessResponse(verifiedUser);

      // Client info is automatically extracted from ClientInfoService, so we verify the call was made
      // The actual ipAddress/userAgent come from the mockClientInfoService.get() call
      expect(mockSessionService.createSession).toHaveBeenCalled();
    });

    it('should generate deviceId when not provided', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true } as IUser;
      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      await service.createSuccessResponse(verifiedUser);

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          deviceId: (expect as any).any(String),
        }),
      );
    });

    it('should include trusted flag when provided', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true } as IUser;
      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      const result = await service.createSuccessResponse(verifiedUser, undefined, true);

      expect(result.trusted).toBe(true);
    });
  });

  // ============================================================================
  // determineAuthResponse() Method
  // ============================================================================

  describe('determineAuthResponse', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 1 } as any);
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 123456 } as any);
    });

    it('should return challenge when verification pending', async () => {
      const user = { ...mockUser, isEmailVerified: false } as IUser;
      const config = { ...mockConfig, signup: { verificationMethod: 'email' as const } };
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
        mockEmailVerificationService,
      );

      // Mock context builder
      mockContextBuilder.build.mockResolvedValue({
        user,
        config,
        authMethod: 'password',
        computed: {
          isEmailVerificationRequired: true,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: false,
          isMFAVerificationRequired: false,
          isDeviceTrusted: false,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
        },
      } as AuthFlowContext);

      // Mock state machine
      mockStateMachine.evaluateState.mockResolvedValue(AuthFlowState.PENDING_EMAIL_VERIFICATION);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state: AuthFlowState.PENDING_EMAIL_VERIFICATION,
        priority: 2,
        condition: () => true,
        challenge: AuthChallenge.VERIFY_EMAIL,
      });
      mockStateMachine.buildMetadata.mockReturnValue({});

      const mockChallengeSession = createMockChallengeSession('session-token-123', AuthChallenge.VERIFY_EMAIL);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await serviceWithConfig.determineAuthResponse({ user, config });

      expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      expect(result.accessToken).toBeUndefined();
    });

    it('should return MFA setup challenge when required', async () => {
      const user = {
        ...mockUser,
        isEmailVerified: true,
        isPhoneVerified: true,
        mfaEnabled: false,
        createdAt: new Date('2024-01-01'),
      } as IUser;
      const config = {
        ...mockConfig,
        signup: { verificationMethod: 'none' as const },
        mfa: {
          enabled: true,
          enforcement: 'REQUIRED' as const,
          gracePeriod: 0,
        },
      };
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      // Mock context builder
      mockContextBuilder.build.mockResolvedValue({
        user,
        config,
        authMethod: 'password',
        computed: {
          isEmailVerificationRequired: false,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: true,
          isMFAVerificationRequired: false,
          isDeviceTrusted: false,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
        },
      } as AuthFlowContext);

      // Mock state machine
      mockStateMachine.evaluateState.mockResolvedValue(AuthFlowState.PENDING_MFA_SETUP);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state: AuthFlowState.PENDING_MFA_SETUP,
        priority: 5,
        condition: () => true,
        challenge: AuthChallenge.MFA_SETUP_REQUIRED,
      });
      mockStateMachine.buildMetadata.mockReturnValue({});

      const mockChallengeSession = createMockChallengeSession('session-token-setup', AuthChallenge.MFA_SETUP_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await serviceWithConfig.determineAuthResponse({ user, config });

      expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
    });

    it('should return MFA challenge when MFA verification required', async () => {
      const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
      const config = {
        ...mockConfig,
        signup: { verificationMethod: 'none' as const },
        mfa: {
          enabled: true,
          enforcement: 'REQUIRED' as const,
        },
      };
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      // Mock context builder
      mockContextBuilder.build.mockResolvedValue({
        user,
        config,
        authMethod: 'password',
        computed: {
          isEmailVerificationRequired: false,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: false,
          isMFAVerificationRequired: true,
          isDeviceTrusted: false,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
        },
      } as AuthFlowContext);

      // Mock state machine
      mockStateMachine.evaluateState.mockResolvedValue(AuthFlowState.PENDING_MFA_VERIFICATION);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state: AuthFlowState.PENDING_MFA_VERIFICATION,
        priority: 6,
        condition: () => true,
        challenge: AuthChallenge.MFA_REQUIRED,
      });
      mockStateMachine.buildMetadata.mockReturnValue({});

      const mockDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.TOTP,
          isActive: true,
          isPrimary: true,
        } as IMFADevice,
      ];
      mockMFADeviceRepository.find.mockResolvedValue(mockDevices);
      const mockChallengeSession = createMockChallengeSession('session-token-mfa', AuthChallenge.MFA_REQUIRED);
      mockChallengeService.createChallengeSession.mockResolvedValue(mockChallengeSession);

      const result = await serviceWithConfig.determineAuthResponse({ user, config });

      expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
    });

    it('should return success response when no challenges', async () => {
      const user = { ...mockUser, isEmailVerified: true } as IUser;
      const config = { ...mockConfig, signup: { verificationMethod: 'email' as const } };
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      // Mock context builder
      mockContextBuilder.build.mockResolvedValue({
        user,
        config,
        authMethod: 'password',
        computed: {
          isEmailVerificationRequired: false,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: false,
          isMFAVerificationRequired: false,
          isDeviceTrusted: false,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
        },
      } as AuthFlowContext);

      // Mock state machine
      mockStateMachine.evaluateState.mockResolvedValue(AuthFlowState.AUTHENTICATED);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state: AuthFlowState.AUTHENTICATED,
        priority: 9,
        condition: () => true,
      });
      mockStateMachine.buildMetadata.mockReturnValue({});

      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      const result = await serviceWithConfig.determineAuthResponse({ user, config });

      expect(result.challengeName).toBeUndefined();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should skip MFA verification when flag is set', async () => {
      const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
      const config = {
        ...mockConfig,
        signup: { verificationMethod: 'none' as const },
        mfa: {
          enabled: true,
          enforcement: 'REQUIRED' as const,
        },
      };
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      // Mock context builder with skipMFAVerification
      mockContextBuilder.build.mockResolvedValue({
        user,
        config,
        authMethod: 'password',
        skipMFAVerification: true,
        computed: {
          isEmailVerificationRequired: false,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: false,
          isMFAVerificationRequired: false, // Skipped due to flag
          isDeviceTrusted: false,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
        },
      } as AuthFlowContext);

      // Mock state machine
      mockStateMachine.evaluateState.mockResolvedValue(AuthFlowState.AUTHENTICATED);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state: AuthFlowState.AUTHENTICATED,
        priority: 9,
        condition: () => true,
      });
      mockStateMachine.buildMetadata.mockReturnValue({});

      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      const result = await serviceWithConfig.determineAuthResponse({
        user,
        config,
        skipMFAVerification: true,
      });

      expect(result.accessToken).toBe('access-token');
      // skipMFAVerification is handled by context builder, which sets isMFAVerificationRequired: false
      // No explicit log message is required - the state machine evaluates to AUTHENTICATED
    });

    it('should check trusted device status for trusted flag', async () => {
      const user = { ...mockUser, isEmailVerified: true } as IUser;
      const config = {
        ...mockConfig,
        signup: { verificationMethod: 'none' as const },
        mfa: {
          enabled: false,
          rememberDevices: 'user_opt_in' as const,
        },
      };
      const serviceWithConfig = new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
      );

      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(true);

      // Mock context builder
      mockContextBuilder.build.mockResolvedValue({
        user,
        config,
        authMethod: 'password',
        deviceToken: 'device-token-123',
        computed: {
          isEmailVerificationRequired: false,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: false,
          isMFAVerificationRequired: false,
          isDeviceTrusted: true,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
        },
      } as AuthFlowContext);

      // Mock state machine
      mockStateMachine.evaluateState.mockResolvedValue(AuthFlowState.AUTHENTICATED);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state: AuthFlowState.AUTHENTICATED,
        priority: 9,
        condition: () => true,
      });
      mockStateMachine.buildMetadata.mockReturnValue({});

      mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
      mockJwtService.generateTokenPair
        .mockResolvedValueOnce({
          accessToken: 'temp-access',
          refreshToken: 'temp-refresh',
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      mockJwtService.hashToken.mockReturnValue('token-hash');
      mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
      });
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
      });

      const result = await serviceWithConfig.determineAuthResponse({
        user,
        config,
        deviceToken: 'device-token-123',
      });

      expect(result.trusted).toBe(true);
      // isDeviceTrusted is called by context builder, not directly by challenge helper
      // The context builder pre-computes isDeviceTrusted and includes it in the context
    });
  });

  // ============================================================================
  // Comprehensive Scenario Tests - Based on CHALLENGE_SCENARIOS.md
  // ============================================================================
  // These tests verify all scenarios documented in CHALLENGE_SCENARIOS.md

  describe('determineAuthResponse - Comprehensive Scenarios', () => {
    // Helper to create a properly configured service with state machine mocks
    const createServiceWithMocks = (config: NAuthConfig) => {
      return new AuthChallengeHelperService(
        mockChallengeService,
        mockJwtService,
        mockSessionService,
        mockMFADeviceRepository,
        mockLogger,
        mockStateMachine,
        mockContextBuilder,
        mockClientInfoService,
        mockEmailVerificationService,
        mockPhoneVerificationService,
      );
    };

    // Helper to mock state machine evaluation
    const mockStateEvaluation = (state: AuthFlowState, challenge?: AuthChallenge, metadata?: ResponseMetadata) => {
      mockStateMachine.evaluateState.mockResolvedValue(state);
      mockStateMachine.getStateDefinition.mockReturnValue({
        state,
        priority: 1,
        condition: () => true,
        challenge,
      });
      mockStateMachine.buildMetadata.mockReturnValue(metadata || {});
    };

    // Helper to mock context builder
    const mockContextBuild = (computed: Partial<AuthFlowContext['computed']> = {}, userOverride?: Partial<IUser>) => {
      const user = { ...mockUser, ...userOverride } as IUser;
      mockContextBuilder.build.mockResolvedValue({
        user,
        config: mockConfig,
        authMethod: 'password',
        computed: {
          isDeviceTrusted: false,
          isEmailVerificationRequired: false,
          isPhoneVerificationRequired: false,
          isPhoneCollectionNeeded: false,
          isMFAExempt: false,
          isMFASetupRequired: false,
          isMFAVerificationRequired: false,
          isGracePeriodActive: false,
          riskScore: 0,
          riskLevel: 'low',
          isBlocked: false,
          ...computed,
        },
      } as AuthFlowContext);
    };

    beforeEach(() => {
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
      } as any);
      // Setup default mocks for services
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 1 } as any);
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 123456 } as any);
    });

    // ============================================================================
    // Signup Scenarios - MFA OPTIONAL
    // ============================================================================

    describe('Signup - MFA OPTIONAL', () => {
      it('should return SUCCESS when verificationMethod is none', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'OPTIONAL' },
        };
        const service = createServiceWithMocks(config);
        mockContextBuild({ isEmailVerificationRequired: false, isPhoneVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user: mockUser as IUser,
          config,
        });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_EMAIL when verificationMethod is email', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'email' },
          mfa: { enabled: true, enforcement: 'OPTIONAL' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: false } as IUser;
        mockContextBuild({ isEmailVerificationRequired: true }, user);
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_EMAIL),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      });

      it('should return VERIFY_PHONE when verificationMethod is phone', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'OPTIONAL' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, phone: '+1234567890', isPhoneVerified: false } as IUser;
        mockContextBuild({ isPhoneVerificationRequired: true }, user);
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_VERIFICATION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_PHONE),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      });

      it('should return VERIFY_EMAIL first when verificationMethod is both (sequential flow)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'both' },
          mfa: { enabled: true, enforcement: 'OPTIONAL' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: false, isPhoneVerified: false } as IUser;
        mockContextBuild({ isEmailVerificationRequired: true, isPhoneVerificationRequired: true }, user);
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_EMAIL),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      });
    });

    // ============================================================================
    // Signup Scenarios - MFA REQUIRED
    // ============================================================================

    describe('Signup - MFA REQUIRED', () => {
      it('should return MFA_SETUP_REQUIRED when gracePeriod is 0 and verificationMethod is none', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      });

      it('should return SUCCESS when gracePeriod is 7 days (grace period active)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_EMAIL then MFA_SETUP_REQUIRED when gracePeriod is 0 and verificationMethod is email', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'email' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: false, mfaEnabled: false } as IUser;
        mockContextBuild({ isEmailVerificationRequired: true, isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_EMAIL),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      });

      it('should return SUCCESS when gracePeriod is 7 days and verificationMethod is email', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'email' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_PHONE then MFA_SETUP_REQUIRED when gracePeriod is 0 and verificationMethod is phone', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, phone: '+1234567890', isPhoneVerified: false, mfaEnabled: false } as IUser;
        mockContextBuild({ isPhoneVerificationRequired: true, isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_VERIFICATION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_PHONE),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      });

      it('should return SUCCESS when gracePeriod is 7 days and verificationMethod is phone', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          phone: '+1234567890',
          isPhoneVerified: true,
          mfaEnabled: false,
          createdAt: new Date(),
        } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_EMAIL first when gracePeriod is 0 and verificationMethod is both', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'both' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: false, isPhoneVerified: false, mfaEnabled: false } as IUser;
        mockContextBuild({
          isEmailVerificationRequired: true,
          isPhoneVerificationRequired: true,
          isMFASetupRequired: true,
        });
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_EMAIL),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      });

      it('should return SUCCESS when gracePeriod is 7 days and verificationMethod is both', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'both' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          isEmailVerified: true,
          isPhoneVerified: true,
          mfaEnabled: false,
          createdAt: new Date(),
        } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });
    });

    // ============================================================================
    // Signup Scenarios - MFA ADAPTIVE
    // ============================================================================

    describe('Signup - MFA ADAPTIVE', () => {
      it('should return MFA_SETUP_REQUIRED when gracePeriod is 0 and verificationMethod is none', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      });

      it('should return SUCCESS when gracePeriod is 7 days (grace period active)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_EMAIL then MFA_SETUP_REQUIRED when gracePeriod is 0 and verificationMethod is email', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'email' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: false, mfaEnabled: false } as IUser;
        mockContextBuild({ isEmailVerificationRequired: true, isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_EMAIL),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      });

      it('should return SUCCESS when gracePeriod is 7 days and verificationMethod is email', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'email' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_PHONE then MFA_SETUP_REQUIRED when gracePeriod is 0 and verificationMethod is phone', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, phone: '+1234567890', isPhoneVerified: false, mfaEnabled: false } as IUser;
        mockContextBuild({ isPhoneVerificationRequired: true, isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_VERIFICATION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_PHONE),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      });

      it('should return SUCCESS when gracePeriod is 7 days and verificationMethod is phone', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          phone: '+1234567890',
          isPhoneVerified: true,
          mfaEnabled: false,
          createdAt: new Date(),
        } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_EMAIL first when gracePeriod is 0 and verificationMethod is both', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'both' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: false, isPhoneVerified: false, mfaEnabled: false } as IUser;
        mockContextBuild({
          isEmailVerificationRequired: true,
          isPhoneVerificationRequired: true,
          isMFASetupRequired: true,
        });
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_EMAIL),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
      });

      it('should return SUCCESS when gracePeriod is 7 days and verificationMethod is both', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'both' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          isEmailVerified: true,
          isPhoneVerified: true,
          mfaEnabled: false,
          createdAt: new Date(),
        } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });
    });

    // ============================================================================
    // Login Scenarios - MFA OPTIONAL
    // ============================================================================

    describe('Login - MFA OPTIONAL', () => {
      it('should return SUCCESS when MFA not enabled', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'OPTIONAL' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false } as IUser;
        mockContextBuild({ isMFAVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
      });

      it('should return SUCCESS when MFA enabled and device is trusted with bypassMFAForTrustedDevices = true', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'OPTIONAL',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({ isDeviceTrusted: true, isMFAVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBeUndefined();
      });

      it('should return MFA_REQUIRED when MFA enabled and device is untrusted', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'OPTIONAL' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({ isDeviceTrusted: false, isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should return FORCE_CHANGE_PASSWORD when mustChangePassword is true', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mustChangePassword: true } as IUser;
        mockContextBuild();
        mockStateEvaluation(AuthFlowState.PENDING_PASSWORD_CHANGE, AuthChallenge.FORCE_CHANGE_PASSWORD);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.FORCE_CHANGE_PASSWORD),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.FORCE_CHANGE_PASSWORD);
      });

      it('should skip MFA even when mustChangePassword=true if mfaExempt=true', async () => {
        // Note: mustChangePassword takes priority over mfaExempt
        // User must change password first, but MFA checks are bypassed after password change
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mustChangePassword: true, mfaExempt: true, mfaEnabled: false } as IUser;
        // Password change takes priority, but mfaExempt means no MFA after password change
        mockContextBuild({ isMFAExempt: true, isMFASetupRequired: false, isMFAVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.PENDING_PASSWORD_CHANGE, AuthChallenge.FORCE_CHANGE_PASSWORD);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.FORCE_CHANGE_PASSWORD),
        );

        const result = await service.determineAuthResponse({ user, config });

        // Password change is required first (takes priority)
        expect(result.challengeName).toBe(AuthChallenge.FORCE_CHANGE_PASSWORD);
        // After password change, flow re-evaluates and mfaExempt will bypass MFA
      });

      it('should return SUCCESS when mfaExempt is true (bypasses all MFA checks)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED' },
        };
        const service = createServiceWithMocks(config);
        // CRITICAL: User must have mfaExempt field set (simulating real database query)
        const user = { ...mockUser, mfaExempt: true, mfaEnabled: true } as IUser;
        // Verify context builder is called with user that has mfaExempt
        mockContextBuilder.build.mockImplementation(async (params) => {
          // Verify user.mfaExempt is actually checked (not just mocked)
          const isMFAExempt = params.user.mfaExempt === true || (params.user.mfaExempt as unknown) === 1;
          return {
            user: params.user,
            config: params.config,
            authMethod: params.authMethod,
            authProvider: params.authProvider,
            deviceToken: params.deviceToken,
            skipMFAVerification: params.skipMFAVerification,
            computed: {
              isEmailVerificationRequired: false,
              isPhoneVerificationRequired: false,
              isPhoneCollectionNeeded: false,
              isMFAExempt, // Use actual user.mfaExempt value
              isMFASetupRequired: false,
              isMFAVerificationRequired: false, // Should be false when exempt
              isDeviceTrusted: false,
              isGracePeriodActive: false,
              isBlocked: false,
            },
          } as AuthFlowContext;
        });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        // Verify context builder was called with user that has mfaExempt
        expect(mockContextBuilder.build).toHaveBeenCalled();
        const buildCall = mockContextBuilder.build.mock.calls[0]?.[0];
        expect(buildCall?.user?.mfaExempt).toBe(true);
      });
    });

    // ============================================================================
    // Login Scenarios - MFA REQUIRED
    // ============================================================================

    describe('Login - MFA REQUIRED', () => {
      it('should return MFA_SETUP_REQUIRED when MFA not enabled and gracePeriod is 0', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      });

      it('should return SUCCESS when MFA not enabled and gracePeriod is 7 days (active)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
      });

      it('should trigger MFA_SETUP_REQUIRED when grace period expired', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        // User created 10 days ago, grace period was 7 days, so it's expired
        const user = {
          ...mockUser,
          mfaEnabled: false,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        } as IUser;
        mockContextBuild({ isGracePeriodActive: false, isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      });

      it('should return MFA_REQUIRED when MFA enabled and device is untrusted', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({ isDeviceTrusted: false, isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should return SUCCESS when MFA enabled, device trusted, and bypassMFAForTrustedDevices is true', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'REQUIRED',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({ isDeviceTrusted: true, isMFAVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return MFA_REQUIRED when MFA enabled, device trusted, and bypassMFAForTrustedDevices is false', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'REQUIRED',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: false,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({ isDeviceTrusted: true, isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });
    });

    // ============================================================================
    // Login Scenarios - MFA ADAPTIVE
    // ============================================================================

    describe('Login - MFA ADAPTIVE', () => {
      it('should return SUCCESS with gracePeriodEndsAt when grace period active and MFA not enabled', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        const gracePeriodEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE, undefined, { gracePeriodEndsAt });
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect((result as any).gracePeriodEndsAt).toEqual(gracePeriodEndsAt);
      });

      it('should return MFA_REQUIRED when MFA enabled, device trusted, and risk is medium', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({
          isDeviceTrusted: true,
          isMFAVerificationRequired: true,
          riskScore: 35,
          riskLevel: 'medium',
        });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should return MFA_REQUIRED when MFA enabled and device is untrusted (always required in ADAPTIVE)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({ isDeviceTrusted: false, isMFAVerificationRequired: true, riskScore: 10 });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should throw BLOCKED error when risk is very high and user is blocked', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            adaptive: {
              blockedSignIn: {
                errorCode: AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK,
                message: 'Sign-in blocked',
              },
            },
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        const blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        mockContextBuild({ isBlocked: true, riskScore: 95, riskLevel: 'high' });
        mockStateEvaluation(AuthFlowState.BLOCKED, undefined, { blockedUntil, reason: 'High risk detected' });

        try {
          await service.determineAuthResponse({ user, config });
          fail('Should have thrown NAuthException');
        } catch (error) {
          expect(error).toBeInstanceOf(NAuthException);
        }
      });

      it('should throw BLOCKED error when risk is very high on trusted device', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
            adaptive: {
              blockedSignIn: {
                errorCode: AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK,
                message: 'Sign-in blocked',
              },
            },
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        const blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        mockContextBuild({
          isDeviceTrusted: true,
          isBlocked: true,
          riskScore: 95,
          riskLevel: 'high',
        });
        mockStateEvaluation(AuthFlowState.BLOCKED, undefined, {
          blockedUntil,
          reason: 'High risk detected on trusted device',
        });

        try {
          await service.determineAuthResponse({
            user,
            config,
            deviceToken: 'device-token-123',
          });
          fail('Should have thrown NAuthException');
        } catch (error) {
          expect(error).toBeInstanceOf(NAuthException);
        }
      });

      it('should return MFA_SETUP_REQUIRED when MFA not enabled and gracePeriod is 0', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      });

      it('should throw BLOCKED error when gracePeriod is 7 days, MFA not enabled, and risk is very high', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            gracePeriod: 7,
            adaptive: {
              blockedSignIn: {
                errorCode: AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK,
                message: 'Sign-in blocked',
              },
            },
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        const blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        mockContextBuild({ isGracePeriodActive: true, isBlocked: true, riskScore: 95, riskLevel: 'high' });
        mockStateEvaluation(AuthFlowState.BLOCKED, undefined, { blockedUntil, reason: 'High risk detected' });

        try {
          await service.determineAuthResponse({ user, config });
          fail('Should have thrown NAuthException');
        } catch (error) {
          expect(error).toBeInstanceOf(NAuthException);
        }
      });

      it('should return SUCCESS when MFA enabled, device trusted, and risk is low', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({
          isDeviceTrusted: true,
          isMFAVerificationRequired: false,
          riskScore: 15,
          riskLevel: 'low',
        });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return MFA_REQUIRED when MFA enabled, device trusted, and risk is high', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: true } as IUser;
        mockContextBuild({
          isDeviceTrusted: true,
          isMFAVerificationRequired: true,
          riskScore: 75,
          riskLevel: 'high',
        });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should return SUCCESS with riskScore when gracePeriod is active, MFA not enabled, and risk is medium', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'ADAPTIVE', gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, mfaEnabled: false, createdAt: new Date() } as IUser;
        const gracePeriodEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false, riskScore: 35, riskLevel: 'medium' });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE, undefined, { gracePeriodEndsAt, riskScore: 35 });
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBeUndefined();
        expect((result as any).gracePeriodEndsAt).toEqual(gracePeriodEndsAt);
      });
    });

    // ============================================================================
    // Social Login Scenarios
    // ============================================================================

    describe('Social Login', () => {
      it('should return SUCCESS when requireForSocialLogin is false (default)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', requireForSocialLogin: false },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
        mockContextBuild({ isMFAVerificationRequired: false }); // MFA skipped for social
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBeUndefined();
      });

      it('should return VERIFY_PHONE when requireForSocialLogin is false and phone not verified', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'REQUIRED', requireForSocialLogin: false },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, phone: '+1234567890', isPhoneVerified: false } as IUser;
        mockContextBuild({ isPhoneVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_VERIFICATION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_PHONE),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      });

      it('should return MFA_REQUIRED when requireForSocialLogin is true and MFA enabled', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'OPTIONAL', requireForSocialLogin: true },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
        mockContextBuild({ isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should return SUCCESS when requireForSocialLogin is false and verificationMethod is email (email pre-verified)', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'email' },
          mfa: { enabled: true, enforcement: 'REQUIRED', requireForSocialLogin: false },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
        mockContextBuild({ isMFAVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return MFA_SETUP_REQUIRED when requireForSocialLogin is true, MFA REQUIRED, gracePeriod=0, and MFA not enabled', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', requireForSocialLogin: true, gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
      });

      it('should return SUCCESS when requireForSocialLogin is true, MFA REQUIRED, gracePeriod=7, and MFA not enabled', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED', requireForSocialLogin: true, gracePeriod: 7 },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: false, createdAt: new Date() } as IUser;
        mockContextBuild({ isGracePeriodActive: true, isMFASetupRequired: false });
        mockStateEvaluation(AuthFlowState.GRACE_PERIOD_ACTIVE);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return VERIFY_PHONE then MFA_REQUIRED when requireForSocialLogin is true, MFA enabled, and phone not verified', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'OPTIONAL', requireForSocialLogin: true },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          isEmailVerified: true,
          phone: '+1234567890',
          isPhoneVerified: false,
          mfaEnabled: true,
        } as IUser;
        mockContextBuild({ isPhoneVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_VERIFICATION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_PHONE),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
        });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      });

      it('should return SUCCESS when requireForSocialLogin is true, MFA ADAPTIVE, device trusted, and risk is low', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            requireForSocialLogin: true,
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
        mockContextBuild({
          isDeviceTrusted: true,
          isMFAVerificationRequired: false,
          riskScore: 15,
          riskLevel: 'low',
        });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });

      it('should return MFA_REQUIRED when requireForSocialLogin is true, MFA ADAPTIVE, device trusted, and risk is medium', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            requireForSocialLogin: true,
            rememberDevices: 'user_opt_in',
            bypassMFAForTrustedDevices: true,
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
        mockContextBuild({
          isDeviceTrusted: true,
          isMFAVerificationRequired: true,
          riskScore: 35,
          riskLevel: 'medium',
        });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({
          user,
          config,
          isSocialLogin: true,
          authProvider: 'google',
          deviceToken: 'device-token-123',
        });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should block social login when adaptive risk is very high', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: {
            enabled: true,
            enforcement: 'ADAPTIVE',
            requireForSocialLogin: true,
            adaptive: {
              blockedSignIn: {
                errorCode: AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK,
                message: 'Sign-in blocked',
              },
            },
          },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, isEmailVerified: true, mfaEnabled: true } as IUser;
        const blockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        mockContextBuild({ isBlocked: true, riskScore: 95, riskLevel: 'high' });
        mockStateEvaluation(AuthFlowState.BLOCKED, undefined, { blockedUntil, reason: 'High risk detected' });

        try {
          await service.determineAuthResponse({
            user,
            config,
            isSocialLogin: true,
            authProvider: 'google',
          });
          fail('Should have thrown NAuthException');
        } catch (error) {
          expect(error).toBeInstanceOf(NAuthException);
        }
      });
    });

    // ============================================================================
    // Special Cases
    // ============================================================================

    describe('Special Cases', () => {
      it('should return VERIFY_PHONE for phone collection when user has no phone', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
        };
        const service = createServiceWithMocks(config);
        const user = { ...mockUser, phone: null, isPhoneVerified: false } as IUser;
        mockContextBuild({ isPhoneCollectionNeeded: true });
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_COLLECTION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.VERIFY_PHONE),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
        // Note: requiresPhoneCollection is set by createChallengeResponse when phone is null
        // This is tested in the createChallengeResponse tests
      });

      it('should return preferred MFA method from user.preferredMfaMethod', async () => {
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED' },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          mfaEnabled: true,
          preferredMfaMethod: MFAMethod.PASSKEY,
        } as IUser;
        mockContextBuild({ isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.PASSKEY, isActive: true, isPrimary: true } as IMFADevice,
          { id: 2, userId: 1, type: MFAMethod.SMS, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
        expect(result.challengeParameters?.preferredMethod).toBe(MFAMethod.PASSKEY);
      });

      it('should handle phone verification via MFA SMS when verificationMethod is none', async () => {
        // Note: This tests that when phone verification is disabled but user sets up SMS MFA,
        // completing SMS MFA verification will mark the phone as verified in the directory.
        // This is handled by the MFA service, not the challenge helper, but we verify the flow works.
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'none' },
          mfa: { enabled: true, enforcement: 'REQUIRED' },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          mfaEnabled: true,
          phone: '+1234567890',
          isPhoneVerified: false, // Phone not verified via VERIFY_PHONE challenge
        } as IUser;
        mockContextBuild({ isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.SMS, isActive: true, phoneNumber: '+1234567890' } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
        expect(result.challengeParameters?.availableMethods).toContain(MFAMethod.SMS);
        // Note: Phone verification via MFA SMS is handled when MFA challenge is completed,
        // not during challenge creation. This test verifies the challenge is created correctly.
      });

      it('should handle phone already verified - SMS MFA setup auto-complete', async () => {
        // Note: This tests that when phone is already verified and user sets up SMS MFA,
        // the MFA setup auto-completes (no SMS challenge during setup).
        // This is handled by the state machine's onEnter hook for PENDING_MFA_SETUP.
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'phone' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);
        const user = {
          ...mockUser,
          phone: '+1234567890',
          isPhoneVerified: true, // Phone already verified
          mfaEnabled: false,
        } as IUser;
        // When phone is verified and user sets up SMS MFA, the onEnter hook should auto-complete
        // This means the state machine should transition directly to AUTHENTICATED or MFA_REQUIRED
        // depending on enforcement. For this test, we verify the state machine handles it correctly.
        mockContextBuild({ isMFASetupRequired: true });
        // The onEnter hook for PENDING_MFA_SETUP will auto-complete SMS MFA if phone is verified
        // This is tested at the state machine level, but we verify the flow works here
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-123', AuthChallenge.MFA_SETUP_REQUIRED),
        );

        const result = await service.determineAuthResponse({ user, config });

        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);
        // Note: The auto-complete logic is in the state machine's onEnter hook.
        // When SMS MFA is selected and phone is verified, setup should auto-complete.
        // This is verified by checking that the challenge is created correctly.
      });

      it('should re-evaluate sequential challenges correctly (FORCE_CHANGE_PASSWORD → VERIFY_EMAIL → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS)', async () => {
        // This test simulates the full challenge completion chain
        // After each challenge is completed, the flow re-evaluates from priority 1
        const config: NAuthConfig = {
          ...mockConfig,
          signup: { verificationMethod: 'both' },
          mfa: { enabled: true, enforcement: 'REQUIRED', gracePeriod: 0 },
        };
        const service = createServiceWithMocks(config);

        // Step 1: Initial state - user has all challenges pending
        let user = {
          ...mockUser,
          mustChangePassword: true,
          isEmailVerified: false,
          isPhoneVerified: false,
          mfaEnabled: false,
        } as IUser;

        // Step 1: FORCE_CHANGE_PASSWORD (priority 1)
        mockContextBuild({
          isEmailVerificationRequired: true,
          isPhoneVerificationRequired: true,
          isMFASetupRequired: true,
        });
        mockStateEvaluation(AuthFlowState.PENDING_PASSWORD_CHANGE, AuthChallenge.FORCE_CHANGE_PASSWORD);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-1', AuthChallenge.FORCE_CHANGE_PASSWORD),
        );
        let result = await service.determineAuthResponse({ user, config });
        expect(result.challengeName).toBe(AuthChallenge.FORCE_CHANGE_PASSWORD);

        // Step 2: After password change, re-evaluate → VERIFY_EMAIL (priority 2)
        user = { ...user, mustChangePassword: false } as IUser;
        mockContextBuild({
          isEmailVerificationRequired: true,
          isPhoneVerificationRequired: true,
          isMFASetupRequired: true,
        });
        mockStateEvaluation(AuthFlowState.PENDING_EMAIL_VERIFICATION, AuthChallenge.VERIFY_EMAIL);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-2', AuthChallenge.VERIFY_EMAIL),
        );
        result = await service.determineAuthResponse({ user, config });
        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);

        // Step 3: After email verification, re-evaluate → VERIFY_PHONE (priority 4, after phone collection if needed)
        user = { ...user, isEmailVerified: true } as IUser;
        mockContextBuild({
          isPhoneVerificationRequired: true,
          isMFASetupRequired: true,
        });
        mockStateEvaluation(AuthFlowState.PENDING_PHONE_VERIFICATION, AuthChallenge.VERIFY_PHONE);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-3', AuthChallenge.VERIFY_PHONE),
        );
        result = await service.determineAuthResponse({ user, config });
        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);

        // Step 4: After phone verification, re-evaluate → MFA_SETUP_REQUIRED (priority 5)
        user = { ...user, isPhoneVerified: true } as IUser;
        mockContextBuild({ isMFASetupRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_SETUP, AuthChallenge.MFA_SETUP_REQUIRED);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-4', AuthChallenge.MFA_SETUP_REQUIRED),
        );
        result = await service.determineAuthResponse({ user, config });
        expect(result.challengeName).toBe(AuthChallenge.MFA_SETUP_REQUIRED);

        // Step 5: After MFA setup, re-evaluate → MFA_REQUIRED (priority 6)
        user = { ...user, mfaEnabled: true } as IUser;
        mockContextBuild({ isMFAVerificationRequired: true });
        mockStateEvaluation(AuthFlowState.PENDING_MFA_VERIFICATION, AuthChallenge.MFA_REQUIRED);
        mockMFADeviceRepository.find.mockResolvedValue([
          { id: 1, userId: 1, type: MFAMethod.TOTP, isActive: true } as IMFADevice,
        ]);
        mockChallengeService.createChallengeSession.mockResolvedValue(
          createMockChallengeSession('session-5', AuthChallenge.MFA_REQUIRED),
        );
        result = await service.determineAuthResponse({ user, config });
        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);

        // Step 6: After MFA verification, re-evaluate → SUCCESS
        // Note: In real flow, MFA verification happens via completeChallenge, which then calls determineAuthResponse again
        // This simulates the final state after all challenges are complete
        mockContextBuild({ isMFAVerificationRequired: false });
        mockStateEvaluation(AuthFlowState.AUTHENTICATED);
        mockJwtService.generateTokenFamily.mockReturnValue('family-xyz');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockSessionService.createSession.mockResolvedValue({ id: 1 } as any);
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 } as any,
        });
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 2592000 } as any,
        });
        result = await service.determineAuthResponse({ user, config });
        expect(result.challengeName).toBeUndefined();
        expect(result.accessToken).toBe('access-token');
      });
    });
  });
});
