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
  SignupMetadata,
  UserProfileUpdatedMetadata,
} from '../interfaces/hooks.interface';
import { IUser } from '../interfaces/entities.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { LoggerProvider } from '../interfaces/logger.interface';

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
});
