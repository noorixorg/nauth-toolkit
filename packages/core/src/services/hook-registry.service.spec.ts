/**
 * Hook Registry Service Tests
 *
 * Tests for the hook provider registration and execution system.
 */

import { HookRegistryService } from '../services/hook-registry.service';
import { IPreSignupHookProvider, IAfterSignupHookProvider, SignupMetadata } from '../interfaces/hooks.interface';
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

class MockAfterSignupHook implements IAfterSignupHookProvider {
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

  describe('registerAfterSignup', () => {
    it('should register an after-signup hook provider', () => {
      const hook = new MockAfterSignupHook();

      hookRegistry.registerAfterSignup(hook);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered afterSignup hook: MockAfterSignupHook'),
      );
    });

    it('should register multiple after-signup hooks', () => {
      const hook1 = new MockAfterSignupHook();
      const hook2 = new MockAfterSignupHook();

      hookRegistry.registerAfterSignup(hook1);
      hookRegistry.registerAfterSignup(hook2);

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

  describe('executeAfterSignup', () => {
    it('should execute all registered after-signup hooks in order', async () => {
      const hook1 = new MockAfterSignupHook();
      const hook2 = new MockAfterSignupHook();

      hookRegistry.registerAfterSignup(hook1);
      hookRegistry.registerAfterSignup(hook2);

      const testUser = { id: 1, email: 'test@example.com' };
      const metadata: SignupMetadata = { requiresVerification: true, signupType: 'password' };

      await hookRegistry.executeAfterSignup(testUser, metadata);

      expect(hook1.execute).toHaveBeenCalledWith(testUser, metadata);
      expect(hook2.execute).toHaveBeenCalledWith(testUser, metadata);
    });

    it('should pass correct metadata for password signup', async () => {
      const hook = new MockAfterSignupHook();
      hookRegistry.registerAfterSignup(hook);

      const testUser = { id: 1, email: 'test@example.com' };
      const metadata: SignupMetadata = { requiresVerification: true, signupType: 'password' };

      await hookRegistry.executeAfterSignup(testUser, metadata);

      expect(hook.execute).toHaveBeenCalledWith(testUser, metadata);
    });

    it('should pass correct metadata for social signup', async () => {
      const hook = new MockAfterSignupHook();
      hookRegistry.registerAfterSignup(hook);

      const testUser = { id: 1, email: 'test@example.com' };
      const metadata: SignupMetadata = { requiresVerification: false, signupType: 'social', provider: 'google' };

      await hookRegistry.executeAfterSignup(testUser, metadata);

      expect(hook.execute).toHaveBeenCalledWith(testUser, metadata);
    });

    it('should continue execution even when a hook throws an error', async () => {
      const hook1 = new MockAfterSignupHook();
      const hook2 = new MockAfterSignupHook();
      hook1.execute.mockRejectedValue(new Error('Hook 1 failed'));

      hookRegistry.registerAfterSignup(hook1);
      hookRegistry.registerAfterSignup(hook2);

      const testUser = { id: 1, email: 'test@example.com' };

      await expect(hookRegistry.executeAfterSignup(testUser)).resolves.not.toThrow();

      expect(hook1.execute).toHaveBeenCalled();
      expect(hook2.execute).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('afterSignup hook error'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should do nothing when no hooks are registered', async () => {
      const testUser = { id: 1, email: 'test@example.com' };

      await expect(hookRegistry.executeAfterSignup(testUser)).resolves.not.toThrow();
    });

    it('should work without metadata', async () => {
      const hook = new MockAfterSignupHook();
      hookRegistry.registerAfterSignup(hook);

      const testUser = { id: 1, email: 'test@example.com' };

      await hookRegistry.executeAfterSignup(testUser);

      expect(hook.execute).toHaveBeenCalledWith(testUser, undefined);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should allow pre-signup and after-signup hooks to coexist', async () => {
      const preHook = new MockPreSignupHook();
      const afterHook = new MockAfterSignupHook();

      hookRegistry.registerPreSignup(preHook);
      hookRegistry.registerAfterSignup(afterHook);

      const testDto = { email: 'test@example.com', password: 'password123' };
      const testUser = { id: 1, email: 'test@example.com' };

      await hookRegistry.executePreSignup(testDto, 'password', undefined, false);
      await hookRegistry.executeAfterSignup(testUser, { requiresVerification: true, signupType: 'password' });

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
});
