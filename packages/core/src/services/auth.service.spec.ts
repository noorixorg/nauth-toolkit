/**
 * AuthService Unit Tests - Comprehensive Coverage
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 *
 * This is the backbone test suite for the authentication system.
 * Covers all public methods, edge cases, security features, hooks, and error paths.
 *
 * Test Coverage:
 * - User signup (all verification methods, hooks, edge cases)
 * - User login (all scenarios, lockout, MFA, challenges, hooks)
 * - Token refresh (rotation, reuse detection, distributed locking)
 * - Logout operations (single, all, token family)
 * - Password management (change, reset, history, expiry)
 * - Account lockout (IP-based, account-based, unlock)
 * - MFA verification (all methods)
 * - Challenge completion (all challenge types)
 * - Trusted device management
 * - User profile updates
 * - Lifecycle hooks (all hooks)
 * - Optional dependencies handling
 * - Audit logging
 * - Security features (constant-time, token rotation, reuse detection)
 */

import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { NAuthException } from '../exceptions/nauth.exception';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { EmailVerificationService } from './email-verification.service';
import { PhoneVerificationService } from './phone-verification.service';
import { ClientInfoService } from './client-info.service';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { TrustedDeviceService } from './trusted-device.service';
import { MFAService } from './mfa.service';
import { SocialAuthService } from './social-auth.service';
import { HookRegistryService } from './hook-registry.service';
import { SignupDTO } from '../dto/signup.dto';
import { AdminSignupDTO } from '../dto/admin-signup.dto';
import { AdminSignupSocialDTO } from '../dto/admin-signup-social.dto';
import { LoginDTO } from '../dto/login.dto';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { ChangePasswordRequestDTO } from '../dto/change-password-request.dto';
import { UpdateUserAttributesRequestDTO } from '../dto/update-user-attributes-request.dto';
import { UpdateVerifiedStatusRequestDTO } from '../dto/update-verified-status-request.dto';
import { LogoutDTO } from '../dto/logout.dto';
import { LogoutAllDTO } from '../dto/logout-all.dto';
import { RefreshTokenDTO } from '../dto/refresh-token.dto';
import { IUser, ISession } from '../interfaces/entities.interface';
import { BaseUser, BaseLoginAttempt, BaseMFADevice } from '../entities';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { RiskFactor } from '../enums/risk-factor.enum';
import {
  VerifyEmailResponse,
  VerifyPhoneResponse,
  CollectPhoneResponse,
  ForceChangePasswordResponse,
  MFASetupResponse,
  VerifyMFACodeResponse,
  VerifyMFAPasskeyResponse,
} from '../dto/challenge-response.dto';
import { ChallengeType, MFAMethodType, RespondChallengeDTO } from '../dto/respond-challenge.dto';
import { MFAMethod } from '../enums/mfa-method.enum';
import { markDtoAsValidated } from '../utils/dto-validator';

/**
 * Create a RespondChallengeDTO from the various \"challenge response\" shapes used in tests.
 *
 * Note: Many test helper response types model `type`/`method` as strings, while
 * RespondChallengeDTO uses enums for validation. We normalize them here to keep
 * test bodies concise and type-safe.
 */
const createRespondChallengeDto = (data: unknown): RespondChallengeDTO => {
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const mapped: Record<string, unknown> = { ...record };

  // ============================================================================
  // Normalize enums used by RespondChallengeDTO validation
  // ============================================================================
  if (typeof mapped.type === 'string') {
    mapped.type = mapped.type as unknown as ChallengeType;
  }
  if (typeof mapped.method === 'string') {
    mapped.method = mapped.method as unknown as MFAMethodType;
  }

  const dto = Object.assign(new RespondChallengeDTO(), mapped);
  markDtoAsValidated(dto);
  return dto;
};

/**
 * Create an UpdateUserAttributesRequestDTO for tests.
 */
const createUpdateUserAttributesDto = (
  sub: string,
  data: Omit<Partial<UpdateUserAttributesRequestDTO>, 'sub'>,
): UpdateUserAttributesRequestDTO => {
  const dto = Object.assign(new UpdateUserAttributesRequestDTO(), { sub, ...data });
  markDtoAsValidated(dto);
  return dto;
};

/**
 * Create an UpdateVerifiedStatusRequestDTO for tests.
 */
const createUpdateVerifiedStatusDto = (
  sub: string,
  data: Omit<Partial<UpdateVerifiedStatusRequestDTO>, 'sub'>,
): UpdateVerifiedStatusRequestDTO => {
  const dto = Object.assign(new UpdateVerifiedStatusRequestDTO(), { sub, ...data });
  markDtoAsValidated(dto);
  return dto;
};

/**
 * Create a ChangePasswordRequestDTO for tests.
 */
const createChangePasswordRequestDto = (
  sub: string,
  data: Omit<Partial<ChangePasswordRequestDTO>, 'sub'>,
): ChangePasswordRequestDTO => {
  const dto = Object.assign(new ChangePasswordRequestDTO(), { sub, ...data });
  markDtoAsValidated(dto);
  return dto;
};

/**
 * Create a LogoutDTO for tests.
 */
const createLogoutDto = (data: Partial<LogoutDTO>): LogoutDTO => {
  const dto = Object.assign(new LogoutDTO(), data);
  markDtoAsValidated(dto);
  return dto;
};

/**
 * Create a LogoutAllDTO for tests.
 */
const createLogoutAllDto = (data: Partial<LogoutAllDTO>): LogoutAllDTO => {
  const dto = Object.assign(new LogoutAllDTO(), data);
  markDtoAsValidated(dto);
  return dto;
};

/**
 * Create a RefreshTokenDTO for tests.
 */
