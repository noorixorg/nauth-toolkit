/**
 * Auth Service Internal Helpers - reCAPTCHA Validation Tests
 *
 * Tests for reCAPTCHA validation methods in AuthServiceInternalHelpers.
 */

import { AuthServiceInternalHelpers } from './auth-service-internal-helpers';
import { Repository } from 'typeorm';
import { BaseUser, BaseLoginAttempt } from '../entities';
import { EmailVerificationService } from './email-verification.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { ClientInfoService } from './client-info.service';
import { SessionService } from './session.service';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { RecaptchaProvider, RecaptchaVerificationResult } from '@nauth-toolkit/recaptcha';
import { NAuthLogger } from '../utils/nauth-logger';
import { HookRegistryService } from './hook-registry.service';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { NAuthException } from '../exceptions/nauth.exception';
import { ContextStorage } from '../utils/context-storage';
import { NAuthRequest } from '../platform/interfaces';

describe('AuthServiceInternalHelpers - reCAPTCHA Validation', () => {
  let helpers: AuthServiceInternalHelpers;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockLoginAttemptRepository: jest.Mocked<Repository<BaseLoginAttempt>>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockAccountLockoutStorage: jest.Mocked<AccountLockoutStorageService>;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockHookRegistry: jest.Mocked<HookRegistryService>;
  let mockRecaptchaProvider: jest.Mocked<RecaptchaProvider>;

  beforeEach(() => {
    // Create mock services
    mockUserRepository = {} as jest.Mocked<Repository<BaseUser>>;
    mockLoginAttemptRepository = {} as jest.Mocked<Repository<BaseLoginAttempt>>;
    mockEmailVerificationService = {} as jest.Mocked<EmailVerificationService>;
    mockChallengeService = {} as jest.Mocked<ChallengeService>;
    mockChallengeHelper = {} as jest.Mocked<AuthChallengeHelperService>;
    mockClientInfoService = {} as jest.Mocked<ClientInfoService>;
    mockSessionService = {} as jest.Mocked<SessionService>;
    mockAccountLockoutStorage = {} as jest.Mocked<AccountLockoutStorageService>;
    mockHookRegistry = {} as jest.Mocked<HookRegistryService>;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
      isPiiRedactionEnabled: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<NAuthLogger>;

    mockRecaptchaProvider = {
      verify: jest.fn(),
    } as jest.Mocked<RecaptchaProvider>;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'a'.repeat(32), expiresIn: 3600 },
        refreshToken: { secret: 'a'.repeat(32), expiresIn: 86400 },
      },
      tokenDelivery: {
        method: 'cookies',
      },
    } as NAuthConfig;

    helpers = new AuthServiceInternalHelpers(
      mockUserRepository,
      mockLoginAttemptRepository,
      mockEmailVerificationService,
      undefined,
      mockChallengeService,
      mockChallengeHelper,
      mockClientInfoService,
      mockSessionService,
      mockAccountLockoutStorage,
      mockConfig,
      mockLogger,
      mockHookRegistry,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRecaptchaIfNeeded', () => {
    it('should skip validation when reCAPTCHA is not enabled', async () => {
      mockConfig.recaptcha = undefined;

      await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4');

      expect(mockRecaptchaProvider.verify).not.toHaveBeenCalled();
    });

    it('should skip validation when reCAPTCHA is disabled', async () => {
      mockConfig.recaptcha = {
        enabled: false,
        provider: mockRecaptchaProvider,
      };

      await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4');

      expect(mockRecaptchaProvider.verify).not.toHaveBeenCalled();
    });

    it('should require validation when nauthRequireRecaptcha attribute is true', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
        };

        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.9,
        } as RecaptchaVerificationResult);

        await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'login');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'reCAPTCHA validation required (explicit @RequireRecaptcha() decorator)',
        );
        expect(mockRecaptchaProvider.verify).toHaveBeenCalledWith('test-token', '1.2.3.4', 'login');
      });
    });

    it('should skip validation when @RequireRecaptcha is not set even if token is provided', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: {}, // nauthRequireRecaptcha not set
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
        };

        await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4');

        expect(mockRecaptchaProvider.verify).not.toHaveBeenCalled();
      });
    });

    it('should throw error when nauthRequireRecaptcha is true but no token provided', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
        };

        await expect(helpers.validateRecaptchaIfNeeded(undefined, '1.2.3.4')).rejects.toThrow(NAuthException);
        await expect(helpers.validateRecaptchaIfNeeded(undefined, '1.2.3.4')).rejects.toMatchObject({
          code: AuthErrorCode.RECAPTCHA_REQUIRED,
          message: 'reCAPTCHA token is required',
        });
      });
    });

    it('should throw error when provider is missing', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: undefined as unknown as RecaptchaProvider,
        };

        await expect(helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4')).rejects.toThrow(NAuthException);
        await expect(helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4')).rejects.toMatchObject({
          code: AuthErrorCode.RECAPTCHA_PROVIDER_MISSING,
          message: 'reCAPTCHA provider is not configured',
        });
      });
    });

    it('should throw error when verification fails', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
        };

        mockRecaptchaProvider.verify.mockResolvedValue({
          success: false,
          errorCodes: ['invalid-input-response'],
        } as RecaptchaVerificationResult);

        await expect(helpers.validateRecaptchaIfNeeded('invalid-token', '1.2.3.4')).rejects.toThrow(NAuthException);
        await expect(helpers.validateRecaptchaIfNeeded('invalid-token', '1.2.3.4')).rejects.toMatchObject({
          code: AuthErrorCode.RECAPTCHA_VALIDATION_FAILED,
          message: 'reCAPTCHA validation failed',
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'reCAPTCHA validation failed: invalid-input-response',
        );
      });
    });

    it('should throw error when score is too low', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
          minimumScore: 0.5,
        };

        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.3,
          action: 'login',
        } as RecaptchaVerificationResult);

        await expect(helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'login')).rejects.toThrow(NAuthException);
        await expect(helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'login')).rejects.toMatchObject({
          code: AuthErrorCode.RECAPTCHA_SCORE_TOO_LOW,
          message: 'Suspicious activity detected',
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'reCAPTCHA score too low: 0.3 < 0.5. Likely bot activity detected.',
        );
      });
    });

    it('should pass validation when score meets minimum', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
          minimumScore: 0.5,
        };

        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.8,
          action: 'login',
        } as RecaptchaVerificationResult);

        await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'login');

        expect(mockLogger.debug).toHaveBeenCalledWith('reCAPTCHA score: 0.8 (minimum: 0.5, action: login)');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'reCAPTCHA validation successful (score: 0.8) for action: login',
        );
      });
    });

    it('should use default minimum score of 0.5 when not specified', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
        };

        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.6,
          action: 'login',
        } as RecaptchaVerificationResult);

        await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'login');

        expect(mockLogger.debug).toHaveBeenCalledWith('reCAPTCHA score: 0.6 (minimum: 0.5, action: login)');
      });
    });

    it('should use per-action score from actionScores when configured', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
          minimumScore: 0.5,
          actionScores: {
            login: 0.3,
            signup: 0.7,
          },
        };

        // Score 0.4 is above login threshold (0.3) — should pass
        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.4,
          action: 'login',
        } as RecaptchaVerificationResult);

        await helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'login');

        expect(mockRecaptchaProvider.verify).toHaveBeenCalledWith('test-token', '1.2.3.4', 'login');
        expect(mockLogger.debug).toHaveBeenCalledWith('reCAPTCHA score: 0.4 (minimum: 0.3, action: login)');
      });
    });

    it('should reject when score is below per-action threshold', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
          minimumScore: 0.3,
          actionScores: {
            login: 0.3,
            signup: 0.7,
          },
        };

        // Score 0.5 is below signup threshold (0.7) — should fail even though global is 0.3
        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.5,
          action: 'signup',
        } as RecaptchaVerificationResult);

        await expect(helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'signup')).rejects.toMatchObject({
          code: AuthErrorCode.RECAPTCHA_SCORE_TOO_LOW,
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'reCAPTCHA score too low: 0.5 < 0.7. Likely bot activity detected.',
        );
      });
    });

    it('should fall back to global minimumScore for actions not in actionScores', async () => {
      await ContextStorage.run(async () => {
        const mockRequest: Partial<NAuthRequest> = {
          attributes: { nauthRequireRecaptcha: true },
        };
        ContextStorage.set('REQUEST', mockRequest as NAuthRequest);

        mockConfig.recaptcha = {
          enabled: true,
          provider: mockRecaptchaProvider,
          minimumScore: 0.5,
          actionScores: {
            login: 0.3,
          },
        };

        // 'password_reset' is not in actionScores, should use global 0.5
        mockRecaptchaProvider.verify.mockResolvedValue({
          success: true,
          score: 0.4,
          action: 'password_reset',
        } as RecaptchaVerificationResult);

        await expect(helpers.validateRecaptchaIfNeeded('test-token', '1.2.3.4', 'password_reset')).rejects.toMatchObject({
          code: AuthErrorCode.RECAPTCHA_SCORE_TOO_LOW,
        });
      });
    });
  });
});
