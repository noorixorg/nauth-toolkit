/**
 * Auth Flow Context Builder Unit Tests
 *
 * Tests authentication flow context building functionality.
 */

import { AuthFlowContextBuilder } from './auth-flow-context-builder.service';
import { TrustedDeviceService } from './trusted-device.service';
import { AdaptiveMFADecisionService } from './adaptive-mfa-decision.service';
import { ClientInfoService } from './client-info.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser } from '../interfaces/entities.interface';

describe('AuthFlowContextBuilder', () => {
  let service: AuthFlowContextBuilder;
  let mockTrustedDeviceService: jest.Mocked<TrustedDeviceService>;
  let mockAdaptiveMFADecisionService: jest.Mocked<AdaptiveMFADecisionService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  const mockUser: IUser = {
    id: 1,
    sub: 'a21b654c-2746-4168-acee-c175083a65cd',
    email: 'test@example.com',
    username: 'testuser',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: 'hashed',
    passwordChangedAt: new Date(),
    passwordHistory: [],
    isEmailVerified: false,
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
    mfaExempt: false,
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(() => {
    mockTrustedDeviceService = {
      validateDeviceToken: jest.fn().mockResolvedValue({ isValid: false, isSuspicious: false }),
    } as any;

    mockAdaptiveMFADecisionService = {
      evaluateAdaptiveMFA: jest.fn().mockResolvedValue({
        action: 'require_mfa',
        riskScore: 50,
        riskLevel: 'medium',
      }),
      isUserBlocked: jest.fn().mockResolvedValue({ blocked: false }),
    } as any;

    mockClientInfoService = {
      get: jest.fn().mockReturnValue({ ipAddress: '1.2.3.4' }),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: {
          secret: 'test-secret',
          expiresIn: 3600,
        },
        refreshToken: {
          secret: 'test-secret',
          expiresIn: 86400,
        },
      },
      signup: {
        verificationMethod: 'email',
        allowDuplicateEmails: false,
        allowDuplicatePhones: false,
        allowDuplicateUsernames: false,
      },
      mfa: {
        enabled: true,
        enforcement: 'OPTIONAL',
        gracePeriod: 7,
        rememberDevices: 'user_opt_in',
        allowedMethods: [],
      },
    } as NAuthConfig;

    service = new AuthFlowContextBuilder(
      mockTrustedDeviceService,
      mockAdaptiveMFADecisionService,
      mockClientInfoService,
      mockLogger,
    );
  });

  describe('build', () => {
    it('should build context with computed values', async () => {
      const context = await service.build({
        user: mockUser,
        config: mockConfig,
        authMethod: 'password',
      });

      expect(context.user).toBe(mockUser);
      expect(context.config).toBe(mockConfig);
      expect(context.authMethod).toBe('password');
      expect(context.computed).toBeDefined();
      expect(context.computed.isEmailVerificationRequired).toBe(true);
      expect(context.computed.isPhoneVerificationRequired).toBe(false);
      expect(context.computed.isMFAExempt).toBe(false);
    });

    it('should check device trust when device token provided', async () => {
      mockTrustedDeviceService.validateDeviceToken.mockResolvedValue({ isValid: true, isSuspicious: false });

      const context = await service.build({
        user: mockUser,
        config: mockConfig,
        deviceToken: 'device-token-123',
      });

      expect(context.computed.isDeviceTrusted).toBe(true);
      expect(mockTrustedDeviceService.validateDeviceToken).toHaveBeenCalledWith('device-token-123', mockUser.id);
    });

    it('should calculate grace period correctly', async () => {
      const userWithRecentCreation = {
        ...mockUser,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      };

      const context = await service.build({
        user: userWithRecentCreation,
        config: mockConfig,
      });

      expect(context.computed.isGracePeriodActive).toBe(true);
      expect(context.computed.gracePeriodEndsAt).toBeDefined();
    });

    it('should check for blocked user status', async () => {
      mockAdaptiveMFADecisionService.isUserBlocked.mockResolvedValue({
        blocked: true,
        expiresAt: new Date(Date.now() + 3600000),
        message: 'Suspicious activity',
      });

      const context = await service.build({
        user: mockUser,
        config: mockConfig,
      });

      expect(context.computed.isBlocked).toBe(true);
      expect(context.computed.blockReason).toBeDefined();
    });

    it('should evaluate adaptive MFA when enforcement is ADAPTIVE', async () => {
      const adaptiveConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa!,
          enforcement: 'ADAPTIVE',
        },
      } as NAuthConfig;
      const userWithMfa = { ...mockUser, mfaEnabled: true };

      await service.build({
        user: userWithMfa,
        config: adaptiveConfig,
      });

      expect(mockAdaptiveMFADecisionService.evaluateAdaptiveMFA).toHaveBeenCalled();
    });

    it('should skip MFA verification when skipMFAVerification is true', async () => {
      const userWithMfa = { ...mockUser, mfaEnabled: true };

      const context = await service.build({
        user: userWithMfa,
        config: mockConfig,
        skipMFAVerification: true,
      });

      expect(context.computed.isMFAVerificationRequired).toBe(false);
    });

    it('should handle social auth method', async () => {
      const context = await service.build({
        user: mockUser,
        config: mockConfig,
        authMethod: 'social',
        authProvider: 'google',
      });

      expect(context.authMethod).toBe('social');
      expect(context.authProvider).toBe('google');
      expect(context.computed.isEmailVerificationRequired).toBe(false); // Social users have pre-verified email
    });

    it('should work without optional services', async () => {
      const serviceWithoutServices = new AuthFlowContextBuilder(undefined, undefined, undefined, mockLogger);

      const context = await serviceWithoutServices.build({
        user: mockUser,
        config: mockConfig,
      });

      expect(context).toBeDefined();
      expect(context.computed.isDeviceTrusted).toBe(false);
      expect(context.computed.isBlocked).toBe(false);
    });
  });
});