const createRefreshTokenDto = (refreshToken: string): RefreshTokenDTO => {
  const dto = Object.assign(new RefreshTokenDTO(), { refreshToken });
  markDtoAsValidated(dto);
  return dto;
};

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockLoginAttemptRepository: jest.Mocked<Repository<BaseLoginAttempt>>;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockAccountLockoutStorage: jest.Mocked<AccountLockoutStorageService>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockTrustedDeviceService: jest.Mocked<TrustedDeviceService>;
  let mockMfaService: jest.Mocked<MFAService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockHookRegistry: jest.Mocked<HookRegistryService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  const mockUser: IUser = {
    id: 1,
    sub: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: 'hashed-password',
    passwordChangedAt: new Date(),
    passwordHistory: [],
    isEmailVerified: true,
    isPhoneVerified: false,
    isActive: true,
    mustChangePassword: false,
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: null,
    lastLoginIp: null,
    hasSocialAuth: false,
    socialProviders: null,
    mfaEnabled: false,
    mfaMethods: null,
    preferredMfaMethod: null,
    backupCodes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockSession: ISession = {
    id: 1,
    userId: 1,
    accessTokenHash: 'access-hash',
    refreshTokenHash: 'refresh-hash',
    tokenFamily: 'family-abc',
    deviceId: 'device-123',
    deviceName: 'Test Device',
    deviceType: 'desktop',
    deviceFingerprint: null,
    ipAddress: '127.0.0.1',
    ipCountry: null,
    ipCity: null,
    ipIsp: null,
    userAgent: 'test-agent',
    platform: 'web',
    browser: 'chrome',
    authMethod: 'password',
    isRemembered: false,
    isTrustedDevice: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastActivityAt: new Date(),
    isRevoked: false,
    revokedAt: null,
    revokeReason: null,
    version: 1,
    metadata: null,
    createdAt: new Date(),
  } as ISession;

  const mockClientInfo: any = {
    ipAddress: '127.0.0.1',
    ipCountry: 'US',
    ipCity: 'San Francisco',
    deviceToken: null,
    deviceName: 'Test Device',
    deviceType: 'desktop',
    userAgent: 'test-agent',
    platform: 'web',
    browser: 'chrome',
  };

  beforeEach(() => {
    // Create mock repositories
    // Create a fresh query builder mock for each test
    const createMockQueryBuilder = () => ({
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    });
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(createMockQueryBuilder),
    } as any;

    mockLoginAttemptRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockMfaDeviceRepository = {
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;

    // Create mock services
    mockPasswordService = {
      validatePassword: jest.fn(),
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      isPasswordInHistory: jest.fn(),
      addToHistory: jest.fn(),
    } as any;

    mockJwtService = {
      generateTokenPair: jest.fn(),
      hashToken: jest.fn(),
      generateTokenFamily: jest.fn(),
      validateAccessToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      decodeToken: jest.fn(),
      getRefreshTokenTTL: jest.fn().mockReturnValue(2592000), // 30 days
    } as any;

    mockSessionService = {
      createSession: jest.fn(),
      createSessionAtomic: jest.fn(),
      findByRefreshToken: jest.fn(),
      findByIdLight: jest.fn(),
      updateTokens: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      markRefreshTokenAsUsed: jest.fn(),
      isRefreshTokenUsed: jest.fn().mockResolvedValue(false),
      acquireRefreshLock: jest.fn().mockResolvedValue(true),
      releaseRefreshLock: jest.fn(),
      revokeTokenFamily: jest.fn(),
      findById: jest.fn(),
      getSessionExpirationDate: jest.fn().mockReturnValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    } as any;

    mockEmailVerificationService = {
      sendVerificationEmail: jest.fn(),
      verifyEmailWithCode: jest.fn(),
      resendVerificationEmail: jest.fn(),
    } as any;

    mockPhoneVerificationService = {
      sendVerificationSMS: jest.fn(),
      sendVerificationCode: jest.fn(),
      verifyPhoneWithCode: jest.fn(),
      verifyPhoneWithCodeBySub: jest.fn(),
      resendVerificationSMS: jest.fn(),
    } as any;

    mockClientInfoService = {
      get: jest.fn().mockReturnValue(mockClientInfo),
      getResponse: jest.fn().mockReturnValue(undefined),
    } as any;

    mockAccountLockoutStorage = {
      isAccountLocked: jest.fn().mockResolvedValue(false),
      recordFailedAttempt: jest.fn().mockResolvedValue(1),
      resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
      lockIpAddress: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockChallengeService = {
      createSession: jest.fn(),
      createChallengeSession: jest.fn(),
      validateSession: jest.fn(),
      validateAndConsumeSession: jest.fn(),
      incrementAttempts: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      updateMetadata: jest.fn().mockResolvedValue({} as any),
    } as any;

    mockChallengeHelper = {
      determineAuthResponse: jest.fn(),
      createChallengeResponse: jest.fn(),
      createSuccessResponse: jest.fn(),
      createMFAChallengeResponse: jest.fn(),
      createMFASetupChallengeResponse: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as any;

    mockHookRegistry = {
      registerPreSignup: jest.fn(),
      registerPostSignup: jest.fn(),
      registerOnboardingCompleted: jest.fn(),
      executePreSignup: jest.fn().mockResolvedValue(undefined),
      executePostSignup: jest.fn().mockResolvedValue(undefined),
      executeOnboardingCompleted: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockTrustedDeviceService = {
      isDeviceTrusted: jest.fn().mockResolvedValue(false),
      createTrustedDevice: jest.fn().mockResolvedValue('device-token-123'),
      revokeTrustedDevice: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockMfaService = {
      verifyCode: jest.fn().mockResolvedValue({ valid: true }),
      getProvider: jest.fn().mockReturnValue({
        verifySetup: jest.fn().mockResolvedValue(1),
      }),
    } as any;

    mockSocialAuthService = {
      findSocialAccountByProvider: jest.fn(),
      findSocialAccountByUser: jest.fn(),
      createOrUpdateSocialAccount: jest.fn(),
      updateUserSocialFlags: jest.fn(),
    } as any;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    } as any;

    // Default config
    mockConfig = {
      jwt: {
        algorithm: 'HS256',
        accessToken: {
          secret: 'test-secret',
          expiresIn: 900, // 15 minutes
        },
        refreshToken: {
          secret: 'test-refresh-secret',
          expiresIn: 2592000, // 30 days
          rotation: true,
          reuseDetection: true,
        },
      },
      signup: {
        enabled: true,
        verificationMethod: 'none',
      },
      login: {},
      lockout: {
        enabled: true,
        maxAttempts: 5,
        duration: 900,
        resetOnSuccess: true,
      },
      password: {
        historyCount: 5,
      },
      session: {},
    };

    // Instantiate service directly
    service = new AuthService(
      mockUserRepository,
      mockLoginAttemptRepository,
      mockPasswordService,
      mockJwtService,
      mockSessionService,
      mockChallengeService,
      mockChallengeHelper,
      mockEmailVerificationService,
      mockClientInfoService,
      mockAccountLockoutStorage,
      mockConfig,
      mockLogger,
      mockHookRegistry,
      mockAuditService,
      mockPhoneVerificationService,
      mockMfaService,
      mockMfaDeviceRepository,
      mockTrustedDeviceService,
      undefined, // passwordResetService (not needed for most tests)
      mockSocialAuthService,
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

  it('should log initialization', () => {
    expect(mockLogger.log).toHaveBeenCalledWith('AuthService initialized');
  });

  // ============================================================================
  // signup Tests
  // ============================================================================

  describe('signup()', () => {
    const signupDto: SignupDTO = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      username: 'newuser',
    };

    beforeEach(() => {
      mockChallengeHelper.determineAuthResponse.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
        refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 604800,
        user: {
          sub: 'user-123',
          email: 'newuser@example.com',
          isEmailVerified: true,
          isPhoneVerified: false,
        },
      });
    });

    describe('Basic signup flow', () => {
      it('should create a new user successfully with verificationMethod: none', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        const result = await service.signup(signupDto);

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: signupDto.email } });
        expect(mockPasswordService.validatePassword).toHaveBeenCalled();
        expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(signupDto.password);
        expect(mockUserRepository.save).toHaveBeenCalled();
        expect(mockChallengeHelper.determineAuthResponse).toHaveBeenCalled();
        expect(result.user).toBeDefined();
        expect(result.accessToken).toBe('access-token');
        expect(result.refreshToken).toBe('refresh-token');
        expect(result.challengeName).toBeUndefined();
      });

      it('should hash password with Argon2id', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDto);

        expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(signupDto.password);
      });

      it('should create user with isActive: true and isEmailVerified always false initially', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        const createdUser = { ...mockUser, email: signupDto.email };
        mockUserRepository.create.mockReturnValue(createdUser as any);
        mockUserRepository.save.mockResolvedValue(createdUser as any);

        await service.signup(signupDto);

        expect(mockUserRepository.create).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            email: signupDto.email,
            passwordHash: 'hashed-password',
            isActive: true,
            isEmailVerified: false, // Always false initially - must be explicitly verified
          }),
        );
      });
    });

    describe('Duplicate checks', () => {
      it('should throw NAuthException if user with email already exists', async () => {
        mockUserRepository.findOne.mockResolvedValue(mockUser as any);

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.EMAIL_EXISTS);
        }
      });

      it('should throw NAuthException if username already exists', async () => {
        mockUserRepository.findOne.mockImplementation((options: any) => {
          if (options.where?.email) return Promise.resolve(null);
          if (options.where?.username) return Promise.resolve(mockUser as any);
          return Promise.resolve(null);
        });

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.USERNAME_EXISTS);
        }
      });

      it('should throw NAuthException if phone already exists when allowDuplicatePhones is false', async () => {
        const signupDtoWithPhone: SignupDTO = {
          ...signupDto,
          phone: '+1234567890',
        };
        mockConfig.signup!.allowDuplicatePhones = false;

        mockUserRepository.findOne.mockImplementation((options: any) => {
          if (options.where?.email) return Promise.resolve(null);
          if (options.where?.username) return Promise.resolve(null);
          if (options.where?.phone) return Promise.resolve(mockUser as any);
          return Promise.resolve(null);
        });

        try {
          await service.signup(signupDtoWithPhone);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PHONE_EXISTS);
        }
      });

      it('should allow duplicate phones when allowDuplicatePhones is true', async () => {
        const signupDtoWithPhone: SignupDTO = {
          ...signupDto,
          phone: '+1234567890',
        };
        mockConfig.signup!.allowDuplicatePhones = true;

        mockUserRepository.findOne.mockImplementation((options: any) => {
          if (options.where?.email) return Promise.resolve(null);
          if (options.where?.username) return Promise.resolve(null);
          // Don't check phone when allowDuplicatePhones is true
          return Promise.resolve(null);
        });
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDtoWithPhone);

        // Should not throw
        expect(mockUserRepository.save).toHaveBeenCalled();
      });
    });

    describe('Password validation', () => {
      it('should throw NAuthException if password is invalid', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({
          valid: false,
          errors: ['Password is too weak', 'Password must contain uppercase'],
        });

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          // Password validation happens in handleForceChangePassword, which throws WEAK_PASSWORD
          // But validation might happen earlier in validateChallengeParams
          expect([AuthErrorCode.WEAK_PASSWORD, AuthErrorCode.VALIDATION_FAILED]).toContain(error.code);
          expect(error.message).toContain('Password is too weak');
        }
      });

      it('should pass email and username to password validation', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDto);

        expect(mockPasswordService.validatePassword).toHaveBeenCalledWith(signupDto.password, {
          email: signupDto.email,
          username: signupDto.username,
        });
      });
    });

    describe('Verification method: email', () => {
      beforeEach(() => {
        mockConfig.signup!.verificationMethod = 'email';
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.VERIFY_EMAIL,
          session: 'session-token-123',
          challengeParameters: {
            email: signupDto.email,
            instructions: 'Please verify your email address',
          },
        });
      });

      it('should return VERIFY_EMAIL challenge', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);
        mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 123 } as any);

        const result = await service.signup(signupDto);

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
        expect(result.session).toBe('session-token-123');
        expect(result.accessToken).toBeUndefined();
        expect(result.refreshToken).toBeUndefined();
        // Note: sendVerificationEmail is called by challengeHelper.createChallengeResponse, not directly
        // The challenge helper handles sending verification codes when challenges are created
      });

      it('should create user with isEmailVerified: false', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        const createdUser = { ...mockUser, email: signupDto.email, isEmailVerified: false };
        mockUserRepository.create.mockReturnValue(createdUser as any);
        mockUserRepository.save.mockResolvedValue(createdUser as any);
        mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 123 } as any);

        await service.signup(signupDto);

        expect(mockUserRepository.create).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            isEmailVerified: false,
          }),
        );
      });
    });

    describe('Verification method: phone', () => {
      beforeEach(() => {
        mockConfig.signup!.verificationMethod = 'phone';
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.VERIFY_PHONE,
          session: 'session-token-123',
          challengeParameters: {
            phone: '+1234567890',
            instructions: 'Please verify your phone number',
          },
        });
      });

      it('should throw NAuthException if phone is required but not provided', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PHONE_REQUIRED);
        }
      });

      it('should return VERIFY_PHONE challenge when phone is provided', async () => {
        const signupDtoWithPhone: SignupDTO = {
          ...signupDto,
          phone: '+1234567890',
        };

        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        const result = await service.signup(signupDtoWithPhone);

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
        // Phone verification SMS is sent during challenge completion, not during signup
      });
    });

    describe('Verification method: both', () => {
      beforeEach(() => {
        mockConfig.signup!.verificationMethod = 'both';
        // Sequential challenges: first VERIFY_EMAIL, then VERIFY_PHONE
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.VERIFY_EMAIL,
          session: 'session-token-email',
          challengeParameters: {
            email: signupDto.email,
            codeDeliveryDestination: 't***@example.com',
          },
        });
      });

      it('should throw NAuthException if phone is required but not provided', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PHONE_REQUIRED);
        }
      });

      it('should return VERIFY_EMAIL challenge first when both are provided (sequential flow)', async () => {
        const signupDtoWithPhone: SignupDTO = {
          ...signupDto,
          phone: '+1234567890',
        };

        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);
        mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 123 } as any);

        const result = await service.signup(signupDtoWithPhone);

        // Sequential challenges: first VERIFY_EMAIL, then VERIFY_PHONE after email is verified
        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
        // When verificationMethod is 'both', email is sent by challenge system when VERIFY_EMAIL challenge is created
        // Phone verification SMS is sent when VERIFY_PHONE challenge is created (after email is verified)
      });
    });

    describe('Lifecycle hooks', () => {
      describe('preSignup hook', () => {
        beforeEach(() => {
          mockUserRepository.findOne.mockResolvedValue(null);
          mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
          mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
          mockUserRepository.create.mockReturnValue(mockUser as any);
          mockUserRepository.save.mockResolvedValue(mockUser as any);
        });

        it('should execute preSignup hook before user creation for password signup', async () => {
          mockHookRegistry.executePreSignup.mockResolvedValue(undefined);

          await service.signup(signupDto);

          expect(mockHookRegistry.executePreSignup).toHaveBeenCalledTimes(1);
          expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
            expect.objectContaining({
              email: signupDto.email,
              password: signupDto.password,
              username: signupDto.username,
            }),
            'password',
            undefined,
            false, // adminSignup flag
          );
          expect(mockUserRepository.save).toHaveBeenCalled();
        });

        it('should block signup when preSignup hook throws PRESIGNUP_FAILED', async () => {
          const customMessage = 'This email address is not allowed to sign up';
          mockHookRegistry.executePreSignup.mockRejectedValue(
            new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, customMessage),
          );

          try {
            await service.signup(signupDto);
            fail('Should have thrown NAuthException');
          } catch (error: any) {
            expect(error).toBeInstanceOf(NAuthException);
            expect(error.code).toBe(AuthErrorCode.PRESIGNUP_FAILED);
            expect(error.message).toBe(customMessage);
          }

          expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
            expect.objectContaining({
              email: signupDto.email,
              password: signupDto.password,
              username: signupDto.username,
            }),
            'password',
            undefined,
            false, // adminSignup flag
          );
          expect(mockUserRepository.save).not.toHaveBeenCalled();
        });

        it('should wrap non-PRESIGNUP_FAILED errors in PRESIGNUP_FAILED', async () => {
          const genericError = new Error('Generic validation error');
          // Mock the HookRegistry to throw the wrapped exception (as the real HookRegistry would)
          mockHookRegistry.executePreSignup.mockRejectedValue(
            new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Generic validation error'),
          );

          try {
            await service.signup(signupDto);
            fail('Should have thrown NAuthException');
          } catch (error: any) {
            expect(error).toBeInstanceOf(NAuthException);
            expect(error.code).toBe(AuthErrorCode.PRESIGNUP_FAILED);
            expect(error.message).toBe('Generic validation error');
          }

          expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
          expect(mockUserRepository.save).not.toHaveBeenCalled();
        });

        it('should allow signup when preSignup hook resolves successfully', async () => {
          mockHookRegistry.executePreSignup.mockResolvedValue(undefined);

          await service.signup(signupDto);

          expect(mockUserRepository.save).toHaveBeenCalled();
        });
      });

      it('should execute postSignup hook after successful signup', async () => {
        mockHookRegistry.executePostSignup.mockResolvedValue(undefined);
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDto);

        expect(mockHookRegistry.executePostSignup).toHaveBeenCalled();
      });
    });

    describe('Signup disabled', () => {
      it('should throw NAuthException if signup is disabled', async () => {
        mockConfig.signup!.enabled = false;

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.SIGNUP_DISABLED);
        }
      });
    });

    describe('Database constraint violations', () => {
      it('should handle PostgreSQL unique constraint violation for email', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        const dbError = {
          code: '23505',
          detail: 'Key (email)=(newuser@example.com) already exists.',
          message: 'duplicate key value violates unique constraint',
        };
        mockUserRepository.save.mockRejectedValue(dbError);

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.EMAIL_EXISTS);
        }
      });

      it('should handle PostgreSQL unique constraint violation for username', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        const dbError = {
          code: '23505',
          detail: 'Key (username)=(newuser) already exists.',
          message: 'duplicate key value violates unique constraint',
        };
        mockUserRepository.save.mockRejectedValue(dbError);

        try {
          await service.signup(signupDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.USERNAME_EXISTS);
        }
      });

      it('should handle PostgreSQL unique constraint violation for phone', async () => {
        const signupDtoWithPhone: SignupDTO = {
          ...signupDto,
          phone: '+1234567890',
        };
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        const dbError = {
          code: '23505',
          detail: 'Key (phone)=(+1234567890) already exists.',
          message: 'duplicate key value violates unique constraint',
        };
        mockUserRepository.save.mockRejectedValue(dbError);

        try {
          await service.signup(signupDtoWithPhone);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PHONE_EXISTS);
        }
      });
    });

    describe('Audit logging', () => {
      it('should record ACCOUNT_CREATED audit event on successful signup', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDto);

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.ACCOUNT_CREATED,
            eventStatus: 'INFO',
            authMethod: 'password',
          }),
        );
      });

      it('should handle audit logging errors gracefully', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        const result = await service.signup(signupDto);

        // Should still succeed despite audit error
        expect(result.user).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('Optional fields', () => {
      it('should handle signup without username', async () => {
        const signupDtoNoUsername: SignupDTO = {
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
        };

        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDtoNoUsername);

        expect(mockUserRepository.findOne).not.toHaveBeenCalledWith(
          (expect as any).objectContaining({
            where: (expect as any).objectContaining({ username: (expect as any).anything() }),
          }),
        );
      });

      it('should handle signup with firstName and lastName', async () => {
        const signupDtoWithName: SignupDTO = {
          ...signupDto,
          firstName: 'John',
          lastName: 'Doe',
        };

        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDtoWithName);

        expect(mockUserRepository.create).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            firstName: 'John',
            lastName: 'Doe',
          }),
        );
      });

      it('should handle signup with metadata', async () => {
        const signupDtoWithMetadata: SignupDTO = {
          ...signupDto,
          metadata: { customField: 'value' },
        };

        mockUserRepository.findOne.mockResolvedValue(null);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);

        await service.signup(signupDtoWithMetadata);

        expect(mockUserRepository.create).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            metadata: { customField: 'value' },
          }),
        );
      });
    });
  });

  // ============================================================================
  // login Tests
  // ============================================================================

  describe('login()', () => {
    const loginDto: LoginDTO = {
      identifier: 'test@example.com',
      password: 'SecurePassword123!',
    };

    beforeEach(() => {
      mockChallengeHelper.determineAuthResponse.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
        refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 604800,
        user: {
          sub: mockUser.sub,
          email: mockUser.email,
          isEmailVerified: true,
          isPhoneVerified: false,
        },
      });
    });

    describe('Successful login', () => {
      beforeEach(() => {
        // Ensure determineAuthResponse doesn't return tokens directly (so code continues to session creation)
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          // No challengeName, no tokens - code will continue to create session
        } as any);
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);
      });

      it('should login user successfully and return tokens', async () => {
        const result = await service.login(loginDto);

        expect(result.user).toBeDefined();
        expect(result.accessToken).toBe('access-token');
        expect(result.refreshToken).toBe('refresh-token');
        expect(mockPasswordService.verifyPassword).toHaveBeenCalledWith(loginDto.password, mockUser.passwordHash!);
        expect(mockSessionService.createSessionAtomic).toHaveBeenCalled();
        expect(mockAccountLockoutStorage.resetFailedAttempts).toHaveBeenCalled();
      });

      it('should update user lastLoginAt and lastLoginIp on successful login', async () => {
        await service.login(loginDto);

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            lastLoginAt: (expect as any).any(Date),
            lastLoginIp: mockClientInfo.ipAddress!,
            failedLoginAttempts: 0,
          }),
        );
      });

      it('should record successful login attempt', async () => {
        await service.login(loginDto);

        expect(mockLoginAttemptRepository.create).toHaveBeenCalled();
        expect(mockLoginAttemptRepository.save).toHaveBeenCalled();
      });

      it('should reset failed login attempts on successful login', async () => {
        await service.login(loginDto);

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            failedLoginAttempts: 0,
          }),
        );
      });

      it('should record LOGIN_SUCCESS audit event', async () => {
        await service.login(loginDto);

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.LOGIN_SUCCESS,
            eventStatus: 'SUCCESS',
            authMethod: 'password',
          }),
        );
      });

      // TODO: Re-enable when afterLogin hook is implemented in HookRegistryService
      // it('should execute afterLogin hook on successful login', async () => {
      //   mockHookRegistry.executeAfterLogin.mockResolvedValue(undefined);
      //   await service.login(loginDto);
      //   expect(mockHookRegistry.executeAfterLogin).toHaveBeenCalledWith(mockUser, mockSession);
      // });
    });

    describe('User lookup by identifier', () => {
      it('should find user by email', async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        await service.login({ identifier: 'test@example.com', password: 'password' });

        expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :identifier', { identifier: 'test@example.com' });
      });

      it('should find user by username when identifierType is email_or_username', async () => {
        mockConfig.login!.identifierType = 'email_or_username';
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        await service.login({ identifier: 'testuser', password: 'password' });

        expect(queryBuilder.where).toHaveBeenCalled();
        expect(queryBuilder.orWhere).toHaveBeenCalled();
      });

      it('should throw NAuthException when identifierType is email but username provided', async () => {
        mockConfig.login!.identifierType = 'email';
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login({ identifier: 'testuser', password: 'password' });
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
        }
      });
    });

    describe('IP-based lockout', () => {
      it('should throw NAuthException if IP address is locked', async () => {
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(true);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_LOGIN);
        }
      });

      it('should record LOGIN_BLOCKED audit event when IP is locked', async () => {
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(true);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          // Expected to throw
        }

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.LOGIN_BLOCKED,
            eventStatus: 'FAILURE',
            reason: 'ip_locked',
          }),
        );
      });

      it('should reset IP-based failed attempts on successful login when resetOnSuccess is true', async () => {
        mockConfig.lockout!.resetOnSuccess = true;
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        await service.login(loginDto);

        expect(mockAccountLockoutStorage.resetFailedAttempts).toHaveBeenCalledWith(mockClientInfo.ipAddress);
      });
    });

    describe('Invalid credentials', () => {
      it('should throw NAuthException if user not found (constant-time response)', async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        // Password verification still called with dummy hash (constant-time)
        mockPasswordService.verifyPassword.mockResolvedValue(false);
        mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
        }
        // Verify password was still called (constant-time protection)
        expect(mockPasswordService.verifyPassword).toHaveBeenCalled();
      });

      it('should throw NAuthException if password is invalid', async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(false);
        mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
        }
        expect(mockAccountLockoutStorage.recordFailedAttempt).toHaveBeenCalled();
      });

      it('should record failed login attempt for invalid credentials', async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(false);
        mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          // Expected
        }

        expect(mockLoginAttemptRepository.create).toHaveBeenCalled();
        expect(mockLoginAttemptRepository.save).toHaveBeenCalled();
      });

      it('should record LOGIN_FAILED audit event for invalid credentials', async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(false);
        mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          // Expected
        }

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.LOGIN_FAILED,
            eventStatus: 'FAILURE',
            reason: 'invalid_credentials',
          }),
        );
      });

      it('should provide helpful error for social-only users', async () => {
        const socialUser = { ...mockUser, passwordHash: null, socialProviders: ['google'] };
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(socialUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(false);
        mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
          expect(error.message).toContain('Google');
        }
      });

      // TODO: Re-enable when afterLoginFailed hook is implemented in HookRegistryService
      // it('should execute afterLoginFailed hook on failed login', async () => {
      //   mockHookRegistry.executeAfterLoginFailed.mockResolvedValue(undefined);
      //   const queryBuilder = {
      //     where: jest.fn().mockReturnThis(),
      //     orWhere: jest.fn().mockReturnThis(),
      //     select: jest.fn().mockReturnThis(),
      //     getOne: jest.fn().mockResolvedValue(mockUser),
      //   };
      //   mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
      //   mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
      //   mockPasswordService.verifyPassword.mockResolvedValue(false);
      //   mockAccountLockoutStorage.recordFailedAttempt.mockResolvedValue(1);
      //   mockLoginAttemptRepository.create.mockReturnValue({} as any);
      //   mockLoginAttemptRepository.save.mockResolvedValue({} as any);
      //
      //   try {
      //     await service.login(loginDto);
      //     fail('Should have thrown NAuthException');
      //   } catch (error: any) {
      //     // Expected
      //   }
      //
      //   expect(mockHookRegistry.executeAfterLoginFailed).toHaveBeenCalledWith(loginDto.identifier, 'invalid_credentials');
      // });
    });

    describe('Account status checks', () => {
      it('should throw NAuthException if account is inactive', async () => {
        const inactiveUser = { ...mockUser, isActive: false };
        // Ensure determineAuthResponse doesn't return tokens directly (so code continues to check isActive)
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          // No challengeName, no tokens - code will continue to check isActive
        } as any);
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(inactiveUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.ACCOUNT_INACTIVE);
        }
      });

      it('should record LOGIN_BLOCKED audit event when account is inactive', async () => {
        const inactiveUser = { ...mockUser, isActive: false };
        // Ensure determineAuthResponse doesn't return tokens directly (so code continues to check isActive)
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          // No challengeName, no tokens - code will continue to check isActive
        } as any);
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(inactiveUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        try {
          await service.login(loginDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.ACCOUNT_INACTIVE);
        }

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.LOGIN_BLOCKED,
            eventStatus: 'FAILURE',
            reason: 'account_inactive',
          }),
        );
      });
    });

    describe('Lifecycle hooks', () => {
      // NOTE: beforeLogin hook is not implemented in AuthService.login()
      // Only afterLogin and afterLoginFailed hooks are available
      // These tests are removed as they test non-existent functionality
    });

    describe('Challenge system', () => {
      it('should return VERIFY_EMAIL challenge when email not verified', async () => {
        const unverifiedUser = { ...mockUser, isEmailVerified: false };
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(unverifiedUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.VERIFY_EMAIL,
          session: 'challenge-session',
          challengeParameters: {
            email: unverifiedUser.email,
          },
        });
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        const result = await service.login(loginDto);

        expect(result.challengeName).toBe(AuthChallenge.VERIFY_EMAIL);
        expect(result.accessToken).toBeUndefined();
      });

      it('should return FORCE_CHANGE_PASSWORD challenge when mustChangePassword is true', async () => {
        const userWithMustChange = { ...mockUser, mustChangePassword: true };
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(userWithMustChange),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.FORCE_CHANGE_PASSWORD,
          session: 'challenge-session',
          challengeParameters: {
            instructions: 'You must change your password',
          },
        });
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        const result = await service.login(loginDto);

        expect(result.challengeName).toBe(AuthChallenge.FORCE_CHANGE_PASSWORD);
      });

      it('should return MFA_REQUIRED challenge when MFA is required', async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.MFA_REQUIRED,
          session: 'mfa-session',
          challengeParameters: {},
        });
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        const result = await service.login(loginDto);

        expect(result.challengeName).toBe(AuthChallenge.MFA_REQUIRED);
      });

      it('should handle password expiry and force password change', async () => {
        mockConfig.password!.expiryDays = 90;
        const userWithExpiredPassword = {
          ...mockUser,
          passwordChangedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000), // 91 days ago
        };
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(userWithExpiredPassword),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          challengeName: AuthChallenge.FORCE_CHANGE_PASSWORD,
          session: 'challenge-session',
          challengeParameters: {},
        });
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        const result = await service.login(loginDto);

        expect(result.challengeName).toBe(AuthChallenge.FORCE_CHANGE_PASSWORD);
        expect(mockUserRepository.update).toHaveBeenCalledWith(
          userWithExpiredPassword.id,
          (expect as any).objectContaining({
            mustChangePassword: true,
          }),
        );
      });
    });

    describe('Single session mode', () => {
      it('should revoke other sessions when disallowMultipleSessions is enabled', async () => {
        mockConfig.session!.disallowMultipleSessions = true;
        // Ensure determineAuthResponse doesn't return tokens directly (so code continues to session creation)
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          // No challengeName, no tokens - code will continue to create session
        } as any);
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockSessionService.revokeAllUserSessions.mockResolvedValue(2);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        await service.login(loginDto);

        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id, 'Login from new session');
      });
    });

    describe('Trusted device management', () => {
      it('should check if device is already trusted', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        // Ensure determineAuthResponse doesn't return tokens directly (so code continues to session creation)
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          // No challengeName, no tokens - code will continue to create session
        } as any);
        mockClientInfo.deviceToken = 'existing-device-token';
        mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(true);
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        const result = await service.login(loginDto);

        expect(mockTrustedDeviceService.isDeviceTrusted).toHaveBeenCalledWith('existing-device-token', mockUser.id);
        expect(result.trusted).toBe(true);
      });

      it('should auto-create trusted device when rememberDevices is always', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        // Ensure determineAuthResponse doesn't return tokens directly (so code continues to session creation)
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          // No challengeName, no tokens - code will continue to create session
        } as any);
        mockClientInfo.deviceToken = null; // No existing device token
        mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(false);
        mockTrustedDeviceService.createTrustedDevice.mockResolvedValue('new-device-token');
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        };
        mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
        mockAccountLockoutStorage.isAccountLocked.mockResolvedValue(false);
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
        mockJwtService.generateTokenFamily.mockReturnValue('family-abc');
        mockJwtService.generateTokenPair.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
        mockJwtService.hashToken.mockReturnValue('token-hash');
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 900 },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: Math.floor(Date.now() / 1000) + 604800 },
        } as any);
        mockSessionService.createSessionAtomic.mockResolvedValue({
          session: mockSession,
          extra: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        } as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockLoginAttemptRepository.create.mockReturnValue({} as any);
        mockLoginAttemptRepository.save.mockResolvedValue({} as any);

        const result = await service.login(loginDto);

        expect(mockTrustedDeviceService.createTrustedDevice).toHaveBeenCalled();
        expect(result.deviceToken).toBe('new-device-token');
        expect(result.trusted).toBe(true);
      });
    });
  });

  // ============================================================================
  // refreshToken Tests
  // ============================================================================

  describe('refreshToken()', () => {
    const mockRefreshToken = 'refresh-token-123';
    const mockTokenHash = 'token-hash-123';
    const mockPayload = {
      sub: mockUser.sub,
      email: mockUser.email,
      type: 'refresh' as const,
      sessionId: '1',
      tokenFamily: 'family-abc',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    beforeEach(() => {
      mockJwtService.hashToken.mockReturnValue(mockTokenHash);
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      } as any);
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 900 },
      } as any);
      mockSessionService.findByRefreshToken.mockResolvedValue(mockSession);
      mockSessionService.findByIdLight.mockResolvedValue(mockSession);
      mockSessionService.acquireRefreshLock.mockResolvedValue(true);
      mockSessionService.isRefreshTokenUsed.mockResolvedValue(false);
      mockSessionService.markRefreshTokenAsUsed.mockResolvedValue(true);
      mockJwtService.generateTokenPair.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });
      mockJwtService.decodeToken.mockReturnValue(mockPayload as any);
      mockSessionService.updateTokens.mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
    });

    describe('Successful token refresh', () => {
      it('should refresh tokens successfully', async () => {
        const result = await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(result.accessToken).toBe('new-access-token');
        expect(result.refreshToken).toBe('new-refresh-token');
        expect(mockJwtService.hashToken).toHaveBeenCalledWith(mockRefreshToken);
        expect(mockSessionService.findByRefreshToken).toHaveBeenCalledWith(mockTokenHash);
        expect(mockSessionService.acquireRefreshLock).toHaveBeenCalled();
        expect(mockJwtService.validateRefreshToken).toHaveBeenCalledWith(mockRefreshToken);
        expect(mockSessionService.updateTokens).toHaveBeenCalled();
      });

      it('should acquire distributed lock before validation', async () => {
        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        const lockCall = mockSessionService.acquireRefreshLock.mock.calls[0];
        expect(lockCall[0]).toContain('session-refresh:');
        expect(lockCall[0]).toContain(mockSession.id.toString());
      });

      it('should mark refresh token as used when reuseDetection is enabled', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = true;

        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(mockSessionService.markRefreshTokenAsUsed).toHaveBeenCalledWith(
          mockTokenHash,
          mockJwtService.getRefreshTokenTTL(),
        );
      });

      it('should not mark token as used when reuseDetection is disabled', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = false;

        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(mockSessionService.markRefreshTokenAsUsed).not.toHaveBeenCalled();
      });

      it('should rotate refresh token (generate new token pair)', async () => {
        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith({
          userId: mockUser.sub,
          email: mockUser.email,
          sessionId: mockSession.id.toString(),
          tokenFamily: mockSession.tokenFamily,
        });
      });

      it('should update session with new token hashes', async () => {
        mockJwtService.hashToken
          .mockReturnValueOnce(mockTokenHash) // For initial hash
          .mockReturnValueOnce('new-access-hash')
          .mockReturnValueOnce('new-refresh-hash');

        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(mockSessionService.updateTokens).toHaveBeenCalledWith(
          mockSession.id,
          'new-access-hash',
          'new-refresh-hash',
        );
      });

      it('should return token expiry times', async () => {
        const accessExp = Math.floor(Date.now() / 1000) + 900;
        const refreshExp = Math.floor(Date.now() / 1000) + 604800;
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: { exp: accessExp },
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: { exp: refreshExp },
        } as any);

        const result = await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(result.accessTokenExpiresAt).toBe(accessExp);
        expect(result.refreshTokenExpiresAt).toBe(refreshExp);
      });

      it('should release lock after successful refresh', async () => {
        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(mockSessionService.releaseRefreshLock).toHaveBeenCalled();
      });
    });

    describe('Invalid token handling', () => {
      it('should throw NAuthException if refresh token is invalid', async () => {
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: false,
          payload: undefined,
        } as any);

        try {
          await service.refreshToken(createRefreshTokenDto('invalid-token'));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.TOKEN_INVALID);
        }
      });

      it('should clear auth cookies when refresh fails with invalid token in cookie delivery modes', async () => {
        mockConfig.tokenDelivery = {
          method: 'cookies',
          cookieNamePrefix: 'nauth',
          cookieOptions: { path: '/', secure: true, sameSite: 'strict' },
        } as any;

        const clearCookie = jest.fn();
        mockClientInfoService.getResponse.mockReturnValue({ clearCookie } as any);

        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: false,
          payload: undefined,
        } as any);

        await expect(service.refreshToken(createRefreshTokenDto('invalid-token'))).rejects.toBeInstanceOf(NAuthException);

        expect(clearCookie).toHaveBeenCalledWith('nauth_access_token', expect.anything());
        expect(clearCookie).toHaveBeenCalledWith('nauth_refresh_token', expect.anything());
        expect(clearCookie).toHaveBeenCalledWith('nauth_csrf_token', expect.anything());
      });

      it('should throw NAuthException if session not found', async () => {
        mockSessionService.findByRefreshToken.mockResolvedValue(null);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
        }
      });

      it('should clear auth cookies when refresh fails with session not found in cookie delivery modes', async () => {
        mockConfig.tokenDelivery = {
          method: 'cookies',
          cookieNamePrefix: 'nauth',
          cookieOptions: { path: '/', secure: true, sameSite: 'strict' },
        } as any;

        const clearCookie = jest.fn();
        mockClientInfoService.getResponse.mockReturnValue({ clearCookie } as any);

        mockSessionService.findByRefreshToken.mockResolvedValue(null);

        await expect(service.refreshToken(createRefreshTokenDto(mockRefreshToken))).rejects.toBeInstanceOf(NAuthException);

        expect(clearCookie).toHaveBeenCalledWith('nauth_access_token', expect.anything());
        expect(clearCookie).toHaveBeenCalledWith('nauth_refresh_token', expect.anything());
        expect(clearCookie).toHaveBeenCalledWith('nauth_csrf_token', expect.anything());
      });

      it('should throw NAuthException if session is revoked', async () => {
        const revokedSession = { ...mockSession, isRevoked: true };
        mockSessionService.findByRefreshToken.mockResolvedValue(revokedSession);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
        }
      });

      it('should throw NAuthException if session changed after lock acquisition', async () => {
        mockSessionService.findByIdLight.mockResolvedValue(null);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
        }
      });
    });

    describe('Distributed locking', () => {
      it('should throw NAuthException if lock cannot be acquired', async () => {
        mockSessionService.acquireRefreshLock.mockResolvedValue(false);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_LOGIN);
        }
      });

      it('should release lock even if validation fails', async () => {
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: false,
          payload: undefined,
        } as any);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          // Expected
        }

        expect(mockSessionService.releaseRefreshLock).toHaveBeenCalled();
      });

      it('should release lock even if token generation fails', async () => {
        mockJwtService.generateTokenPair.mockRejectedValue(new Error('Token generation failed'));

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown Error');
        } catch (error: any) {
          // Expected
        }

        expect(mockSessionService.releaseRefreshLock).toHaveBeenCalled();
      });
    });

    describe('Token reuse detection', () => {
      it('should detect token reuse via atomic mark failure and audit the event', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = true;
        // First check passes (token not yet marked)
        mockSessionService.isRefreshTokenUsed.mockResolvedValue(false);
        // But atomic mark fails (token was already used by another request)
        mockSessionService.markRefreshTokenAsUsed.mockResolvedValue(false);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.TOKEN_INVALID);
        }

        // Should audit the reuse attempt
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
            riskFactors: (expect as any).arrayContaining([RiskFactor.TOKEN_REUSE_ATTEMPT]),
          }),
        );
      });

      it('should handle cookie race condition (same session, token already used)', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = true;
        mockSessionService.isRefreshTokenUsed.mockResolvedValue(true);
        // Token's sessionId matches the session we found (cookie race)
        mockJwtService.decodeToken.mockReturnValue({
          ...mockPayload,
          sessionId: mockSession.id.toString(),
        } as any);

        const result = await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        // Should return current tokens (not throw error)
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
      });

      it('should detect attack when token reused from different session', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = true;
        mockSessionService.isRefreshTokenUsed.mockResolvedValue(true);
        // Token's sessionId doesn't match the session we found (attack!)
        mockJwtService.decodeToken.mockReturnValue({
          ...mockPayload,
          sessionId: '999', // Different session ID
        } as any);
        mockSessionService.revokeSession.mockResolvedValue(undefined);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.TOKEN_INVALID);
        }

        expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
          mockSession.id,
          'Token reuse detected - possible token theft',
        );
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
            eventStatus: 'SUSPICIOUS',
            riskFactors: (expect as any).arrayContaining([RiskFactor.TOKEN_THEFT_ATTEMPT]),
          }),
        );
      });

      it('should throw NAuthException if atomic mark fails (reuse detected)', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = true;
        mockSessionService.markRefreshTokenAsUsed.mockResolvedValue(false);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.TOKEN_INVALID);
        }

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
            riskFactors: (expect as any).arrayContaining([RiskFactor.TOKEN_REUSE_ATTEMPT]),
          }),
        );
      });
    });

    describe('Token family management', () => {
      it('should use same token family for rotated tokens', async () => {
        await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            tokenFamily: mockSession.tokenFamily,
          }),
        );
      });

      it('should audit token reuse attempt when atomic mark fails', async () => {
        mockConfig.jwt.refreshToken.reuseDetection = true;
        mockSessionService.isRefreshTokenUsed.mockResolvedValue(false);
        mockSessionService.markRefreshTokenAsUsed.mockResolvedValue(false);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          // Expected
        }

        // Should audit the reuse attempt
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
            riskFactors: (expect as any).arrayContaining([RiskFactor.TOKEN_REUSE_ATTEMPT]),
          }),
        );
      });
    });

    describe('Error handling', () => {
      it('should handle user not found in cookie race scenario', async () => {
        // Cookie race scenario - token already used for same session
        mockConfig.jwt.refreshToken.reuseDetection = true;
        mockSessionService.isRefreshTokenUsed.mockResolvedValue(true);
        mockJwtService.decodeToken.mockReturnValue({
          ...mockPayload,
          sessionId: mockSession.id.toString(),
        } as any);
        mockUserRepository.findOne.mockResolvedValue(null);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });

      it('should handle audit logging errors gracefully in cookie race scenario', async () => {
        // Cookie race scenario where audit fails
        mockConfig.jwt.refreshToken.reuseDetection = true;
        mockSessionService.isRefreshTokenUsed.mockResolvedValue(true);
        mockJwtService.decodeToken.mockReturnValue({
          ...mockPayload,
          sessionId: mockSession.id.toString(),
        } as any);
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        const result = await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        // Should still succeed despite audit error
        expect(result.accessToken).toBeDefined();
      });
    });

    describe('Edge cases', () => {
      it('should handle missing expiry in token payload', async () => {
        mockJwtService.validateAccessToken.mockResolvedValue({
          valid: true,
          payload: {},
        } as any);
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: true,
          payload: {},
        } as any);

        const result = await service.refreshToken(createRefreshTokenDto(mockRefreshToken));

        expect(result.accessTokenExpiresAt).toBe(0);
        expect(result.refreshTokenExpiresAt).toBe(0);
      });

      it('should handle token validation returning undefined payload', async () => {
        mockJwtService.validateRefreshToken.mockResolvedValue({
          valid: false,
          payload: undefined,
        } as any);

        try {
          await service.refreshToken(createRefreshTokenDto(mockRefreshToken));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
        }
      });
    });
  });

  // ============================================================================
  // logout Tests
  // ============================================================================

  describe('logout()', () => {
    const mockSub = 'user-123';
    const mockSessionId = '1';

    beforeEach(() => {
      // logout() reads sessionId from client info context (not from parameters)
      mockClientInfo.sessionId = parseInt(mockSessionId, 10);
      mockSessionService.revokeSession.mockResolvedValue(undefined);
      mockSessionService.findById.mockResolvedValue(mockSession);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
    });

    describe('Successful logout', () => {
      it('should revoke session on logout', async () => {
        await service.logout(createLogoutDto({ sub: mockSub }));

        expect(mockSessionService.revokeSession).toHaveBeenCalledWith(1, 'User logout', undefined);
      });

      it('should revoke session with audit metadata', async () => {
        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: false }));

        expect(mockSessionService.revokeSession).toHaveBeenCalledWith(1, 'User logout', undefined);
      });

      it('should complete logout successfully', async () => {
        await service.logout(createLogoutDto({ sub: mockSub }));

        expect(mockSessionService.revokeSession).toHaveBeenCalled();
      });
    });

    describe('Idempotent logout (no active session)', () => {
      it('should not throw when sessionId is missing and should return success', async () => {
        mockClientInfo.sessionId = undefined;

        const result = await service.logout(createLogoutDto({ sub: mockSub }));

        expect(result).toEqual({ success: true });
        expect(mockSessionService.revokeSession).not.toHaveBeenCalled();
      });

      it('should clear auth cookies when sessionId is missing in cookie delivery modes', async () => {
        mockClientInfo.sessionId = undefined;
        mockConfig.tokenDelivery = {
          method: 'cookies',
          cookieNamePrefix: 'nauth',
          cookieOptions: { path: '/', secure: true, sameSite: 'strict' },
        } as any;

        const clearCookie = jest.fn();
        mockClientInfoService.getResponse.mockReturnValue({ clearCookie } as any);

        const result = await service.logout(createLogoutDto({ sub: mockSub, forgetMe: true }));

        expect(result).toEqual({ success: true });
        expect(mockSessionService.revokeSession).not.toHaveBeenCalled();
        // Access + refresh cookies must be cleared; device cookie cleared when forgetMe=true
        expect(clearCookie).toHaveBeenCalledWith('nauth_access_token', expect.anything());
        expect(clearCookie).toHaveBeenCalledWith('nauth_refresh_token', expect.anything());
        expect(clearCookie).toHaveBeenCalledWith('nauth_device_token', expect.anything());
      });
    });

    describe('Forget device (forgetMe)', () => {
      it('should revoke trusted device when forgetMe is true', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        mockClientInfo.deviceToken = 'device-token-123';

        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: true }));

        expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
          1,
          'User logout',
          (expect as any).objectContaining({
            deviceForgotten: true,
            reason: 'User requested device to be forgotten on logout',
          }),
        );
        expect(mockSessionService.findById).toHaveBeenCalledWith(parseInt(mockSessionId, 10));
        expect(mockTrustedDeviceService.revokeTrustedDevice).toHaveBeenCalledWith(
          mockClientInfo.deviceToken,
          mockSession.userId,
        );
      });

      it('should not revoke trusted device when forgetMe is false', async () => {
        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: false }));

        expect(mockTrustedDeviceService.revokeTrustedDevice).not.toHaveBeenCalled();
      });

      it('should handle missing deviceToken gracefully when forgetMe is true', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        mockClientInfo.deviceToken = undefined;

        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: true }));

        // Should still revoke session, but not call revokeTrustedDevice
        expect(mockSessionService.revokeSession).toHaveBeenCalled();
        expect(mockTrustedDeviceService.revokeTrustedDevice).not.toHaveBeenCalled();
      });

      it('should record DEVICE_UNTRUSTED audit event when forgetMe is true', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        mockClientInfo.deviceToken = 'device-token-123';

        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: true }));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.DEVICE_UNTRUSTED,
            eventStatus: 'SUCCESS',
          }),
        );
      });
    });

    describe('Error handling', () => {
      it('should handle session revocation errors gracefully', async () => {
        mockSessionService.revokeSession.mockRejectedValue(new Error('Session not found'));

        try {
          await service.logout(createLogoutDto({ sub: mockSub }));
          fail('Should have thrown Error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should handle trusted device removal errors gracefully', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        mockClientInfo.deviceToken = 'device-token-123';
        (mockTrustedDeviceService.revokeTrustedDevice as jest.Mock).mockRejectedValue(new Error('Device not found'));

        // Should still complete logout even if device removal fails
        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: true }));

        expect(mockSessionService.revokeSession).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it('should handle audit logging errors gracefully when forgetMe is true', async () => {
        mockConfig.mfa = {
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };
        mockClientInfo.deviceToken = 'device-token-123';
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        await service.logout(createLogoutDto({ sub: mockSub, forgetMe: true }));

        // Should still complete logout despite audit error
        expect(mockSessionService.revokeSession).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // logoutAll Tests
  // ============================================================================

  describe('logoutAll()', () => {
    const mockSub = 'user-123';
    const mockUserId = 1;

    beforeEach(() => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, id: mockUserId } as any);
      mockSessionService.revokeAllUserSessions.mockResolvedValue(5);
    });

    describe('Successful logout all', () => {
      it('should revoke all user sessions', async () => {
        await service.logoutAll(createLogoutAllDto({ sub: mockSub }));

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({
          where: { sub: mockSub } as any,
        });
        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(mockUserId, 'Global signout');
      });

      it('should return number of revoked sessions', async () => {
        const result = await service.logoutAll(createLogoutAllDto({ sub: mockSub }));

        expect(result.revokedCount).toBe(5);
      });

      it('should complete logoutAll successfully', async () => {
        const result = await service.logoutAll(createLogoutAllDto({ sub: mockSub }));

        expect(result.revokedCount).toBe(5);
        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalled();
      });
    });

    describe('User not found', () => {
      it('should throw NAuthException if user not found', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);

        try {
          await service.logoutAll(createLogoutAllDto({ sub: mockSub }));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });
    });

    describe('Error handling', () => {
      it('should handle session revocation errors gracefully', async () => {
        mockSessionService.revokeAllUserSessions.mockRejectedValue(new Error('Database error'));

        try {
          await service.logoutAll(createLogoutAllDto({ sub: mockSub }));
          fail('Should have thrown Error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should complete logoutAll even if errors occur', async () => {
        // logoutAll doesn't directly record audit events, so this test just verifies it completes
        const result = await service.logoutAll(createLogoutAllDto({ sub: mockSub }));

        expect(result.revokedCount).toBe(5);
      });
    });
  });

  // ============================================================================
  // changePassword Tests
  // ============================================================================

  describe('changePassword()', () => {
    const changePasswordDto = {
      oldPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    };

    let userBySub: IUser;
    let userById: IUser;

    beforeEach(() => {
      // IMPORTANT: use fresh objects for each test to avoid cross-test mutation
      userBySub = { ...mockUser, passwordHash: 'hashed-password', passwordHistory: [] };
      userById = { ...mockUser, passwordHash: 'hashed-password', passwordHistory: [] };

      // AuthService.changePassword performs two lookups:
      // 1) by sub
      // 2) by internal id (inside updateUserPassword)
      mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
        const where = (args as { where?: Record<string, unknown> } | undefined)?.where || {};
        if (where.sub === userBySub.sub) {
          return userBySub as any;
        }
        if (where.id === userById.id) {
          return userById as any;
        }
        return null as any;
      });
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true } as any);
      mockPasswordService.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordService.hashPassword.mockResolvedValue('new-hashed-password');
      mockPasswordService.addToHistory.mockReturnValue([]);
      mockUserRepository.save.mockResolvedValue(userById as any);
    });

    describe('Successful password change', () => {
      it('should change password successfully', async () => {
        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockPasswordService.verifyPassword).toHaveBeenCalledWith(
          changePasswordDto.oldPassword,
          'hashed-password',
        );
        expect(mockPasswordService.validatePassword).toHaveBeenCalledWith(changePasswordDto.newPassword, {
          email: mockUser.email,
          username: mockUser.username || undefined,
        });
        expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(changePasswordDto.newPassword);
        expect(mockUserRepository.save).toHaveBeenCalled();
      });

      it('should update password hash in database', async () => {
        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockUserRepository.save).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            passwordHash: 'new-hashed-password',
            passwordChangedAt: (expect as any).any(Date),
            passwordHistory: (expect as any).any(Array),
          }),
        );
      });

      it('should add old password to history', async () => {
        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockPasswordService.addToHistory).toHaveBeenCalledWith([], 'hashed-password');
        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id, 'Password changed');
      });

      it('should revoke all sessions after password change', async () => {
        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id, 'Password changed');
      });

      it('should record PASSWORD_CHANGED audit event', async () => {
        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.PASSWORD_CHANGED,
            eventStatus: 'SUCCESS',
          }),
        );
      });
    });

    describe('Password validation', () => {
      it('should throw NAuthException if current password is incorrect', async () => {
        mockPasswordService.verifyPassword.mockResolvedValue(false);

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PASSWORD_INCORRECT);
        }
      });

      it('should throw NAuthException if new password is invalid', async () => {
        mockPasswordService.validatePassword.mockResolvedValue({
          valid: false,
          errors: ['Password too weak'],
        } as any);

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          // Password validation happens in handleForceChangePassword, which throws WEAK_PASSWORD
          // But validation might happen earlier in validateChallengeParams
          expect([AuthErrorCode.WEAK_PASSWORD, AuthErrorCode.VALIDATION_FAILED]).toContain(error.code);
        }
      });

      it('should allow password change even if hash matches (service does not prevent same password)', async () => {
        mockPasswordService.verifyPassword.mockResolvedValue(true);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true } as any);
        // Simulate same password by making hash match - service doesn't prevent this
        mockPasswordService.hashPassword.mockResolvedValue('hashed-password');

        // Service doesn't check if new hash equals old hash, so this should succeed
        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockUserRepository.save).toHaveBeenCalled();
      });

      it('should throw NAuthException if new password is in history', async () => {
        mockPasswordService.isPasswordInHistory.mockResolvedValue(true);

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PASSWORD_REUSED);
        }
      });
    });

    describe('User not found', () => {
      it('should throw NAuthException if user not found', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });
    });

    describe('Social-only users', () => {
      it('should throw NAuthException if user has no password (social-only)', async () => {
        const socialUser = { ...mockUser, passwordHash: null };
        mockUserRepository.findOne.mockResolvedValue(socialUser as any);

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });
    });

    describe('Password history management', () => {
      it('should check password history when historyCount is configured', async () => {
        mockConfig.password!.historyCount = 10;
        const userWithHistory = { ...mockUser, passwordHash: 'hashed-password', passwordHistory: ['hash1', 'hash2'] };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithHistory as any)
          .mockResolvedValueOnce({ ...userWithHistory } as any);

        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockPasswordService.isPasswordInHistory).toHaveBeenCalledWith(changePasswordDto.newPassword, [
          'hashed-password',
          'hash1',
          'hash2',
        ]);
      });

      it('should handle empty password history', async () => {
        const userWithNoHistory = { ...mockUser, passwordHistory: [] };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithNoHistory as any)
          .mockResolvedValueOnce({ ...userWithNoHistory } as any);

        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockPasswordService.addToHistory).toHaveBeenCalledWith([], 'hashed-password');
      });
    });

    describe('Error handling', () => {
      it('should handle database update errors gracefully', async () => {
        mockUserRepository.save.mockRejectedValue(new Error('Database error'));

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown Error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should handle audit logging errors gracefully', async () => {
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        // Should still complete password change despite audit error
        expect(mockUserRepository.save).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle null passwordHash gracefully', async () => {
        const userWithNullHash = { ...mockUser, passwordHash: null };
        mockUserRepository.findOne.mockResolvedValue(userWithNullHash as any);

        try {
          await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
        }
      });

      it('should handle missing password history gracefully', async () => {
        const userWithNoHistory = { ...mockUser, passwordHistory: null };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithNoHistory as any)
          .mockResolvedValueOnce({ ...userWithNoHistory } as any);

        await service.changePassword(createChangePasswordRequestDto(mockUser.sub, changePasswordDto));

        expect(mockPasswordService.addToHistory).toHaveBeenCalledWith([], 'hashed-password');
      });
    });
  });

  // ============================================================================
  // adminSetPassword Tests
  // ============================================================================

  describe('adminSetPassword()', () => {
    const adminSetPasswordDto = {
      identifier: 'test@example.com',
      newPassword: 'NewSecurePassword123!',
      mustChangePassword: true,
      revokeSessions: true,
    };

    beforeEach(() => {
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('new-hashed-password');
      mockPasswordService.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordService.addToHistory.mockReturnValue(['old-hash']);
      mockSessionService.revokeAllUserSessions.mockResolvedValue(3);
      mockUserRepository.save.mockResolvedValue(mockUser as any);
    });

    describe('Successful password reset', () => {
      it('should successfully reset password with valid identifier (email)', async () => {
        // WHY: adminSetPassword first checks by sub (UUID), then calls updateUserPassword()
        // which loads the full entity by internal ID. Ensure the ID lookup returns the user.
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        const result = await service.adminSetPassword(adminSetPasswordDto);

        expect(mockPasswordService.validatePassword).toHaveBeenCalledWith(adminSetPasswordDto.newPassword, {
          email: mockUser.email,
          username: mockUser.username,
        });
        expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(adminSetPasswordDto.newPassword);
        expect(mockUserRepository.save).toHaveBeenCalled();
        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(
          mockUser.id,
          'Password reset by administrator',
        );
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: AuthAuditEventType.PASSWORD_RESET_COMPLETED,
            eventStatus: 'SUCCESS',
            reason: 'admin_reset',
          }),
        );
        expect(result.success).toBe(true);
        expect(result.mustChangePassword).toBe(true);
        expect(result.sessionsRevoked).toBe(3);
      });

      it('should successfully reset password by UUID sub', async () => {
        const uuidIdentifier = 'a21b654c-2746-4168-acee-c175083a65cd';
        mockUserRepository.findOne.mockResolvedValue(mockUser as any);

        const result = await service.adminSetPassword({
          ...adminSetPasswordDto,
          identifier: uuidIdentifier,
        });

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({
          where: { sub: uuidIdentifier },
        });
        expect(result.success).toBe(true);
      });

      it('should successfully reset password by username', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        const result = await service.adminSetPassword({
          ...adminSetPasswordDto,
          identifier: 'testuser',
        });

        expect(result.success).toBe(true);
      });

      it('should successfully reset password by phone', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890' };
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return userWithPhone as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(userWithPhone as any),
        })) as any;

        const result = await service.adminSetPassword({
          ...adminSetPasswordDto,
          identifier: '+1234567890',
        });

        expect(result.success).toBe(true);
      });

      it('should set mustChangePassword flag correctly (true by default)', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        const dtoWithoutFlag = {
          identifier: 'test@example.com',
          newPassword: 'NewSecurePassword123!',
        };

        const result = await service.adminSetPassword(dtoWithoutFlag);

        expect(mockUserRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            mustChangePassword: true,
          }),
        );
        expect(result.mustChangePassword).toBe(true);
      });

      it('should respect mustChangePassword: false option', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        const result = await service.adminSetPassword({
          ...adminSetPasswordDto,
          mustChangePassword: false,
        });

        expect(mockUserRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            mustChangePassword: false,
          }),
        );
        expect(result.mustChangePassword).toBe(false);
      });

      it('should revoke sessions by default', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        const dtoWithoutRevoke = {
          identifier: 'test@example.com',
          newPassword: 'NewSecurePassword123!',
        };

        await service.adminSetPassword(dtoWithoutRevoke);

        expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalled();
      });

      it('should respect revokeSessions: false option', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        const result = await service.adminSetPassword({
          ...adminSetPasswordDto,
          revokeSessions: false,
        });

        expect(mockSessionService.revokeAllUserSessions).not.toHaveBeenCalled();
        expect(result.sessionsRevoked).toBe(0);
      });

      it('should update password history correctly', async () => {
        const userWithHistory = { ...mockUser, passwordHistory: ['hash1', 'hash2'] };
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return userWithHistory as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(userWithHistory as any),
        })) as any;

        await service.adminSetPassword(adminSetPasswordDto);

        expect(mockPasswordService.addToHistory).toHaveBeenCalledWith(['hash1', 'hash2'], mockUser.passwordHash);
      });
    });

    describe('Error handling', () => {
      it('should throw NOT_FOUND for non-existent user', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        })) as any;

        try {
          await service.adminSetPassword(adminSetPasswordDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });

      it('should allow admin to set first password for social-only users', async () => {
        const socialOnlyUser = { ...mockUser, passwordHash: null, passwordHistory: null };
        // updateUserPassword() loads the full entity by internal ID.
        mockUserRepository.findOne.mockResolvedValue(socialOnlyUser as any);
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(socialOnlyUser as any),
        })) as any;

        const result = await service.adminSetPassword(adminSetPasswordDto);

        expect(result.success).toBe(true);
        expect(result.mustChangePassword).toBe(true);
        expect(result.sessionsRevoked).toBe(3);
      });

      it('should throw WEAK_PASSWORD for invalid passwords', async () => {
        // Mock user lookup by identifier (email/username/phone) - adminSetPassword uses findUserByIdentifier
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          // Handle lookup by sub (UUID)
          if (
            where &&
            typeof where === 'object' &&
            (where as { sub?: unknown }).sub === adminSetPasswordDto.identifier
          ) {
            return mockUser as any;
          }
          // Handle lookup by id (for updateUserPassword internal call)
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        // Mock findUserByIdentifier (uses createQueryBuilder)
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;
        mockPasswordService.validatePassword.mockResolvedValue({
          valid: false,
          errors: ['Password too weak', 'Missing uppercase'],
        });

        try {
          await service.adminSetPassword(adminSetPasswordDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.WEAK_PASSWORD);
          // NAuthException uses 'details' not 'metadata'
          expect(error.details?.errors).toEqual(['Password too weak', 'Missing uppercase']);
        }
      });

      it('should throw PASSWORD_REUSED when password in history', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;
        mockPasswordService.isPasswordInHistory.mockResolvedValue(true);

        try {
          await service.adminSetPassword(adminSetPasswordDto);
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PASSWORD_REUSED);
        }
      });

      it('should record audit event with correct metadata', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;

        await service.adminSetPassword(adminSetPasswordDto);

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.PASSWORD_RESET_COMPLETED,
            eventStatus: 'SUCCESS',
            reason: 'admin_reset',
            description: 'Password reset by administrator',
            metadata: expect.objectContaining({
              identifier: adminSetPasswordDto.identifier,
              mustChangePassword: true,
              wasSocialOnly: false,
              sessionsRevoked: 3,
            }),
          }),
        );
      });

      it('should handle audit service errors gracefully', async () => {
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockUserRepository.createQueryBuilder = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser as any),
        })) as any;
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit service error'));

        // Should not throw, just log error
        const result = await service.adminSetPassword(adminSetPasswordDto);

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // updateUserAttributes Tests
  // ============================================================================

  describe('updateUserAttributes()', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
      email: 'updated@example.com',
    };

    beforeEach(() => {
      // Setup default mock chain: initial lookup, uniqueness checks, final fetch
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // Initial user lookup
        .mockResolvedValueOnce(null) // Email uniqueness check (if email in updateData)
        .mockResolvedValueOnce(null) // Phone uniqueness check (if phone in updateData)
        .mockResolvedValueOnce(null) // Username uniqueness check (if username in updateData)
        .mockResolvedValueOnce({ ...mockUser, ...updateData } as any); // Final fetch after update (by id)
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
    });

    describe('Successful updates', () => {
      it('should update user attributes successfully', async () => {
        // Reset and setup mocks for this test
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
          .mockResolvedValueOnce(null) // Email uniqueness check
          .mockResolvedValueOnce({ ...mockUser, ...updateData } as any); // Final fetch by id

        const result = await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, updateData));

        expect(mockUserRepository.findOne).toHaveBeenCalledWith({
          where: { sub: mockUser.sub } as any,
        });
        expect(mockUserRepository.update).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should update firstName and lastName', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any)
          .mockResolvedValueOnce({ ...mockUser, firstName: 'John', lastName: 'Doe' } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            firstName: 'John',
            lastName: 'Doe',
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            firstName: 'John',
            lastName: 'Doe',
          }),
        );
      });

      it('should update username', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any)
          .mockResolvedValueOnce(null) // Username uniqueness check
          .mockResolvedValueOnce({ ...mockUser, username: 'newusername' } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { username: 'newusername' }));

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            username: 'newusername',
          }),
        );
      });

      it('should update email and reset verification status', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any)
          .mockResolvedValueOnce(null) // Email uniqueness check
          .mockResolvedValueOnce({ ...mockUser, email: 'newemail@example.com', isEmailVerified: false } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, { email: 'newemail@example.com' }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            email: 'newemail@example.com',
            isEmailVerified: false,
          }),
        );
      });

      it('should update phone and reset verification status', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any)
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...mockUser, phone: '+1987654321', isPhoneVerified: false } as any);
        mockMfaDeviceRepository.find.mockResolvedValue([]);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321' }));

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            phone: '+1987654321',
            isPhoneVerified: false,
          }),
        );
      });

      it('should retain verification status when retainVerification is true', async () => {
        const verifiedUser = { ...mockUser, isEmailVerified: true, isPhoneVerified: true };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(verifiedUser as any) // Initial lookup by sub
          .mockResolvedValueOnce(null) // Email uniqueness check
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...verifiedUser, email: 'newemail@example.com', phone: '+1987654321' } as any); // Final fetch by id
        mockMfaDeviceRepository.find.mockResolvedValue([]);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            email: 'newemail@example.com',
            phone: '+1987654321',
            retainVerification: true,
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            email: 'newemail@example.com',
            phone: '+1987654321',
            isEmailVerified: true,
            isPhoneVerified: true,
          }),
        );
      });

      it('should preserve unverified status when retainVerification is true', async () => {
        const unverifiedUser = { ...mockUser, isEmailVerified: false, isPhoneVerified: false };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(unverifiedUser as any) // Initial lookup by sub
          .mockResolvedValueOnce(null) // Email uniqueness check
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...unverifiedUser, email: 'newemail@example.com', phone: '+1987654321' } as any); // Final fetch by id
        mockMfaDeviceRepository.find.mockResolvedValue([]);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            email: 'newemail@example.com',
            phone: '+1987654321',
            retainVerification: true,
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            email: 'newemail@example.com',
            phone: '+1987654321',
            isEmailVerified: false,
            isPhoneVerified: false,
          }),
        );
      });

      it('should merge metadata when updating', async () => {
        const userWithMetadata = { ...mockUser, metadata: { key1: 'value1' } };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMetadata as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithMetadata, metadata: { key1: 'value1', key2: 'value2' } } as any); // Final fetch by id

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, { metadata: { key2: 'value2' } }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            metadata: (expect as any).objectContaining({
              key1: 'value1',
              key2: 'value2',
            }),
          }),
        );
      });

      it('should record PROFILE_UPDATED audit event', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any)
          .mockResolvedValueOnce(null) // Email uniqueness check
          .mockResolvedValueOnce({ ...mockUser, ...updateData } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, updateData));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.PROFILE_UPDATED,
            eventStatus: 'INFO',
          }),
        );
      });
    });

    describe('MFA device management', () => {
      it('should delete Email MFA devices when email changes', async () => {
        const userWithEmail = { ...mockUser, email: 'old@example.com' };
        const emailDevice = {
          id: 1,
          userId: mockUser.id,
          type: MFAMethod.EMAIL,
          isActive: true,
        };

        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithEmail as any) // Initial lookup
          .mockResolvedValueOnce(null) // Email uniqueness check
          .mockResolvedValueOnce({ ...userWithEmail, email: 'new@example.com' } as any); // Final fetch

        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([emailDevice] as any) // Find Email devices
          .mockResolvedValueOnce([emailDevice] as any); // Check remaining devices

        mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { email: 'new@example.com' }));

        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(1);
      });

      it('should record audit event when Email MFA devices are deleted', async () => {
        const userWithEmail = { ...mockUser, email: 'old@example.com' };
        const emailDevice = {
          id: 1,
          userId: mockUser.id,
          type: MFAMethod.EMAIL,
          isActive: true,
        };

        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithEmail as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...userWithEmail, email: 'new@example.com' } as any);

        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([emailDevice] as any)
          .mockResolvedValueOnce([emailDevice] as any);

        mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { email: 'new@example.com' }));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
            eventStatus: 'INFO',
            reason: 'email_changed',
            metadata: (expect as any).objectContaining({
              method: MFAMethod.EMAIL,
              deletedCount: 1,
              oldEmail: 'old@example.com',
              newEmail: 'new@example.com',
            }),
          }),
        );
      });

      it('should delete SMS MFA devices when phone changes', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890' };
        const smsDevice = {
          id: 1,
          userId: mockUser.id,
          type: MFAMethod.SMS,
          phoneNumber: '+1234567890',
          isActive: true,
        };

        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...userWithPhone, phone: '+1987654321' } as any); // Final fetch

        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([smsDevice] as any) // Find SMS devices
          .mockResolvedValueOnce([smsDevice] as any); // Check remaining devices

        mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321' }));

        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(1);
      });

      it('should record audit event when SMS MFA devices are deleted', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890' };
        const smsDevice = {
          id: 1,
          userId: mockUser.id,
          type: MFAMethod.SMS,
          phoneNumber: '+1234567890',
          isActive: true,
        };

        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...userWithPhone, phone: '+1987654321' } as any);

        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([smsDevice] as any)
          .mockResolvedValueOnce([smsDevice] as any);

        mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321' }));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
            eventStatus: 'INFO',
            reason: 'phone_changed',
            metadata: (expect as any).objectContaining({
              method: MFAMethod.SMS,
              deletedCount: 1,
              oldPhone: '+1234567890',
              newPhone: '+1987654321',
            }),
          }),
        );
      });

      it('should disable MFA when all devices are removed after email change', async () => {
        const userWithMfa = { ...mockUser, email: 'old@example.com', mfaEnabled: true };
        const emailDevice = {
          id: 1,
          userId: mockUser.id,
          type: MFAMethod.EMAIL,
          isActive: true,
        };

        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMfa as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...userWithMfa, email: 'new@example.com', mfaEnabled: false } as any);

        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([emailDevice] as any) // Find Email devices
          .mockResolvedValueOnce([] as any); // No remaining devices

        mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { email: 'new@example.com' }));

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            email: 'new@example.com',
            mfaEnabled: false,
            mfaMethods: [],
            preferredMfaMethod: null,
          }),
        );
      });

      it('should disable MFA when all devices are removed after phone change', async () => {
        const userWithMfa = { ...mockUser, phone: '+1234567890', mfaEnabled: true };
        const smsDevice = {
          id: 1,
          userId: mockUser.id,
          type: MFAMethod.SMS,
          phoneNumber: '+1234567890',
          isActive: true,
        };

        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMfa as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...userWithMfa, phone: '+1987654321', mfaEnabled: false } as any);

        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([smsDevice] as any) // Find SMS devices
          .mockResolvedValueOnce([] as any); // No remaining devices

        mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321' }));

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            phone: '+1987654321',
            mfaEnabled: false,
            mfaMethods: [],
            preferredMfaMethod: null,
          }),
        );
      });
    });

    describe('Uniqueness constraints', () => {
      it('should throw NAuthException if email already exists', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any) // First call for user lookup by sub
          .mockResolvedValueOnce({ id: 999 } as any); // Second call for email uniqueness check

        try {
          await service.updateUserAttributes(
            createUpdateUserAttributesDto(mockUser.sub, { email: 'existing@example.com' }),
          );
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
        }
      });

      it('should throw NAuthException if phone already exists', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any) // First call for user lookup by sub
          .mockResolvedValueOnce({ id: 999 } as any); // Second call for phone uniqueness check

        try {
          await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1234567890' }));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
        }
      });

      it('should throw NAuthException if username already exists', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any) // First call for user lookup by sub
          .mockResolvedValueOnce({ id: 999 } as any); // Second call for username uniqueness check

        try {
          await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { username: 'existinguser' }));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
        }
      });

      it('should allow updating to same email', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any) // First call for user lookup by sub
          .mockResolvedValueOnce(null) // Email uniqueness check (not found = OK, because it's the same user)
          .mockResolvedValueOnce(mockUser as any); // Final fetch by id

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { email: mockUser.email }));

        expect(mockUserRepository.update).toHaveBeenCalled();
      });
    });

    describe('User not found', () => {
      it('should throw NAuthException if user not found', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);

        try {
          await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, updateData));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });
    });

    describe('MFA device management', () => {
      it('should deactivate SMS MFA devices when phone changes', async () => {
        const oldPhone = '+1234567890';
        const userWithPhone = { ...mockUser, phone: oldPhone };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup by sub
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...userWithPhone, phone: '+1987654321' } as any); // Final fetch by id
        mockMfaDeviceRepository.find.mockResolvedValue([
          { id: 1, type: MFAMethod.SMS, phoneNumber: oldPhone, isActive: true },
        ] as any);
        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([{ id: 1, type: MFAMethod.SMS, phoneNumber: oldPhone, isActive: true }] as any)
          .mockResolvedValueOnce([] as any); // Check for remaining active devices
        mockMfaDeviceRepository.update.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321' }));

        expect(mockMfaDeviceRepository.find).toHaveBeenCalled();
        // Code uses delete() not update() for SMS MFA devices
        expect(mockMfaDeviceRepository.delete).toHaveBeenCalled();
      });

      it('should not deactivate SMS devices if phone unchanged', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890' };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup
          .mockResolvedValueOnce(userWithPhone as any); // Final fetch

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { firstName: 'New' }));

        expect(mockMfaDeviceRepository.find).not.toHaveBeenCalled();
      });

      it('should deactivate SMS MFA devices when phone changes even if retainVerification is true', async () => {
        const oldPhone = '+1234567890';
        const userWithPhone = { ...mockUser, phone: oldPhone, isPhoneVerified: true };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...userWithPhone, phone: '+1987654321' } as any); // Final fetch
        mockMfaDeviceRepository.find
          .mockResolvedValueOnce([{ id: 1, type: MFAMethod.SMS, phoneNumber: oldPhone, isActive: true }] as any) // Find SMS devices with old phone
          .mockResolvedValueOnce([] as any); // Check for remaining active devices
        mockMfaDeviceRepository.update.mockResolvedValue({ affected: 1 } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321', retainVerification: true }),
        );

        // Should preserve verification status
        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            phone: '+1987654321',
            isPhoneVerified: true, // Preserved because retainVerification is true
          }),
        );

        // Should still delete MFA devices regardless of retainVerification (code uses delete, not update)
        expect(mockMfaDeviceRepository.find).toHaveBeenCalled();
        expect(mockMfaDeviceRepository.delete).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should handle database update errors gracefully', async () => {
        mockUserRepository.update.mockRejectedValue(new Error('Database error'));

        try {
          await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, updateData));
          fail('Should have thrown Error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should handle audit logging errors gracefully', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
          .mockResolvedValueOnce(null) // Uniqueness checks
          .mockResolvedValueOnce({ ...mockUser, ...updateData } as any); // Final fetch by id
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, updateData));

        // Should still complete update despite audit error
        expect(mockUserRepository.update).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should handle MFA device deactivation errors gracefully', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890' };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup by sub
          .mockResolvedValueOnce(null) // Phone uniqueness check
          .mockResolvedValueOnce({ ...userWithPhone, phone: '+1987654321' } as any); // Final fetch by id
        mockMfaDeviceRepository.find.mockRejectedValue(new Error('Database error'));

        // Should still complete update despite MFA device error
        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { phone: '+1987654321' }));

        expect(mockUserRepository.update).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle partial updates (only some fields)', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(mockUser as any)
          .mockResolvedValueOnce({ ...mockUser, firstName: 'NewFirst' } as any);

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { firstName: 'NewFirst' }));

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            firstName: 'NewFirst',
          }),
        );
      });

      it('should handle empty metadata', async () => {
        const userWithMetadata = { ...mockUser, metadata: { key1: 'value1' } };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMetadata as any) // Initial lookup by sub
          .mockResolvedValueOnce(userWithMetadata as any); // Final fetch by id

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { metadata: {} }));

        expect(mockUserRepository.update).toHaveBeenCalled();
      });

      it('should handle null metadata', async () => {
        const userWithNullMetadata = { ...mockUser, metadata: null };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithNullMetadata as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithNullMetadata, metadata: { key: 'value' } } as any); // Final fetch by id

        await service.updateUserAttributes(createUpdateUserAttributesDto(mockUser.sub, { metadata: { key: 'value' } }));

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            metadata: (expect as any).objectContaining({
              key: 'value',
            }),
          }),
        );
      });

      it('should merge new metadata with existing metadata', async () => {
        const userWithMetadata = { ...mockUser, metadata: { existing: 'value1', keep: 'value2' } };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMetadata as any)
          .mockResolvedValueOnce({ ...userWithMetadata, metadata: { existing: 'updated', keep: 'value2', new: 'value3' } } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            metadata: { existing: 'updated', new: 'value3' },
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            metadata: {
              existing: 'updated',
              keep: 'value2',
              new: 'value3',
            },
          }),
        );
      });

      it('should delete metadata keys when set to null', async () => {
        const userWithMetadata = { ...mockUser, metadata: { key1: 'value1', key2: 'value2', key3: 'value3' } };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMetadata as any)
          .mockResolvedValueOnce({ ...userWithMetadata, metadata: { key2: 'value2' } } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            metadata: { key1: null, key3: null },
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            metadata: {
              key2: 'value2',
              // key1 and key3 should be deleted
            },
          }),
        );

        const updateCall = mockUserRepository.update.mock.calls[0][1] as any;
        expect(updateCall.metadata).not.toHaveProperty('key1');
        expect(updateCall.metadata).not.toHaveProperty('key3');
        expect(updateCall.metadata).toHaveProperty('key2', 'value2');
      });

      it('should allow mixing metadata updates and deletions', async () => {
        const userWithMetadata = { ...mockUser, metadata: { delete: 'old', update: 'old', keep: 'value' } };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMetadata as any)
          .mockResolvedValueOnce({ ...userWithMetadata, metadata: { update: 'new', keep: 'value', add: 'new' } } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            metadata: { delete: null, update: 'new', add: 'new' },
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            metadata: {
              update: 'new',
              keep: 'value',
              add: 'new',
              // 'delete' key should be removed
            },
          }),
        );

        const updateCall = mockUserRepository.update.mock.calls[0][1] as any;
        expect(updateCall.metadata).not.toHaveProperty('delete');
        expect(updateCall.metadata).toHaveProperty('update', 'new');
        expect(updateCall.metadata).toHaveProperty('keep', 'value');
        expect(updateCall.metadata).toHaveProperty('add', 'new');
      });

      it('should handle deleting all metadata keys', async () => {
        const userWithMetadata = { ...mockUser, metadata: { key1: 'value1', key2: 'value2' } };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithMetadata as any)
          .mockResolvedValueOnce({ ...userWithMetadata, metadata: {} } as any);

        await service.updateUserAttributes(
          createUpdateUserAttributesDto(mockUser.sub, {
            metadata: { key1: null, key2: null },
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            metadata: {},
          }),
        );
      });
    });
  });

  // ============================================================================
  // updateVerifiedStatus Tests
  // ============================================================================

  describe('updateVerifiedStatus()', () => {
    beforeEach(() => {
      mockUserRepository.findOne.mockReset();
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
    });

    describe('Successful updates', () => {
      it('should update email verification status to true', async () => {
        const userWithEmail = { ...mockUser, email: 'test@example.com', isEmailVerified: false };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithEmail as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithEmail, isEmailVerified: true } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: true }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isEmailVerified: true,
          }),
        );
        expect(result.isEmailVerified).toBe(true);
      });

      it('should update phone verification status to true', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890', isPhoneVerified: false };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithPhone, isPhoneVerified: true } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isPhoneVerified: true }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isPhoneVerified: true,
          }),
        );
        expect(result.isPhoneVerified).toBe(true);
      });

      it('should update both email and phone verification status', async () => {
        const userWithBoth = {
          ...mockUser,
          email: 'test@example.com',
          phone: '+1234567890',
          isEmailVerified: false,
          isPhoneVerified: false,
        };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithBoth as any) // Initial lookup by sub
          .mockResolvedValueOnce({
            ...userWithBoth,
            isEmailVerified: true,
            isPhoneVerified: true,
          } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, {
            isEmailVerified: true,
            isPhoneVerified: true,
          }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isEmailVerified: true,
            isPhoneVerified: true,
          }),
        );
        expect(result.isEmailVerified).toBe(true);
        expect(result.isPhoneVerified).toBe(true);
      });

      it('should set email verification to false even if email does not exist', async () => {
        const userWithoutEmail = { ...mockUser, email: null, isEmailVerified: true };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithoutEmail as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithoutEmail, isEmailVerified: false } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: false }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isEmailVerified: false,
          }),
        );
        expect(result.isEmailVerified).toBe(false);
      });

      it('should set phone verification to false even if phone does not exist', async () => {
        const userWithoutPhone = { ...mockUser, phone: null, isPhoneVerified: true };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithoutPhone as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithoutPhone, isPhoneVerified: false } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isPhoneVerified: false }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isPhoneVerified: false,
          }),
        );
        expect(result.isPhoneVerified).toBe(false);
      });

      it('should only update email verification when only email is provided', async () => {
        const userWithBoth = {
          ...mockUser,
          email: 'test@example.com',
          phone: '+1234567890',
          isEmailVerified: false,
          isPhoneVerified: true,
        };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithBoth as any) // Initial lookup by sub
          .mockResolvedValueOnce({
            ...userWithBoth,
            isEmailVerified: true,
            // isPhoneVerified should remain true
          } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: true }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isEmailVerified: true,
          }),
        );
        // Should not include isPhoneVerified in update
        expect(mockUserRepository.update).not.toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isPhoneVerified: expect.anything(),
          }),
        );
        expect(result.isEmailVerified).toBe(true);
        expect(result.isPhoneVerified).toBe(true); // Should remain unchanged
      });

      it('should only update phone verification when only phone is provided', async () => {
        const userWithBoth = {
          ...mockUser,
          email: 'test@example.com',
          phone: '+1234567890',
          isEmailVerified: true,
          isPhoneVerified: false,
        };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithBoth as any) // Initial lookup by sub
          .mockResolvedValueOnce({
            ...userWithBoth,
            isPhoneVerified: true,
            // isEmailVerified should remain true
          } as any); // Final fetch by id

        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isPhoneVerified: true }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isPhoneVerified: true,
          }),
        );
        // Should not include isEmailVerified in update
        expect(mockUserRepository.update).not.toHaveBeenCalledWith(
          mockUser.id,
          (expect as any).objectContaining({
            isEmailVerified: expect.anything(),
          }),
        );
        expect(result.isPhoneVerified).toBe(true);
        expect(result.isEmailVerified).toBe(true); // Should remain unchanged
      });

      it('should return current user if no fields provided', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce(mockUser as any); // Initial lookup by sub

        const result = await service.updateVerifiedStatus(createUpdateVerifiedStatusDto(mockUser.sub, {}));

        expect(mockUserRepository.update).not.toHaveBeenCalled();
        expect(result.sub).toBe(mockUser.sub);
      });

      it('should record EMAIL_VERIFIED audit event when email verification is updated', async () => {
        const userWithEmail = { ...mockUser, email: 'test@example.com', isEmailVerified: false };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithEmail as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithEmail, isEmailVerified: true } as any); // Final fetch by id

        await service.updateVerifiedStatus(createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: true }));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.EMAIL_VERIFIED,
            eventStatus: 'SUCCESS',
            reason: 'admin_verification_update',
            metadata: (expect as any).objectContaining({
              previousStatus: false,
              newStatus: true,
              updateMethod: 'admin_direct',
            }),
          }),
        );
      });

      it('should record PHONE_VERIFIED audit event when phone verification is updated', async () => {
        const userWithPhone = { ...mockUser, phone: '+1234567890', isPhoneVerified: false };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithPhone as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithPhone, isPhoneVerified: true } as any); // Final fetch by id

        await service.updateVerifiedStatus(createUpdateVerifiedStatusDto(mockUser.sub, { isPhoneVerified: true }));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.PHONE_VERIFIED,
            eventStatus: 'SUCCESS',
            reason: 'admin_verification_update',
            metadata: (expect as any).objectContaining({
              previousStatus: false,
              newStatus: true,
              updateMethod: 'admin_direct',
            }),
          }),
        );
      });

      it('should record both audit events when both verifications are updated', async () => {
        const userWithBoth = {
          ...mockUser,
          email: 'test@example.com',
          phone: '+1234567890',
          isEmailVerified: false,
          isPhoneVerified: false,
        };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithBoth as any) // Initial lookup by sub
          .mockResolvedValueOnce({
            ...userWithBoth,
            isEmailVerified: true,
            isPhoneVerified: true,
          } as any); // Final fetch by id

        await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, {
            isEmailVerified: true,
            isPhoneVerified: true,
          }),
        );

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.EMAIL_VERIFIED,
          }),
        );
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: AuthAuditEventType.PHONE_VERIFIED,
          }),
        );
      });
    });

    describe('Validation errors', () => {
      it('should throw error when trying to verify email that does not exist', async () => {
        const userWithoutEmail = { ...mockUser, email: null };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne.mockResolvedValueOnce(userWithoutEmail as any); // Initial lookup by sub

        const error = await service
          .updateVerifiedStatus(createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: true }))
          .catch((e) => e);
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toBe('Cannot set email verification to true: user does not have an email address');

        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });

      it('should throw error when trying to verify phone that does not exist', async () => {
        const userWithoutPhone = { ...mockUser, phone: null };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne.mockResolvedValueOnce(userWithoutPhone as any); // Initial lookup by sub

        const error = await service
          .updateVerifiedStatus(createUpdateVerifiedStatusDto(mockUser.sub, { isPhoneVerified: true }))
          .catch((e) => e);
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toBe('Cannot set phone verification to true: user does not have a phone number');

        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });

      it('should throw error when user not found', async () => {
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne.mockResolvedValueOnce(null);

        const error = await service
          .updateVerifiedStatus(createUpdateVerifiedStatusDto('non-existent-sub', { isEmailVerified: true }))
          .catch((e) => e);
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toBe('User not found');

        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should handle audit service errors gracefully', async () => {
        const userWithEmail = { ...mockUser, email: 'test@example.com', isEmailVerified: false };
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithEmail as any) // Initial lookup by sub
          .mockResolvedValueOnce({ ...userWithEmail, isEmailVerified: true } as any); // Final fetch by id
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit service error'));

        // Should not throw, just log error
        const result = await service.updateVerifiedStatus(
          createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: true }),
        );

        expect(result.isEmailVerified).toBe(true);
        expect(mockUserRepository.update).toHaveBeenCalled();
      });

      it('should handle reload failure gracefully', async () => {
        const userWithEmail = { ...mockUser, email: 'test@example.com', isEmailVerified: false };
        mockUserRepository.findOne.mockReset();
        mockUserRepository.findOne
          .mockResolvedValueOnce(userWithEmail as any) // Initial lookup by sub
          .mockResolvedValueOnce(null); // Final fetch by id fails (after update)

        const error = await service
          .updateVerifiedStatus(createUpdateVerifiedStatusDto(mockUser.sub, { isEmailVerified: true }))
          .catch((e) => e);
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toBe('Failed to reload user after update');
      });
    });
  });

  // ============================================================================
  // respondToChallenge - MFA_REQUIRED Tests (formerly verifyMFA)
  // ============================================================================

  describe('respondToChallenge() - MFA_REQUIRED', () => {
    const mockChallengeSession = {
      id: 'challenge-session-123',
      sessionToken: 'challenge-session-123',
      user: mockUser,
      challengeName: AuthChallenge.MFA_REQUIRED,
      metadata: {},
    };

    beforeEach(() => {
      mockChallengeService.validateSession.mockResolvedValue(mockChallengeSession as any);
      mockChallengeService.validateAndConsumeSession.mockResolvedValue(mockChallengeSession as any);
      mockMfaService.verifyCode.mockResolvedValue({ valid: true } as any);
      mockJwtService.generateTokenFamily.mockReturnValue('token-family-123');
      mockJwtService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });
      mockJwtService.hashToken.mockReturnValue('hashed-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 3600 },
      } as any);
      mockJwtService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: { exp: Math.floor(Date.now() / 1000) + 86400 },
      } as any);
      mockSessionService.createSessionAtomic.mockResolvedValue({
        session: mockSession,
        extra: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      } as any);
      mockAccountLockoutStorage.resetFailedAttempts.mockResolvedValue(undefined);
      // Ensure determineAuthResponse returns a proper object (not undefined) for MFA verification
      mockChallengeHelper.determineAuthResponse.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        deviceToken: undefined, // Explicitly set to undefined so code can set it
      } as any);
    });

    describe('Successful MFA verification', () => {
      it('should verify TOTP code successfully', async () => {
        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockChallengeService.validateSession).toHaveBeenCalledWith('challenge-session-123');
        // mfaService.verifyCode is called with an object { sub, methodName, code }
        expect(mockMfaService.verifyCode).toHaveBeenCalledWith({
          sub: mockUser.sub,
          methodName: 'totp',
          code: '123456',
        });
        expect(mockChallengeService.validateAndConsumeSession).toHaveBeenCalledWith(
          'challenge-session-123',
          AuthChallenge.MFA_REQUIRED,
        );
        expect(result).toBeDefined();
        if ('accessToken' in result) {
          expect(result.accessToken).toBe('access-token');
          expect(result.refreshToken).toBe('refresh-token');
        }
      });

      it('should verify SMS code successfully', async () => {
        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'sms',
          code: '123456',
        };
        await service.respondToChallenge(createRespondChallengeDto(response));

        // mfaService.verifyCode is called with an object { sub, methodName, code }
        expect(mockMfaService.verifyCode).toHaveBeenCalledWith({
          sub: mockUser.sub,
          methodName: 'sms',
          code: '123456',
        });
      });

      it('should verify backup code successfully', async () => {
        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'backup',
          code: 'backup123',
        };
        await service.respondToChallenge(createRespondChallengeDto(response));

        // mfaService.verifyCode is called with an object { sub, methodName, code }
        expect(mockMfaService.verifyCode).toHaveBeenCalledWith({
          sub: mockUser.sub,
          methodName: 'backup',
          code: 'backup123',
        });
      });

      it('should verify passkey credential successfully', async () => {
        const credential = { id: 'passkey-id', response: {} };
        const sessionWithPasskey = {
          ...mockChallengeSession,
          metadata: { passkeyChallenge: 'expected-challenge' },
        };
        mockChallengeService.validateSession.mockResolvedValue(sessionWithPasskey as any);
        mockMfaService.verifyCode.mockResolvedValue({ valid: true } as any);

        const response: VerifyMFAPasskeyResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'passkey',
          credential,
        };
        await service.respondToChallenge(createRespondChallengeDto(response));

        // mfaService.verifyCode is called with an object { sub, methodName, code }
        // For passkey, code is the wrapped credential object
        expect(mockMfaService.verifyCode).toHaveBeenCalledWith({
          sub: mockUser.sub,
          methodName: MFAMethod.PASSKEY,
          code: {
            credential,
            expectedChallenge: 'expected-challenge',
          },
        });
      });

      it('should record MFA_VERIFICATION_SUCCESS audit event', async () => {
        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };
        await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
            eventStatus: 'SUCCESS',
            challengeSessionId: 'challenge-session-123',
            authMethod: 'totp',
          }),
        );
      });

      it('should update user last login after successful verification', async () => {
        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };
        await service.respondToChallenge(createRespondChallengeDto(response));

        // Note: User update happens in determineAuthResponse, not directly in MFA verification
        // This test may need adjustment based on actual implementation
        expect(mockChallengeHelper.determineAuthResponse).toHaveBeenCalled();
      });
    });

    describe('Invalid MFA verification', () => {
      it('should throw NAuthException for invalid TOTP code', async () => {
        mockMfaService.verifyCode.mockResolvedValue({ valid: false } as any);

        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
        }
      });

      it('should record MFA_VERIFICATION_FAILED audit event', async () => {
        mockMfaService.verifyCode.mockResolvedValue({ valid: false } as any);

        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
        } catch {
          // Expected to throw
        }

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.MFA_VERIFICATION_FAILED,
            eventStatus: 'FAILURE',
            challengeSessionId: 'challenge-session-123',
            authMethod: 'totp',
          }),
        );
      });

      it('should increment challenge attempts on failure', async () => {
        mockMfaService.verifyCode.mockResolvedValue({ valid: false } as any);

        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
        } catch {
          // Expected to throw
        }

        expect(mockChallengeService.incrementAttempts).toHaveBeenCalled();
      });

      it('should throw NAuthException if code is missing for non-passkey methods', async () => {
        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '', // Empty code
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
        }
      });

      it('should throw NAuthException if credential is missing for passkey', async () => {
        const response: VerifyMFAPasskeyResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'passkey',
          credential: {} as any, // Empty credential - validation will fail
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          // Validation happens in validateChallengeParams which throws VALIDATION_FAILED
          // but empty object might pass validation, so it could throw CHALLENGE_INVALID
          expect([AuthErrorCode.VALIDATION_FAILED, AuthErrorCode.CHALLENGE_INVALID]).toContain(error.code);
        }
      });

      it('should throw NAuthException if passkey challenge is missing in session', async () => {
        const response: VerifyMFAPasskeyResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'passkey',
          credential: { id: 'passkey' },
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.CHALLENGE_INVALID);
        }
      });
    });

    describe('Error handling', () => {
      it('should throw NAuthException if challenge session is invalid', async () => {
        mockChallengeService.validateSession.mockRejectedValue(
          new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'Invalid session'),
        );

        const response: VerifyMFACodeResponse = {
          session: 'invalid-session',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.CHALLENGE_INVALID);
        }
      });

      it('should throw NAuthException if user not found in challenge session', async () => {
        const sessionWithoutUser = { ...mockChallengeSession, user: null };
        mockChallengeService.validateSession.mockResolvedValue(sessionWithoutUser as any);

        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.CHALLENGE_INVALID);
        }
      });

      it('should throw NAuthException if MFA service is not available', async () => {
        const serviceWithoutMfa = new AuthService(
          mockUserRepository,
          mockLoginAttemptRepository,
          mockPasswordService,
          mockJwtService,
          mockSessionService,
          mockChallengeService,
          mockChallengeHelper,
          mockEmailVerificationService,
          mockClientInfoService,
          mockAccountLockoutStorage,
          mockConfig,
          mockLogger,
          mockHookRegistry,
          mockAuditService,
          mockPhoneVerificationService,
          undefined, // No MFA service
          mockMfaDeviceRepository,
          mockTrustedDeviceService,
        );

        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };

        try {
          await serviceWithoutMfa.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.INTERNAL_ERROR);
        }
      });

      it('should handle audit logging errors gracefully', async () => {
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        const response: VerifyMFACodeResponse = {
          session: 'challenge-session-123',
          type: 'MFA_REQUIRED',
          method: 'totp',
          code: '123456',
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        // Should still complete verification despite audit error
        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // trustDevice Tests
  // ============================================================================

  describe('trustDevice()', () => {
    beforeEach(() => {
      mockConfig.mfa = {
        enabled: true,
        enforcement: 'OPTIONAL',
        rememberDevices: 'user_opt_in',
        rememberDeviceDays: 30,
      };
      // trustDevice() reads sessionId from client info context (not from parameters)
      mockClientInfoService.get.mockReturnValue({ ...mockClientInfo, sessionId: mockSession.id });
      mockSessionService.findById.mockResolvedValue(mockSession as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(false);
      mockTrustedDeviceService.createTrustedDevice.mockResolvedValue('device-token-123');
    });

    describe('Successful device trust', () => {
      it('should create trusted device token successfully', async () => {
        const result = await service.trustDevice();

        expect(mockSessionService.findById).toHaveBeenCalledWith(1);
        expect(mockTrustedDeviceService.createTrustedDevice).toHaveBeenCalled();
        expect(result.deviceToken).toBe('device-token-123');
      });

      it('should return existing device token if device already trusted', async () => {
        mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(true);
        // Update mockClientInfoService.get() to return deviceToken
        mockClientInfoService.get.mockReturnValue({
          ...mockClientInfo,
          sessionId: mockSession.id,
          deviceToken: 'existing-token',
        });

        const result = await service.trustDevice();

        expect(result.deviceToken).toBe('existing-token');
        expect(mockTrustedDeviceService.createTrustedDevice).not.toHaveBeenCalled();
      });

      it('should revoke existing untrusted device token before creating new one', async () => {
        mockClientInfo.deviceToken = 'existing-untrusted-token';
        mockTrustedDeviceService.isDeviceTrusted.mockResolvedValue(false);

        await service.trustDevice();

        expect(mockTrustedDeviceService.revokeTrustedDevice).toHaveBeenCalled();
        expect(mockTrustedDeviceService.createTrustedDevice).toHaveBeenCalled();
      });

      it('should record DEVICE_TRUSTED audit event', async () => {
        await service.trustDevice();

        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: mockUser.id,
            eventType: AuthAuditEventType.DEVICE_TRUSTED,
            eventStatus: 'SUCCESS',
            deviceId: 'device-token-123',
            sessionId: mockSession.id,
          }),
        );
      });
    });

    describe('Error handling', () => {
      it('should throw NAuthException if rememberDevices is not user_opt_in', async () => {
        mockConfig.mfa = {
          enabled: true,
          enforcement: 'OPTIONAL',
          rememberDevices: 'always',
          rememberDeviceDays: 30,
        };

        try {
          await service.trustDevice();
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.FORBIDDEN);
        }
      });

      it('should throw NAuthException if trusted device service is not available', async () => {
        const serviceWithoutTrustedDevice = new AuthService(
          mockUserRepository,
          mockLoginAttemptRepository,
          mockPasswordService,
          mockJwtService,
          mockSessionService,
          mockChallengeService,
          mockChallengeHelper,
          mockEmailVerificationService,
          mockClientInfoService,
          mockAccountLockoutStorage,
          mockConfig,
          mockLogger,
          mockHookRegistry,
          mockAuditService,
          mockPhoneVerificationService,
          mockMfaService,
          mockMfaDeviceRepository,
          undefined, // No trusted device service
        );

        try {
          await serviceWithoutTrustedDevice.trustDevice();
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.INTERNAL_ERROR);
        }
      });

      it('should throw NAuthException if session not found', async () => {
        mockSessionService.findById.mockResolvedValue(null);

        try {
          await service.trustDevice();
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
        }
      });

      it('should throw NAuthException if session is revoked', async () => {
        const revokedSession = { ...mockSession, isRevoked: true };
        mockSessionService.findById.mockResolvedValue(revokedSession as any);

        try {
          await service.trustDevice();
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
        }
      });

      it('should throw NAuthException if user not found', async () => {
        mockUserRepository.findOne.mockResolvedValue(null);

        try {
          await service.trustDevice();
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });

      it('should handle audit logging errors gracefully', async () => {
        mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

        const result = await service.trustDevice();

        // Should still complete trust operation despite audit error
        expect(result.deviceToken).toBe('device-token-123');
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // respondToChallenge Tests (formerly completeChallenge)
  // ============================================================================

  describe('respondToChallenge()', () => {
    const mockChallengeSession = {
      id: 'challenge-session-123',
      sessionToken: 'session-token',
      user: mockUser,
      challengeName: AuthChallenge.VERIFY_EMAIL,
      metadata: {},
    };

    beforeEach(() => {
      mockChallengeService.validateSession.mockResolvedValue(mockChallengeSession as any);
      mockChallengeService.validateAndConsumeSession.mockResolvedValue(mockChallengeSession as any);
      // Query builder will be set up in individual tests as needed
      mockChallengeHelper.determineAuthResponse.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
        refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 86400,
        user: {
          sub: 'user-123',
          email: 'test@example.com',
          isEmailVerified: true,
          isPhoneVerified: false,
        },
      });
    });

    describe('VERIFY_EMAIL challenge', () => {
      it('should complete email verification challenge successfully', async () => {
        // Mock findOne to return updated user after verification
        const updatedUser = {
          ...mockUser,
          isEmailVerified: true,
          isPhoneVerified: false,
        };
        mockUserRepository.findOne.mockResolvedValue(updatedUser as any);
        mockEmailVerificationService.verifyEmailWithCode.mockResolvedValue({
          message: 'Email verified successfully. Please log in to continue.',
        });
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        } as any);

        const response: VerifyEmailResponse = {
          session: 'session-token',
          type: 'VERIFY_EMAIL',
          code: '123456',
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockChallengeService.validateSession).toHaveBeenCalledWith('session-token');
        // verifyEmailWithCode is called with a DTO object
        expect(mockEmailVerificationService.verifyEmailWithCode).toHaveBeenCalledWith(
          expect.objectContaining({
            email: mockUser.email,
            code: '123456',
            challengeSessionId: mockChallengeSession.id,
          }),
        );
        expect(mockChallengeService.validateAndConsumeSession).toHaveBeenCalledWith(
          'session-token',
          AuthChallenge.VERIFY_EMAIL,
        );
        expect(mockChallengeHelper.determineAuthResponse).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });

    describe('VERIFY_PHONE challenge', () => {
      it('should complete phone verification challenge successfully', async () => {
        const phoneVerifySession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.VERIFY_PHONE,
          user: { ...mockUser, phone: '+1234567890' }, // User must have phone set
        };
        mockChallengeService.validateSession.mockResolvedValue(phoneVerifySession as any);
        // Mock findOne to return updated user after verification
        const updatedUser = {
          ...mockUser,
          phone: '+1234567890',
          isEmailVerified: true,
          isPhoneVerified: true,
        };
        mockUserRepository.findOne.mockResolvedValue(updatedUser as any);
        mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockResolvedValue({
          message: 'Phone verified successfully. Please log in to continue.',
        });
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        } as any);

        const response: VerifyPhoneResponse = {
          session: 'session-token',
          type: 'VERIFY_PHONE',
          code: '123456',
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockChallengeService.validateSession).toHaveBeenCalledWith('session-token');
        // verifyPhoneWithCodeBySub is called with a DTO object
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalledWith(
          expect.objectContaining({
            sub: mockUser.sub,
            code: '123456',
            challengeSessionId: phoneVerifySession.id,
          }),
        );
        expect(mockChallengeService.validateAndConsumeSession).toHaveBeenCalledWith(
          'session-token',
          AuthChallenge.VERIFY_PHONE,
        );
        expect(result).toBeDefined();
      });

      it('should handle phone collection before verification', async () => {
        const phoneCollectSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.VERIFY_PHONE,
          user: mockUser,
        };
        mockChallengeService.validateSession.mockResolvedValue(phoneCollectSession as any);
        mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
        mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue(undefined as any);
        mockChallengeHelper.createChallengeResponse.mockResolvedValue({
          challengeName: AuthChallenge.VERIFY_PHONE,
          session: 'challenge-session-token',
          challengeParameters: {},
        } as any);

        const response: CollectPhoneResponse = {
          session: 'session-token',
          type: 'VERIFY_PHONE',
          phone: '+1234567890',
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockChallengeService.validateSession).toHaveBeenCalledWith('session-token');
        expect(mockUserRepository.update).toHaveBeenCalledWith({ sub: mockUser.sub }, { phone: '+1234567890' });
        // sendVerificationSMS is called with a DTO object
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
          expect.objectContaining({
            sub: mockUser.sub,
            skipAlreadyVerifiedCheck: false,
            challengeSessionId: phoneCollectSession.id,
          }),
        );
        expect(result.challengeName).toBeDefined();
        expect(result.challengeName).toBe(AuthChallenge.VERIFY_PHONE);
      });

      it('should throw NAuthException for invalid phone format', async () => {
        const phoneCollectSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.VERIFY_PHONE,
          user: mockUser,
        };
        mockChallengeService.validateSession.mockResolvedValue(phoneCollectSession as any);

        const response: CollectPhoneResponse = {
          session: 'session-token',
          type: 'VERIFY_PHONE',
          phone: 'invalid-phone',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          // Phone format validation happens in handleVerifyPhone, which throws INVALID_PHONE_FORMAT
          // But validation might happen earlier in validateChallengeParams
          expect([AuthErrorCode.INVALID_PHONE_FORMAT, AuthErrorCode.VALIDATION_FAILED]).toContain(error.code);
        }
      });
    });

    describe('FORCE_CHANGE_PASSWORD challenge', () => {
      it('should complete password change challenge successfully', async () => {
        const passwordChangeSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.FORCE_CHANGE_PASSWORD,
        };
        mockChallengeService.validateSession.mockResolvedValue(passwordChangeSession as any);
        mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
        mockPasswordService.hashPassword.mockResolvedValue('new-hashed-password');
        mockPasswordService.isPasswordInHistory.mockResolvedValue(false);
        mockPasswordService.addToHistory.mockReturnValue([]);
        // Mock findOne for updateUserPassword internal call (loads full entity by id)
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object') {
            // Return user when looking up by id (for updateUserPassword)
            if ((where as { id?: unknown }).id === mockUser.id) {
              return { ...mockUser, mustChangePassword: true } as any;
            }
            // Return user when looking up by sub (for determineAuthResponse after password change)
            if ((where as { sub?: unknown }).sub === mockUser.sub) {
              return { ...mockUser, mustChangePassword: false } as any;
            }
          }
          return null;
        });
        mockSessionService.revokeAllUserSessions.mockResolvedValue(0);
        mockChallengeHelper.determineAuthResponse.mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        } as any);

        const response: ForceChangePasswordResponse = {
          session: 'session-token',
          type: 'FORCE_CHANGE_PASSWORD',
          newPassword: 'NewPassword123!',
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockChallengeService.validateSession).toHaveBeenCalledWith('session-token');
        expect(mockPasswordService.validatePassword).toHaveBeenCalled();
        expect(mockPasswordService.hashPassword).toHaveBeenCalledWith('NewPassword123!');
        // updateUserPassword uses save() not update()
        expect(mockUserRepository.save).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should throw NAuthException if new password is missing', async () => {
        const passwordChangeSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.FORCE_CHANGE_PASSWORD,
        };
        mockChallengeService.validateSession.mockResolvedValue(passwordChangeSession as any);

        const response: ForceChangePasswordResponse = {
          session: 'session-token',
          type: 'FORCE_CHANGE_PASSWORD',
          newPassword: '', // Empty password
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
        }
      });

      it('should throw NAuthException if new password is weak', async () => {
        const passwordChangeSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.FORCE_CHANGE_PASSWORD,
        };
        mockChallengeService.validateSession.mockResolvedValue(passwordChangeSession as any);
        // Mock user lookup for updateUserPassword (loads full entity by id)
        mockUserRepository.findOne.mockImplementation(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
          if (where && typeof where === 'object' && (where as { id?: unknown }).id === mockUser.id) {
            return mockUser as any;
          }
          return null;
        });
        mockPasswordService.validatePassword.mockResolvedValue({
          valid: false,
          errors: ['Password too weak'],
        });

        const response: ForceChangePasswordResponse = {
          session: 'session-token',
          type: 'FORCE_CHANGE_PASSWORD',
          newPassword: 'weak',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          // Password validation happens in updateUserPassword, which throws WEAK_PASSWORD
          // Note: AuthErrorCode.WEAK_PASSWORD = 'SIGNUP_WEAK_PASSWORD'
          expect(error.code).toBe(AuthErrorCode.WEAK_PASSWORD);
        }
      });
    });

    describe('MFA_SETUP_REQUIRED challenge', () => {
      it('should complete MFA setup challenge successfully', async () => {
        const mfaSetupSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.MFA_SETUP_REQUIRED,
        };
        mockChallengeService.validateSession.mockResolvedValue(mfaSetupSession as any);
        const updatedUser = { ...mockUser, mfaEnabled: true };
        mockUserRepository.findOne.mockResolvedValue(updatedUser as any);

        const response: MFASetupResponse = {
          session: 'session-token',
          type: 'MFA_SETUP_REQUIRED',
          method: 'totp',
          setupData: { code: '123456' },
        };
        const result = await service.respondToChallenge(createRespondChallengeDto(response));

        expect(mockChallengeService.validateSession).toHaveBeenCalledWith('session-token');
        expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: mockUser.sub } });
        expect(mockChallengeHelper.determineAuthResponse).toHaveBeenCalledWith({
          user: updatedUser,
          config: mockConfig,
          deviceToken: mockClientInfo.deviceToken,
          isSocialLogin: false,
          skipMFAVerification: true,
        });
        expect(result).toBeDefined();
      });

      it('should throw NAuthException if user not found after MFA setup', async () => {
        const mfaSetupSession = {
          ...mockChallengeSession,
          challengeName: AuthChallenge.MFA_SETUP_REQUIRED,
        };
        mockChallengeService.validateSession.mockResolvedValue(mfaSetupSession as any);
        mockUserRepository.findOne.mockResolvedValue(null);

        const response: MFASetupResponse = {
          session: 'session-token',
          type: 'MFA_SETUP_REQUIRED',
          method: 'totp',
          setupData: { code: '123456' },
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
        }
      });
    });

    describe('Error handling', () => {
      it('should throw NAuthException if challenge session is invalid', async () => {
        mockChallengeService.validateSession.mockRejectedValue(
          new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'Invalid session'),
        );

        const response: VerifyEmailResponse = {
          session: 'invalid-session',
          type: 'VERIFY_EMAIL',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.CHALLENGE_INVALID);
        }
      });

      it('should throw NAuthException if user not found in challenge session', async () => {
        const sessionWithoutUser = { ...mockChallengeSession, user: null };
        mockChallengeService.validateSession.mockResolvedValue(sessionWithoutUser as any);

        const response: VerifyEmailResponse = {
          session: 'session-token',
          type: 'VERIFY_EMAIL',
          code: '123456',
        };

        try {
          await service.respondToChallenge(createRespondChallengeDto(response));
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.CHALLENGE_INVALID);
        }
      });
    });
  });

  // ============================================================================
  // Admin Signup
  // ============================================================================

  describe('adminSignup()', () => {
    const adminSignupDto: AdminSignupDTO = {
      email: 'admin-created@example.com',
      password: 'AdminPass123!',
      username: 'adminuser',
      firstName: 'Admin',
      lastName: 'User',
    };

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should create user with default values (isEmailVerified: false, isPhoneVerified: false)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      const result = await service.adminSignup(adminSignupDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          email: adminSignupDto.email,
          passwordHash: 'hashed-password',
          isActive: true,
          isEmailVerified: false,
          isPhoneVerified: false,
          mustChangePassword: false,
        }),
      );
      expect(result.user).toBeDefined();
      expect(result.generatedPassword).toBeUndefined();
    });

    it('should override isEmailVerified to true', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email, isEmailVerified: true };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      const result = await service.adminSignup({
        ...adminSignupDto,
        isEmailVerified: true,
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          isEmailVerified: true,
        }),
      );
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('should override isPhoneVerified to true', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email, isPhoneVerified: true };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      const result = await service.adminSignup({
        ...adminSignupDto,
        isPhoneVerified: true,
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          isPhoneVerified: true,
        }),
      );
      expect(result.user.isPhoneVerified).toBe(true);
    });

    it('should set mustChangePassword flag', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email, mustChangePassword: true };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      const result = await service.adminSignup({
        ...adminSignupDto,
        mustChangePassword: true,
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          mustChangePassword: true,
        }),
      );
      // Note: `mustChangePassword` is an internal user flag and is not exposed in UserResponseDto
      expect(result.user).toBeDefined();
    });

    it('should generate password when requested', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockPasswordService.hashPassword.mockResolvedValue('hashed-generated-password');

      const result = await service.adminSignup({
        ...adminSignupDto,
        generatePassword: true,
        password: undefined,
      });

      expect(mockPasswordService.validatePassword).not.toHaveBeenCalled();
      expect(mockPasswordService.hashPassword).toHaveBeenCalled();
      expect(result.generatedPassword).toBeDefined();
      expect(typeof result.generatedPassword).toBe('string');
      expect(result.generatedPassword!.length).toBeGreaterThanOrEqual(16);
    });

    it('should validate duplicate email', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.adminSignup(adminSignupDto);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.EMAIL_EXISTS);
      }
    });

    it('should validate duplicate username', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // Email check passes
        .mockResolvedValueOnce(mockUser as any); // Username check fails

      try {
        await service.adminSignup(adminSignupDto);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.USERNAME_EXISTS);
      }
    });

    it('should validate duplicate phone when duplicates not allowed', async () => {
      mockConfig.signup!.allowDuplicatePhones = false;
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // Email check passes
        .mockResolvedValueOnce(null) // Username check passes
        .mockResolvedValueOnce(mockUser as any); // Phone check fails

      try {
        await service.adminSignup({
          ...adminSignupDto,
          phone: '+1234567890',
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.PHONE_EXISTS);
      }
    });

    it('should validate password policy when password is provided', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({
        valid: false,
        errors: ['Password too weak'],
      });

      try {
        await service.adminSignup(adminSignupDto);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.WEAK_PASSWORD);
      }
    });

    it('should require password when generatePassword is false', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.adminSignup({
          ...adminSignupDto,
          password: undefined,
          generatePassword: false,
        });
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        // DTO validation now catches this before service-level validation
        expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
      }
    });

    it('should record audit event with createdByAdmin flag', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email, id: 999 };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      await service.adminSignup(adminSignupDto);

      expect(mockAuditService?.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 999,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          eventStatus: 'INFO',
          authMethod: 'admin',
          metadata: (expect as any).objectContaining({
            createdByAdmin: true,
            // Note: actual metadata includes more fields (email, username, adminIdentifier, etc.)
            // but we only check for the key fields
          }),
        }),
      );
    });

    it('should generate unique passwords on each call', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      const createdUser1 = { ...mockUser, email: 'user1@example.com' };
      const createdUser2 = { ...mockUser, email: 'user2@example.com' };
      mockUserRepository.create.mockReturnValueOnce(createdUser1 as any).mockReturnValueOnce(createdUser2 as any);
      mockUserRepository.save.mockResolvedValueOnce(createdUser1 as any).mockResolvedValueOnce(createdUser2 as any);
      mockPasswordService.hashPassword
        .mockResolvedValueOnce('hashed-password-1')
        .mockResolvedValueOnce('hashed-password-2');

      const result1 = await service.adminSignup({
        email: 'user1@example.com',
        generatePassword: true,
      });
      const result2 = await service.adminSignup({
        email: 'user2@example.com',
        generatePassword: true,
      });

      expect(result1.generatedPassword).toBeDefined();
      expect(result2.generatedPassword).toBeDefined();
      expect(result1.generatedPassword).not.toBe(result2.generatedPassword);
    });

    it('should skip signup.enabled check', async () => {
      mockConfig.signup!.enabled = false; // Signup disabled
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      // Should not throw even though signup is disabled
      const result = await service.adminSignup(adminSignupDto);

      expect(result.user).toBeDefined();
    });

    it('should not trigger challenge system', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      const result = await service.adminSignup(adminSignupDto);

      // Should return user object, not AuthResponseDTO with challenge
      expect(result.user).toBeDefined();
      expect((result as any).challengeName).toBeUndefined();
      expect((result as any).tokens).toBeUndefined();
      expect(mockChallengeHelper.determineAuthResponse).not.toHaveBeenCalled();
    });

    it('should not send verification emails', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);

      await service.adminSignup({
        ...adminSignupDto,
        isEmailVerified: true,
      });

      // Email verification service should not be called
      expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Admin Social Signup Tests
  // ============================================================================
  describe('adminSignupSocial()', () => {
    const adminSignupSocialDto: AdminSignupSocialDTO = {
      email: 'social-user@example.com',
      provider: 'google',
      providerId: 'google_12345',
      providerEmail: 'user@gmail.com',
      firstName: 'Social',
      lastName: 'User',
      socialMetadata: { sub: 'google_12345', given_name: 'Social' },
    };

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should create social-only user (no password) with passwordHash=null', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email, passwordHash: null, hasSocialAuth: true };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial(adminSignupSocialDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: adminSignupSocialDto.email,
          passwordHash: null, // NULL for social-only users
          passwordChangedAt: null, // Not set for social-only users
          isActive: true,
          isEmailVerified: true, // Always true for social imports
          isPhoneVerified: false,
        }),
      );
      expect(mockSocialAuthService.createOrUpdateSocialAccount).toHaveBeenCalledWith(
        createdUser.id,
        'google',
        'google_12345',
        'user@gmail.com',
        adminSignupSocialDto.socialMetadata,
      );
      expect(result.user).toBeDefined();
      expect(result.socialAccount.provider).toBe('google');
      expect(result.socialAccount.providerId).toBe('google_12345');
    });

    it('should create hybrid user with password', async () => {
      const hybridDto = { ...adminSignupSocialDto, password: 'SecurePass123!' };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: hybridDto.email, passwordHash: 'hashed-password' };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial(hybridDto);

      expect(mockPasswordService.validatePassword).toHaveBeenCalled();
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith('SecurePass123!');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'hashed-password',
          passwordChangedAt: expect.any(Date), // Set for hybrid users
        }),
      );
      expect(result.user).toBeDefined();
    });

    it('should override isEmailVerified to true', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email, isEmailVerified: true };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial({
        ...adminSignupSocialDto,
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isEmailVerified: true,
        }),
      );
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('should override isPhoneVerified to true', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email, isPhoneVerified: true };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial({
        ...adminSignupSocialDto,
        isPhoneVerified: true,
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPhoneVerified: true,
        }),
      );
      expect(result.user.isPhoneVerified).toBe(true);
    });

    it('should throw EMAIL_EXISTS if email already registered', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser); // Email exists

      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow(NAuthException);
      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toMatchObject({
        code: AuthErrorCode.EMAIL_EXISTS,
      });

      // Verify that we checked for email existence
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: adminSignupSocialDto.email },
      });
    });

    it('should throw USERNAME_EXISTS if username already taken', async () => {
      const dtoWithUsername = { ...adminSignupSocialDto, username: 'existinguser' };
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // Email check passes
        .mockResolvedValueOnce(mockUser); // Username exists

      const error = await service.adminSignupSocial(dtoWithUsername).catch((e) => e);

      expect(error).toBeInstanceOf(NAuthException);
      expect(error.code).toBe(AuthErrorCode.USERNAME_EXISTS);
    });

    it('should throw PHONE_EXISTS if phone already registered and duplicates not allowed', async () => {
      const dtoWithPhone = { ...adminSignupSocialDto, phone: '+14155552671' };
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // Email check passes
        .mockResolvedValueOnce(mockUser); // Phone exists

      const error = await service.adminSignupSocial(dtoWithPhone).catch((e) => e);

      expect(error).toBeInstanceOf(NAuthException);
      expect(error.code).toBe(AuthErrorCode.PHONE_EXISTS);
    });

    it('should allow duplicate phones if allowDuplicatePhones is true', async () => {
      const dtoWithPhone = { ...adminSignupSocialDto, phone: '+14155552671' };
      mockConfig.signup = { allowDuplicatePhones: true };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: dtoWithPhone.email, phone: dtoWithPhone.phone };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial(dtoWithPhone);

      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(1); // Only email check, no phone check
      expect(result.user).toBeDefined();
    });

    it('should throw SOCIAL_ACCOUNT_EXISTS if provider+providerId already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue({
        id: 1,
        userId: 999,
        provider: 'google',
        providerId: 'google_12345',
      } as any);

      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow(NAuthException);
      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_ACCOUNT_EXISTS,
      });
    });

    it('should throw SOCIAL_CONFIG_MISSING if SocialAuthService not available', async () => {
      // Create service without SocialAuthService
      const serviceWithoutSocial = new AuthService(
        mockUserRepository,
        mockLoginAttemptRepository,
        mockPasswordService,
        mockJwtService,
        mockSessionService,
        mockChallengeService,
        mockChallengeHelper,
        mockEmailVerificationService,
        mockClientInfoService,
        mockAccountLockoutStorage,
        mockConfig,
        mockLogger,
        mockHookRegistry,
        mockAuditService,
        mockPhoneVerificationService,
        mockMfaService,
        mockMfaDeviceRepository,
        mockTrustedDeviceService,
        undefined, // passwordResetService
        undefined, // socialAuthService - not provided
      );

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(serviceWithoutSocial.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow(NAuthException);
      await expect(serviceWithoutSocial.adminSignupSocial(adminSignupSocialDto)).rejects.toMatchObject({
        code: AuthErrorCode.SOCIAL_CONFIG_MISSING,
      });
    });

    it('should throw WEAK_PASSWORD if password fails validation', async () => {
      const hybridDto = {
        ...adminSignupSocialDto,
        password: 'SecurePass123!', // Use a valid-format password that will pass DTO validation
      };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({
        valid: false,
        errors: ['Password must be at least 8 characters'],
      });

      await expect(service.adminSignupSocial(hybridDto)).rejects.toThrow(NAuthException);
      await expect(service.adminSignupSocial(hybridDto)).rejects.toMatchObject({
        code: AuthErrorCode.WEAK_PASSWORD,
        details: { errors: ['Password must be at least 8 characters'] },
      });
    });

    it('should record audit event with authMethod: admin-social', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email, id: 999 };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      await service.adminSignupSocial(adminSignupSocialDto);

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 999,
          eventType: AuthAuditEventType.ACCOUNT_CREATED,
          authMethod: 'admin-social',
          metadata: expect.objectContaining({
            createdByAdmin: true,
            provider: 'google',
            providerId: 'google_12345',
            hasPassword: false,
            socialImport: true,
          }),
        }),
      );
    });

    it('should handle database constraint violations gracefully', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(social-user@example.com) already exists',
      });

      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow(NAuthException);
      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toMatchObject({
        code: AuthErrorCode.EMAIL_EXISTS,
      });
    });

    it('should handle social account constraint violations', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockRejectedValue({
        code: '23505',
        detail: 'Key (provider, providerId)=(google, google_12345) already exists',
      });

      await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow();
    });

    it('should return social account confirmation in response', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: adminSignupSocialDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial(adminSignupSocialDto);

      expect(result.socialAccount).toEqual({
        provider: 'google',
        providerId: 'google_12345',
        providerEmail: 'user@gmail.com',
      });
    });

    it('should handle providerEmail as null if not provided', async () => {
      const dtoWithoutProviderEmail = { ...adminSignupSocialDto };
      delete (dtoWithoutProviderEmail as any).providerEmail;

      mockUserRepository.findOne.mockResolvedValue(null);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      const createdUser = { ...mockUser, email: dtoWithoutProviderEmail.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.adminSignupSocial(dtoWithoutProviderEmail);

      expect(mockSocialAuthService.createOrUpdateSocialAccount).toHaveBeenCalledWith(
        expect.anything(),
        'google',
        'google_12345',
        null, // providerEmail should be null
        expect.anything(),
      );
      expect(result.socialAccount.providerEmail).toBeNull();
    });

    describe('preSignup hook', () => {
      beforeEach(() => {
        mockUserRepository.findOne.mockResolvedValue(null);
        mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
        const createdUser = { ...mockUser, email: adminSignupSocialDto.email, passwordHash: null, hasSocialAuth: true };
        mockUserRepository.create.mockReturnValue(createdUser as any);
        mockUserRepository.save.mockResolvedValue(createdUser as any);
        mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);
      });

      it('should execute preSignup hook before user creation for admin social signup', async () => {
        mockHookRegistry.executePreSignup.mockResolvedValue(undefined);

        await service.adminSignupSocial(adminSignupSocialDto);

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalledTimes(1);
        expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
          expect.objectContaining({
            email: adminSignupSocialDto.email,
            id: adminSignupSocialDto.providerId,
            firstName: adminSignupSocialDto.firstName,
            lastName: adminSignupSocialDto.lastName,
            verified: true,
          }),
          'social',
          adminSignupSocialDto.provider,
          true, // adminSignup flag
        );
        expect(mockUserRepository.save).toHaveBeenCalled();
      });

      it('should block admin social signup when preSignup hook throws PRESIGNUP_FAILED', async () => {
        const customMessage = 'This email domain is not allowed';
        mockHookRegistry.executePreSignup.mockRejectedValue(
          new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, customMessage),
        );

        await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow(NAuthException);
        await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toMatchObject({
          code: AuthErrorCode.PRESIGNUP_FAILED,
          message: customMessage,
        });

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
        expect(mockUserRepository.save).not.toHaveBeenCalled();
      });

      it('should wrap non-PRESIGNUP_FAILED errors in PRESIGNUP_FAILED for admin social signup', async () => {
        const genericError = new Error('External validation failed');
        // Mock the HookRegistry to throw the wrapped exception (as the real HookRegistry would)
        mockHookRegistry.executePreSignup.mockRejectedValue(
          new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'External validation failed'),
        );

        await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toThrow(NAuthException);
        await expect(service.adminSignupSocial(adminSignupSocialDto)).rejects.toMatchObject({
          code: AuthErrorCode.PRESIGNUP_FAILED,
          message: 'External validation failed',
        });

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
        expect(mockUserRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('adminSignup() preSignup hook', () => {
    const adminSignupDto: AdminSignupDTO = {
      email: 'admin-user@example.com',
      password: 'SecurePassword123!',
      username: 'adminuser',
      isEmailVerified: true,
    };

    beforeEach(() => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockPasswordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
      const createdUser = { ...mockUser, email: adminSignupDto.email };
      mockUserRepository.create.mockReturnValue(createdUser as any);
      mockUserRepository.save.mockResolvedValue(createdUser as any);
    });

    it('should execute preSignup hook with adminSignup=true for admin signup', async () => {
      mockHookRegistry.executePreSignup.mockResolvedValue(undefined);

      await service.adminSignup(adminSignupDto);

      expect(mockHookRegistry.executePreSignup).toHaveBeenCalledTimes(1);
      expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
        expect.objectContaining({
          email: adminSignupDto.email,
          password: adminSignupDto.password,
          username: adminSignupDto.username,
        }),
        'password',
        undefined,
        true, // adminSignup flag
      );
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should block admin signup when preSignup hook throws PRESIGNUP_FAILED', async () => {
      const customMessage = 'This email domain is not allowed for admin signup';
      mockHookRegistry.executePreSignup.mockRejectedValue(
        new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, customMessage),
      );

      try {
        await service.adminSignup(adminSignupDto);
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.PRESIGNUP_FAILED);
        expect(error.message).toBe(customMessage);
      }

      expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
        expect.objectContaining({
          email: adminSignupDto.email,
        }),
        'password',
        undefined,
        true, // adminSignup flag
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });
});
