/**
 * Auth Service User Profile Updated Hook Integration Tests
 *
 * Tests for the userProfileUpdated hook integration in AuthService.
 */

import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { HookRegistryService } from './hook-registry.service';
import { IUserProfileUpdatedHook, UserProfileUpdatedMetadata } from '../interfaces/hooks.interface';
import { BaseUser } from '../entities';
import { IUser } from '../interfaces/entities.interface';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockUserProfileUpdatedHook implements IUserProfileUpdatedHook {
  execute = jest.fn().mockResolvedValue(undefined);
}

describe('AuthService - User Profile Updated Hook Integration', () => {
  let userRepository: jest.Mocked<Repository<BaseUser>>;
  let hookRegistry: HookRegistryService;
  let mockHook: MockUserProfileUpdatedHook;

  const createTestUser = (overrides: Partial<IUser> = {}): IUser => ({
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
    ...overrides,
  });

  beforeEach(() => {
    // Create mock repository
    userRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseUser>>;

    // Create hook registry and register mock hook
    hookRegistry = new HookRegistryService();
    mockHook = new MockUserProfileUpdatedHook();
    hookRegistry.registerUserProfileUpdated(mockHook);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Hook Registry Tests
  // ============================================================================

  describe('HookRegistry Integration', () => {
    it('should execute registered hook with correct metadata', async () => {
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

      expect(mockHook.execute).toHaveBeenCalledTimes(1);
      expect(mockHook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should execute hook with email verification change', async () => {
      const testUser = createTestUser({ isEmailVerified: true });
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

      expect(mockHook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should execute hook with phone verification change', async () => {
      const testUser = createTestUser({ isPhoneVerified: true });
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

      expect(mockHook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should execute hook with admin action source', async () => {
      const testUser = createTestUser({ isEmailVerified: true });
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

      expect(mockHook.execute).toHaveBeenCalledWith(metadata);
    });

    it('should continue execution even when hook throws error', async () => {
      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [{ fieldName: 'firstName', oldValue: 'Jane', newValue: 'John' }],
        updateSource: 'user_request',
      };

      mockHook.execute.mockRejectedValueOnce(new Error('Hook failed'));

      await expect(hookRegistry.executeUserProfileUpdated(metadata)).resolves.not.toThrow();
      expect(mockHook.execute).toHaveBeenCalled();
    });

    it('should execute multiple hooks in order', async () => {
      const hook2 = new MockUserProfileUpdatedHook();
      hookRegistry.registerUserProfileUpdated(hook2);

      const testUser = createTestUser();
      const metadata: UserProfileUpdatedMetadata = {
        user: testUser,
        changedFields: [{ fieldName: 'email', oldValue: 'old@test.com', newValue: 'test@example.com' }],
        updateSource: 'user_request',
      };

      await hookRegistry.executeUserProfileUpdated(metadata);

      expect(mockHook.execute).toHaveBeenCalledTimes(1);
      expect(hook2.execute).toHaveBeenCalledTimes(1);
      expect(mockHook.execute).toHaveBeenCalledWith(metadata);
      expect(hook2.execute).toHaveBeenCalledWith(metadata);
    });

    it('should work with multiple changed fields', async () => {
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

      expect(mockHook.execute).toHaveBeenCalledWith(metadata);
    });
  });
});
