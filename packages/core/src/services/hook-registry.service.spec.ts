/**
 * Hook Registry Service Tests
 *
 * Tests for the hook provider registration and execution system.
 */

import { HookRegistryService } from '../services/hook-registry.service';
import {
  IPreSignupHookProvider,
  IPostSignupHookProvider,
  IUserProfileUpdatedHook,
  IPasswordChangedHook,
  IMFADeviceRemovedHook,
  IAdaptiveMFARiskDetectedHook,
  IAccountStatusChangedHook,
  IEmailChangedHook,
  IAccountLockedHook,
  ISessionsRevokedHook,
  IMFAFirstEnabledHook,
  SignupMetadata,
  UserProfileUpdatedMetadata,
  PasswordChangedMetadata,
  MFADeviceRemovedMetadata,
  AdaptiveMFARiskDetectedMetadata,
  AccountStatusChangedMetadata,
  EmailChangedMetadata,
  AccountLockedMetadata,
  SessionsRevokedMetadata,
  MFAFirstEnabledMetadata,
} from '../interfaces/hooks.interface';
import { IUser } from '../interfaces/entities.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { LoggerProvider } from '../interfaces/logger.interface';
import { RiskFactor } from '../enums/risk-factor.enum';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockLogger implements LoggerProvider {
  debug = jest.fn();
  log = jest.fn();
  warn = jest.fn();
  error = jest.fn();
}

class MockPreSignupHook implements IPreSignupHookProvider {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockPostSignupHook implements IPostSignupHookProvider {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockUserProfileUpdatedHook implements IUserProfileUpdatedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockPasswordChangedHook implements IPasswordChangedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockMFADeviceRemovedHook implements IMFADeviceRemovedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockAdaptiveMFARiskDetectedHook implements IAdaptiveMFARiskDetectedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockAccountStatusChangedHook implements IAccountStatusChangedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockEmailChangedHook implements IEmailChangedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockAccountLockedHook implements IAccountLockedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockSessionsRevokedHook implements ISessionsRevokedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

class MockMFAFirstEnabledHook implements IMFAFirstEnabledHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

// ============================================================================
// Tests
// ============================================================================

describe('HookRegistryService', () => {
  let hookRegistry: HookRegistryService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    hookRegistry = new HookRegistryService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Registration Tests
  // ============================================================================

  describe('registerPreSignup', () => {
    it('should register a pre-signup hook provider', () => {
      const hook = new MockPreSignupHook();

      hookRegistry.registerPreSignup(hook);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered preSignup hook: MockPreSignupHook'),
      );
    });

    it('should register multiple pre-signup hooks', () => {
      const hook1 = new MockPreSignupHook();
      const hook2 = new MockPreSignupHook();

      hookRegistry.registerPreSignup(hook1);
      hookRegistry.registerPreSignup(hook2);

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerPostSignup', () => {
    it('should register a post-signup hook provider', () => {
      const hook = new MockPostSignupHook();

      hookRegistry.registerPostSignup(hook);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered postSignup hook: MockPostSignupHook'),
      );
    });

    it('should register multiple post-signup hooks', () => {
      const hook1 = new MockPostSignupHook();
      const hook2 = new MockPostSignupHook();

      hookRegistry.registerPostSignup(hook1);
      hookRegistry.registerPostSignup(hook2);

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Pre-Signup Execution Tests
  // ============================================================================

  describe('executePreSignup', () => {
    it('should execute all registered pre-signup hooks in order', async () => {
      const hook1 = new MockPreSignupHook();
      const hook2 = new MockPreSignupHook();

      hookRegistry.registerPreSignup(hook1);
      hookRegistry.registerPreSignup(hook2);

      const testDto = { email: 'test@example.com', password: 'password123' };
      await hookRegistry.executePreSignup(testDto, 'password', undefined, false);

      expect(hook1.execute).toHaveBeenCalledWith(testDto, 'password', undefined, false);
      expect(hook2.execute).toHaveBeenCalledWith(testDto, 'password', undefined, false);
    });

    it('should pass correct parameters for password signup', async () => {
      const hook = new MockPreSignupHook();
      hookRegistry.registerPreSignup(hook);

      const testDto = { email: 'test@example.com', password: 'password123' };
      await hookRegistry.executePreSignup(testDto, 'password', undefined, false);

      expect(hook.execute).toHaveBeenCalledWith(testDto, 'password', undefined, false);
    });

    it('should pass correct parameters for social signup', async () => {
      const hook = new MockPreSignupHook();
      hookRegistry.registerPreSignup(hook);

      const testProfile = { id: '123', email: 'test@example.com' };
      await hookRegistry.executePreSignup(testProfile, 'social', 'google', false);

      expect(hook.execute).toHaveBeenCalledWith(testProfile, 'social', 'google', false);
    });

    it('should pass adminSignup flag correctly', async () => {
      const hook = new MockPreSignupHook();
      hookRegistry.registerPreSignup(hook);

      const testDto = { email: 'admin@example.com', password: 'password123' };
      await hookRegistry.executePreSignup(testDto, 'password', undefined, true);

      expect(hook.execute).toHaveBeenCalledWith(testDto, 'password', undefined, true);
    });

    it('should throw PRESIGNUP_FAILED when hook throws NAuthException with PRESIGNUP_FAILED', async () => {
      const hook = new MockPreSignupHook();
      const customError = new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Custom validation failed');
      hook.execute.mockRejectedValue(customError);

      hookRegistry.registerPreSignup(hook);

      const testDto = { email: 'test@example.com', password: 'password123' };

      await expect(hookRegistry.executePreSignup(testDto, 'password', undefined, false)).rejects.toThrow(
        'Custom validation failed',
      );
      await expect(hookRegistry.executePreSignup(testDto, 'password', undefined, false)).rejects.toMatchObject({
        code: AuthErrorCode.PRESIGNUP_FAILED,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('preSignup hook blocked signup'));
    });

    it('should wrap other errors in PRESIGNUP_FAILED exception', async () => {
      const hook = new MockPreSignupHook();
      hook.execute.mockRejectedValue(new Error('Database connection failed'));

      hookRegistry.registerPreSignup(hook);

      const testDto = { email: 'test@example.com', password: 'password123' };

      await expect(hookRegistry.executePreSignup(testDto, 'password', undefined, false)).rejects.toThrow(
        'Database connection failed',
      );
      await expect(hookRegistry.executePreSignup(testDto, 'password', undefined, false)).rejects.toMatchObject({
        code: AuthErrorCode.PRESIGNUP_FAILED,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('preSignup hook error'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should stop execution at first hook that throws', async () => {
      const hook1 = new MockPreSignupHook();
      const hook2 = new MockPreSignupHook();
      hook1.execute.mockRejectedValue(new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'First hook failed'));

      hookRegistry.registerPreSignup(hook1);
      hookRegistry.registerPreSignup(hook2);

      const testDto = { email: 'test@example.com', password: 'password123' };

      await expect(hookRegistry.executePreSignup(testDto, 'password', undefined, false)).rejects.toThrow(
        'First hook failed',
      );

      expect(hook1.execute).toHaveBeenCalled();
      expect(hook2.execute).not.toHaveBeenCalled();
    });

    it('should do nothing when no hooks are registered', async () => {
      const testDto = { email: 'test@example.com', password: 'password123' };

      await expect(hookRegistry.executePreSignup(testDto, 'password', undefined, false)).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // After-Signup Execution Tests
  // ============================================================================

  describe('executePostSignup', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: null,
      lastName: null,
      passwordHash: null,
      passwordChangedAt: null,
      passwordHistory: null,
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
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should execute all registered post-signup hooks in order', async () => {
      const hook1 = new MockPostSignupHook();
      const hook2 = new MockPostSignupHook();

      hookRegistry.registerPostSignup(hook1);
      hookRegistry.registerPostSignup(hook2);

      const testUser = createTestUser();
      const metadata: SignupMetadata = { requiresVerification: true, signupType: 'password' };

      await hookRegistry.executePostSignup(testUser, metadata);

      expect(hook1.execute).toHaveBeenCalledWith(testUser, metadata);
      expect(hook2.execute).toHaveBeenCalledWith(testUser, metadata);
    });

    it('should pass correct metadata for password signup', async () => {
      const hook = new MockPostSignupHook();
      hookRegistry.registerPostSignup(hook);

      const testUser = createTestUser();
      const metadata: SignupMetadata = { requiresVerification: true, signupType: 'password' };

      await hookRegistry.executePostSignup(testUser, metadata);

      expect(hook.execute).toHaveBeenCalledWith(testUser, metadata);
    });

    it('should pass correct metadata for social signup', async () => {
      const hook = new MockPostSignupHook();
      hookRegistry.registerPostSignup(hook);

      const testUser = createTestUser();
      const metadata: SignupMetadata = {
        requiresVerification: false,
        signupType: 'social',
        provider: 'google',
        socialMetadata: { sub: 'google_123', given_name: 'John', picture: 'https://example.com/pic.jpg' },
        profilePicture: 'https://example.com/pic.jpg',
      };

      await hookRegistry.executePostSignup(testUser, metadata);

      expect(hook.execute).toHaveBeenCalledWith(testUser, metadata);
    });

    it('should continue execution even when a hook throws an error', async () => {
      const hook1 = new MockPostSignupHook();
      const hook2 = new MockPostSignupHook();
      hook1.execute.mockRejectedValue(new Error('Hook 1 failed'));

      hookRegistry.registerPostSignup(hook1);
      hookRegistry.registerPostSignup(hook2);

      const testUser = createTestUser();

      await expect(hookRegistry.executePostSignup(testUser)).resolves.not.toThrow();

      expect(hook1.execute).toHaveBeenCalled();
      expect(hook2.execute).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('postSignup hook error'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should do nothing when no hooks are registered', async () => {
      const testUser = createTestUser();

      await expect(hookRegistry.executePostSignup(testUser)).resolves.not.toThrow();
    });

    it('should work without metadata', async () => {
      const hook = new MockPostSignupHook();
      hookRegistry.registerPostSignup(hook);

      const testUser = createTestUser();

      await hookRegistry.executePostSignup(testUser);

      expect(hook.execute).toHaveBeenCalledWith(testUser, undefined);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: null,
      lastName: null,
      passwordHash: null,
      passwordChangedAt: null,
      passwordHistory: null,
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
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should allow pre-signup and post-signup hooks to coexist', async () => {
      const preHook = new MockPreSignupHook();
      const afterHook = new MockPostSignupHook();

      hookRegistry.registerPreSignup(preHook);
      hookRegistry.registerPostSignup(afterHook);

      const testDto = { email: 'test@example.com', password: 'password123' };
      const testUser = createTestUser();

      await hookRegistry.executePreSignup(testDto, 'password', undefined, false);
      await hookRegistry.executePostSignup(testUser, { requiresVerification: true, signupType: 'password' });

      expect(preHook.execute).toHaveBeenCalled();
      expect(afterHook.execute).toHaveBeenCalled();
    });

    it('should work without a logger', async () => {
      const registryWithoutLogger = new HookRegistryService();
      const hook = new MockPreSignupHook();

      registryWithoutLogger.registerPreSignup(hook);

      const testDto = { email: 'test@example.com', password: 'password123' };
      await expect(
        registryWithoutLogger.executePreSignup(testDto, 'password', undefined, false),
      ).resolves.not.toThrow();

      expect(hook.execute).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // User Profile Updated Hook Tests
  // ============================================================================

  describe('registerUserProfileUpdated', () => {
    it('should register a user profile updated hook provider', () => {
      const hook = new MockUserProfileUpdatedHook();

      hookRegistry.registerUserProfileUpdated(hook);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered userProfileUpdated hook: MockUserProfileUpdatedHook'),
      );
    });

    it('should register multiple user profile updated hooks', () => {
      const hook1 = new MockUserProfileUpdatedHook();
      const hook2 = new MockUserProfileUpdatedHook();

      hookRegistry.registerUserProfileUpdated(hook1);
      hookRegistry.registerUserProfileUpdated(hook2);

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeUserProfileUpdated', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: null,
      passwordChangedAt: null,
      passwordHistory: null,
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
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should execute all registered user profile updated hooks in order', async () => {
      const hook1 = new MockUserProfileUpdatedHook();
      const hook2 = new MockUserProfileUpdatedHook();

      hookRegistry.registerUserProfileUpdated(hook1);
      hookRegistry.registerUserProfileUpdated(hook2);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [
          {
            fieldName: 'firstName',
            oldValue: 'Jane',
            newValue: 'John',
          },
        ],
        updateSource: 'user_request',
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(hook1.execute).toHaveBeenCalledWith(metadata);
      expect(hook2.execute).toHaveBeenCalledWith(metadata);
    });

    it('should pass correct metadata for user_request update', async () => {
      const hook = new MockUserProfileUpdatedHook();
      hookRegistry.registerUserProfileUpdated(hook);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [
          {
            fieldName: 'email',
            oldValue: 'old@example.com',
            newValue: 'test@example.com',
          },
        ],
        updateSource: 'user_request',
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(hook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should pass correct metadata for email_verification update', async () => {
      const hook = new MockUserProfileUpdatedHook();
      hookRegistry.registerUserProfileUpdated(hook);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [
          {
            fieldName: 'isEmailVerified',
            oldValue: false,
            newValue: true,
          },
        ],
        updateSource: 'email_verification',
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(hook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should pass correct metadata for phone_verification update', async () => {
      const hook = new MockUserProfileUpdatedHook();
      hookRegistry.registerUserProfileUpdated(hook);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [
          {
            fieldName: 'isPhoneVerified',
            oldValue: false,
            newValue: true,
          },
        ],
        updateSource: 'phone_verification',
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(hook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should pass correct metadata for admin_action update', async () => {
      const hook = new MockUserProfileUpdatedHook();
      hookRegistry.registerUserProfileUpdated(hook);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [
          {
            fieldName: 'isEmailVerified',
            oldValue: false,
            newValue: true,
          },
        ],
        updateSource: 'admin_action',
        performedBy: 'admin-sub-123',
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'Admin Panel',
        },
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(hook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should continue execution even when a hook throws an error', async () => {
      const hook1 = new MockUserProfileUpdatedHook();
      const hook2 = new MockUserProfileUpdatedHook();
      hook1.execute.mockRejectedValue(new Error('Hook 1 failed'));

      hookRegistry.registerUserProfileUpdated(hook1);
      hookRegistry.registerUserProfileUpdated(hook2);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [{ fieldName: 'firstName', oldValue: 'Jane', newValue: 'John' }],
        updateSource: 'user_request',
      };

      await expect(hookRegistry.executeUserProfileUpdated(metadata)).resolves.not.toThrow();

      expect(hook1.execute).toHaveBeenCalled();
      expect(hook2.execute).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('userProfileUpdated hook error'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should do nothing when no hooks are registered', async () => {
      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [{ fieldName: 'firstName', oldValue: 'Jane', newValue: 'John' }],
        updateSource: 'user_request',
      };

      await expect(hookRegistry.executeUserProfileUpdated(metadata)).resolves.not.toThrow();
    });

    it('should work with multiple changed fields', async () => {
      const hook = new MockUserProfileUpdatedHook();
      hookRegistry.registerUserProfileUpdated(hook);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [
          { fieldName: 'firstName', oldValue: 'Jane', newValue: 'John' },
          { fieldName: 'lastName', oldValue: 'Smith', newValue: 'Doe' },
          { fieldName: 'email', oldValue: 'jane@example.com', newValue: 'test@example.com' },
        ],
        updateSource: 'user_request',
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(hook.execute).toHaveBeenCalledWith(metadata);
    });
  });

  // ============================================================================
  // Password Changed Hook Tests
  // ============================================================================

  describe('Password Changed Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: new Date(),
      passwordHistory: null,
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
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerPasswordChanged', () => {
      it('should register a password changed hook', () => {
        const hook = new MockPasswordChangedHook();
        hookRegistry.registerPasswordChanged(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered passwordChanged hook: MockPasswordChangedHook'),
        );
      });

      it('should register multiple password changed hooks', () => {
        const hook1 = new MockPasswordChangedHook();
        const hook2 = new MockPasswordChangedHook();

        hookRegistry.registerPasswordChanged(hook1);
        hookRegistry.registerPasswordChanged(hook2);

        expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      });
    });

    describe('executePasswordChanged', () => {
      it('should execute all registered hooks with correct metadata', async () => {
        const hook1 = new MockPasswordChangedHook();
        const hook2 = new MockPasswordChangedHook();

        hookRegistry.registerPasswordChanged(hook1);
        hookRegistry.registerPasswordChanged(hook2);

        const testUser = createTestUser();
        const metadata: PasswordChangedMetadata = {
          user: testUser,
          changedBy: 'user',
          sessionsRevoked: 3,
          clientInfo: {
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
            ipCountry: 'US',
            ipCity: 'New York',
          },
        };

        await hookRegistry.executePasswordChanged(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should handle user-initiated password change', async () => {
        const hook = new MockPasswordChangedHook();
        hookRegistry.registerPasswordChanged(hook);

        const testUser = createTestUser();
        const metadata: PasswordChangedMetadata = {
          user: testUser,
          changedBy: 'user',
          sessionsRevoked: 2,
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
        };

        await hookRegistry.executePasswordChanged(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ changedBy: 'user' }));
      });

      it('should handle admin-initiated password change', async () => {
        const hook = new MockPasswordChangedHook();
        hookRegistry.registerPasswordChanged(hook);

        const testUser = createTestUser();
        const metadata: PasswordChangedMetadata = {
          user: testUser,
          changedBy: 'admin',
          sessionsRevoked: 5,
          clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Admin Panel' },
        };

        await hookRegistry.executePasswordChanged(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ changedBy: 'admin' }));
      });

      it('should handle reset-initiated password change', async () => {
        const hook = new MockPasswordChangedHook();
        hookRegistry.registerPasswordChanged(hook);

        const testUser = createTestUser();
        const metadata: PasswordChangedMetadata = {
          user: testUser,
          changedBy: 'reset',
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
        };

        await hookRegistry.executePasswordChanged(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ changedBy: 'reset' }));
      });

      it('should continue execution even when a hook throws', async () => {
        const hook1 = new MockPasswordChangedHook();
        const hook2 = new MockPasswordChangedHook();
        hook1.execute.mockRejectedValue(new Error('Email sending failed'));

        hookRegistry.registerPasswordChanged(hook1);
        hookRegistry.registerPasswordChanged(hook2);

        const testUser = createTestUser();
        const metadata: PasswordChangedMetadata = {
          user: testUser,
          changedBy: 'user',
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
        };

        await expect(hookRegistry.executePasswordChanged(metadata)).resolves.not.toThrow();

        expect(hook1.execute).toHaveBeenCalled();
        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('passwordChanged hook error'),
          expect.any(Object),
        );
      });
    });
  });

  // ============================================================================
  // MFA Device Removed Hook Tests
  // ============================================================================

  describe('MFA Device Removed Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
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
      mfaEnabled: true,
      mfaMethods: ['totp', 'sms'],
      preferredMfaMethod: 'totp',
      backupCodes: null,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerMFADeviceRemoved', () => {
      it('should register an MFA device removed hook', () => {
        const hook = new MockMFADeviceRemovedHook();
        hookRegistry.registerMFADeviceRemoved(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered mfaDeviceRemoved hook: MockMFADeviceRemovedHook'),
        );
      });
    });

    describe('executeMFADeviceRemoved', () => {
      it('should execute all registered hooks with correct metadata', async () => {
        const hook1 = new MockMFADeviceRemovedHook();
        const hook2 = new MockMFADeviceRemovedHook();

        hookRegistry.registerMFADeviceRemoved(hook1);
        hookRegistry.registerMFADeviceRemoved(hook2);

        const testUser = createTestUser();
        const metadata: MFADeviceRemovedMetadata = {
          user: testUser,
          deviceType: 'totp' as any,
          deviceName: 'My Authenticator',
          removedBy: 'user',
          reason: 'user_request',
          remainingDeviceCount: 1,
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
        };

        await hookRegistry.executeMFADeviceRemoved(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should handle system-removed device (email changed)', async () => {
        const hook = new MockMFADeviceRemovedHook();
        hookRegistry.registerMFADeviceRemoved(hook);

        const testUser = createTestUser();
        const metadata: MFADeviceRemovedMetadata = {
          user: testUser,
          deviceType: 'email' as any,
          removedBy: 'system',
          reason: 'email_changed',
          remainingDeviceCount: 0,
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
        };

        await hookRegistry.executeMFADeviceRemoved(metadata);

        expect(hook.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            removedBy: 'system',
            reason: 'email_changed',
            deviceType: 'email',
          }),
        );
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockMFADeviceRemovedHook();
        const hook2 = new MockMFADeviceRemovedHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerMFADeviceRemoved(hook1);
        hookRegistry.registerMFADeviceRemoved(hook2);

        const testUser = createTestUser();
        const metadata: MFADeviceRemovedMetadata = {
          user: testUser,
          deviceType: 'sms' as any,
          removedBy: 'user',
          remainingDeviceCount: 0,
        };

        await expect(hookRegistry.executeMFADeviceRemoved(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Adaptive MFA Risk Detected Hook Tests
  // ============================================================================

  describe('Adaptive MFA Risk Detected Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
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
      mfaEnabled: true,
      mfaMethods: ['totp'],
      preferredMfaMethod: 'totp',
      backupCodes: null,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerAdaptiveMFARiskDetected', () => {
      it('should register an adaptive MFA risk detected hook', () => {
        const hook = new MockAdaptiveMFARiskDetectedHook();
        hookRegistry.registerAdaptiveMFARiskDetected(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('adaptiveMFARiskDetected hook: MockAdaptiveMFARiskDetectedHook'),
        );
      });
    });

    describe('executeAdaptiveMFARiskDetected', () => {
      it('should execute all registered hooks with correct metadata', async () => {
        const hook1 = new MockAdaptiveMFARiskDetectedHook();
        const hook2 = new MockAdaptiveMFARiskDetectedHook();

        hookRegistry.registerAdaptiveMFARiskDetected(hook1);
        hookRegistry.registerAdaptiveMFARiskDetected(hook2);

        const testUser = createTestUser();
        const metadata: AdaptiveMFARiskDetectedMetadata = {
          user: testUser,
          riskScore: 75,
          riskLevel: 'high',
          riskFactors: [RiskFactor.NEW_DEVICE, RiskFactor.NEW_COUNTRY],
          action: 'require_mfa',
          authMethod: 'password',
          clientInfo: {
            ipAddress: '203.0.113.0',
            userAgent: 'Unknown Browser',
            ipCountry: 'CN',
            ipCity: 'Beijing',
          },
          timestamp: new Date(),
        };

        await hookRegistry.executeAdaptiveMFARiskDetected(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should handle high risk with block action', async () => {
        const hook = new MockAdaptiveMFARiskDetectedHook();
        hookRegistry.registerAdaptiveMFARiskDetected(hook);

        const testUser = createTestUser();
        const metadata: AdaptiveMFARiskDetectedMetadata = {
          user: testUser,
          riskScore: 95,
          riskLevel: 'high',
          riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL, RiskFactor.SUSPICIOUS_ACTIVITY],
          action: 'block_signin',
          authMethod: 'password',
          clientInfo: { ipAddress: '1.2.3.4', userAgent: 'Bot' },
          timestamp: new Date(),
        };

        await hookRegistry.executeAdaptiveMFARiskDetected(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'block_signin', riskScore: 95 }));
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockAdaptiveMFARiskDetectedHook();
        const hook2 = new MockAdaptiveMFARiskDetectedHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerAdaptiveMFARiskDetected(hook1);
        hookRegistry.registerAdaptiveMFARiskDetected(hook2);

        const testUser = createTestUser();
        const metadata: AdaptiveMFARiskDetectedMetadata = {
          user: testUser,
          riskScore: 50,
          riskLevel: 'medium',
          riskFactors: [RiskFactor.NEW_IP],
          action: 'require_mfa',
          authMethod: 'google',
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
          timestamp: new Date(),
        };

        await expect(hookRegistry.executeAdaptiveMFARiskDetected(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Account Status Changed Hook Tests
  // ============================================================================

  describe('Account Status Changed Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
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
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerAccountStatusChanged', () => {
      it('should register an account status changed hook', () => {
        const hook = new MockAccountStatusChangedHook();
        hookRegistry.registerAccountStatusChanged(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered accountStatusChanged hook: MockAccountStatusChangedHook'),
        );
      });
    });

    describe('executeAccountStatusChanged', () => {
      it('should execute all registered hooks with correct metadata for disabled status', async () => {
        const hook1 = new MockAccountStatusChangedHook();
        const hook2 = new MockAccountStatusChangedHook();

        hookRegistry.registerAccountStatusChanged(hook1);
        hookRegistry.registerAccountStatusChanged(hook2);

        const testUser = createTestUser();
        const metadata: AccountStatusChangedMetadata = {
          user: testUser,
          status: 'disabled',
          reason: 'Account disabled by admin',
          performedBy: 'admin-sub-456',
          revokedSessions: 3,
          clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Admin Panel' },
        };

        await hookRegistry.executeAccountStatusChanged(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should execute hooks for enabled status', async () => {
        const hook = new MockAccountStatusChangedHook();
        hookRegistry.registerAccountStatusChanged(hook);

        const testUser = createTestUser();
        const metadata: AccountStatusChangedMetadata = {
          user: testUser,
          status: 'enabled',
          reason: 'admin_unlock',
          performedBy: 'admin-sub-789',
          clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Admin Panel' },
        };

        await hookRegistry.executeAccountStatusChanged(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'enabled' }));
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockAccountStatusChangedHook();
        const hook2 = new MockAccountStatusChangedHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerAccountStatusChanged(hook1);
        hookRegistry.registerAccountStatusChanged(hook2);

        const testUser = createTestUser();
        const metadata: AccountStatusChangedMetadata = {
          user: testUser,
          status: 'disabled',
        };

        await expect(hookRegistry.executeAccountStatusChanged(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Email Changed Hook Tests
  // ============================================================================

  describe('Email Changed Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'newemail@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
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
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerEmailChanged', () => {
      it('should register an email changed hook', () => {
        const hook = new MockEmailChangedHook();
        hookRegistry.registerEmailChanged(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered emailChanged hook: MockEmailChangedHook'),
        );
      });
    });

    describe('executeEmailChanged', () => {
      it('should execute all registered hooks with correct metadata', async () => {
        const hook1 = new MockEmailChangedHook();
        const hook2 = new MockEmailChangedHook();

        hookRegistry.registerEmailChanged(hook1);
        hookRegistry.registerEmailChanged(hook2);

        const testUser = createTestUser();
        const metadata: EmailChangedMetadata = {
          user: testUser,
          oldEmail: 'oldemail@example.com',
          newEmail: 'newemail@example.com',
          updateSource: 'user_request',
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' },
        };

        await hookRegistry.executeEmailChanged(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should handle admin-initiated email change', async () => {
        const hook = new MockEmailChangedHook();
        hookRegistry.registerEmailChanged(hook);

        const testUser = createTestUser();
        const metadata: EmailChangedMetadata = {
          user: testUser,
          oldEmail: 'old@example.com',
          newEmail: 'new@example.com',
          updateSource: 'admin_action',
          clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Admin Panel' },
        };

        await hookRegistry.executeEmailChanged(metadata);

        expect(hook.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            updateSource: 'admin_action',
          }),
        );
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockEmailChangedHook();
        const hook2 = new MockEmailChangedHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerEmailChanged(hook1);
        hookRegistry.registerEmailChanged(hook2);

        const testUser = createTestUser();
        const metadata: EmailChangedMetadata = {
          user: testUser,
          oldEmail: 'old@example.com',
          newEmail: 'new@example.com',
          updateSource: 'user_request',
        };

        await expect(hookRegistry.executeEmailChanged(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Account Locked Hook Tests
  // ============================================================================

  describe('Account Locked Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      mustChangePassword: false,
      isLocked: true,
      lockReason: 'Too many failed login attempts',
      lockedAt: new Date(),
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      failedLoginAttempts: 5,
      lastFailedLoginAt: new Date(),
      lastLoginAt: null,
      lastLoginIp: null,
      hasSocialAuth: false,
      socialProviders: null,
      mfaEnabled: false,
      mfaMethods: null,
      preferredMfaMethod: null,
      backupCodes: null,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerAccountLocked', () => {
      it('should register an account locked hook', () => {
        const hook = new MockAccountLockedHook();
        hookRegistry.registerAccountLocked(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered accountLocked hook: MockAccountLockedHook'),
        );
      });
    });

    describe('executeAccountLocked', () => {
      it('should execute all registered hooks with correct metadata for temporary lock', async () => {
        const hook1 = new MockAccountLockedHook();
        const hook2 = new MockAccountLockedHook();

        hookRegistry.registerAccountLocked(hook1);
        hookRegistry.registerAccountLocked(hook2);

        const testUser = createTestUser();
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        const metadata: AccountLockedMetadata = {
          user: testUser,
          reason: 'Too many failed login attempts',
          lockType: 'temporary',
          lockDuration: 900,
          lockedUntil,
          ipAddress: '203.0.113.0',
          failedAttempts: 5,
        };

        await hookRegistry.executeAccountLocked(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should execute hooks for permanent lock', async () => {
        const hook = new MockAccountLockedHook();
        hookRegistry.registerAccountLocked(hook);

        const testUser = createTestUser();
        const metadata: AccountLockedMetadata = {
          user: testUser,
          reason: 'Fraudulent activity detected',
          lockType: 'permanent',
          ipAddress: '203.0.113.0',
        };

        await hookRegistry.executeAccountLocked(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ lockType: 'permanent' }));
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockAccountLockedHook();
        const hook2 = new MockAccountLockedHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerAccountLocked(hook1);
        hookRegistry.registerAccountLocked(hook2);

        const testUser = createTestUser();
        const metadata: AccountLockedMetadata = {
          user: testUser,
          reason: 'Too many attempts',
          lockType: 'temporary',
          lockDuration: 900,
        };

        await expect(hookRegistry.executeAccountLocked(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Sessions Revoked Hook Tests
  // ============================================================================

  describe('Sessions Revoked Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
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
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerSessionsRevoked', () => {
      it('should register a sessions revoked hook', () => {
        const hook = new MockSessionsRevokedHook();
        hookRegistry.registerSessionsRevoked(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered sessionsRevoked hook: MockSessionsRevokedHook'),
        );
      });
    });

    describe('executeSessionsRevoked', () => {
      it('should execute all registered hooks with correct metadata', async () => {
        const hook1 = new MockSessionsRevokedHook();
        const hook2 = new MockSessionsRevokedHook();

        hookRegistry.registerSessionsRevoked(hook1);
        hookRegistry.registerSessionsRevoked(hook2);

        const testUser = createTestUser();
        const metadata: SessionsRevokedMetadata = {
          user: testUser,
          revokedCount: 4,
          reason: 'Global signout',
          initiatedBy: 'user',
          triggerEvent: 'user_request',
        };

        await hookRegistry.executeSessionsRevoked(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should handle system-initiated revocation', async () => {
        const hook = new MockSessionsRevokedHook();
        hookRegistry.registerSessionsRevoked(hook);

        const testUser = createTestUser();
        const metadata: SessionsRevokedMetadata = {
          user: testUser,
          revokedCount: 2,
          reason: 'Password changed',
          initiatedBy: 'system',
          triggerEvent: 'password_changed',
        };

        await hookRegistry.executeSessionsRevoked(metadata);

        expect(hook.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            initiatedBy: 'system',
            triggerEvent: 'password_changed',
          }),
        );
      });

      it('should handle admin-initiated revocation', async () => {
        const hook = new MockSessionsRevokedHook();
        hookRegistry.registerSessionsRevoked(hook);

        const testUser = createTestUser();
        const metadata: SessionsRevokedMetadata = {
          user: testUser,
          revokedCount: 5,
          reason: 'Security review',
          initiatedBy: 'admin',
        };

        await hookRegistry.executeSessionsRevoked(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ initiatedBy: 'admin' }));
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockSessionsRevokedHook();
        const hook2 = new MockSessionsRevokedHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerSessionsRevoked(hook1);
        hookRegistry.registerSessionsRevoked(hook2);

        const testUser = createTestUser();
        const metadata: SessionsRevokedMetadata = {
          user: testUser,
          revokedCount: 3,
          reason: 'Global signout',
          initiatedBy: 'user',
        };

        await expect(hookRegistry.executeSessionsRevoked(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // MFA First Enabled Hook Tests
  // ============================================================================

  describe('MFA First Enabled Hook', () => {
    const createTestUser = (): IUser => ({
      id: 1,
      sub: 'test-sub-123',
      email: 'test@example.com',
      username: null,
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: null,
      passwordHistory: null,
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
      mfaEnabled: true,
      mfaMethods: ['totp'],
      preferredMfaMethod: 'totp',
      backupCodes: null,
      metadata: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    describe('registerMFAFirstEnabled', () => {
      it('should register an MFA first enabled hook', () => {
        const hook = new MockMFAFirstEnabledHook();
        hookRegistry.registerMFAFirstEnabled(hook);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Registered mfaFirstEnabled hook: MockMFAFirstEnabledHook'),
        );
      });
    });

    describe('executeMFAFirstEnabled', () => {
      it('should execute all registered hooks with correct metadata', async () => {
        const hook1 = new MockMFAFirstEnabledHook();
        const hook2 = new MockMFAFirstEnabledHook();

        hookRegistry.registerMFAFirstEnabled(hook1);
        hookRegistry.registerMFAFirstEnabled(hook2);

        const testUser = createTestUser();
        const enforcedAt = new Date();
        const metadata: MFAFirstEnabledMetadata = {
          user: testUser,
          firstMethod: 'totp' as any,
          deviceName: 'My Authenticator App',
          enforcedAt,
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' },
        };

        await hookRegistry.executeMFAFirstEnabled(metadata);

        expect(hook1.execute).toHaveBeenCalledWith(metadata);
        expect(hook2.execute).toHaveBeenCalledWith(metadata);
      });

      it('should handle different MFA methods', async () => {
        const hook = new MockMFAFirstEnabledHook();
        hookRegistry.registerMFAFirstEnabled(hook);

        const testUser = createTestUser();
        const metadata: MFAFirstEnabledMetadata = {
          user: testUser,
          firstMethod: 'sms' as any,
          deviceName: 'Primary Phone',
          enforcedAt: new Date(),
          clientInfo: { ipAddress: '127.0.0.1', userAgent: 'Test' },
        };

        await hookRegistry.executeMFAFirstEnabled(metadata);

        expect(hook.execute).toHaveBeenCalledWith(expect.objectContaining({ firstMethod: 'sms' }));
      });

      it('should continue execution when a hook throws', async () => {
        const hook1 = new MockMFAFirstEnabledHook();
        const hook2 = new MockMFAFirstEnabledHook();
        hook1.execute.mockRejectedValue(new Error('Failed'));

        hookRegistry.registerMFAFirstEnabled(hook1);
        hookRegistry.registerMFAFirstEnabled(hook2);

        const testUser = createTestUser();
        const metadata: MFAFirstEnabledMetadata = {
          user: testUser,
          firstMethod: 'totp' as any,
          enforcedAt: new Date(),
        };

        await expect(hookRegistry.executeMFAFirstEnabled(metadata)).resolves.not.toThrow();

        expect(hook2.execute).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });
});
