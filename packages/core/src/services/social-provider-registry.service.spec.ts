import { SocialProviderRegistry } from './social-provider-registry.service';
import { ISocialAuthProviderService } from '../interfaces/social-auth-provider.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Social Provider Registry Unit Tests
 *
 * Tests social authentication provider registry functionality.
 * Covers provider registration, lookup, and listing.
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 */
describe('SocialProviderRegistry', () => {
  let service: SocialProviderRegistry;
  let mockProvider1: jest.Mocked<ISocialAuthProviderService>;
  let mockProvider2: jest.Mocked<ISocialAuthProviderService>;

  beforeEach(() => {
    // Create mock providers
    mockProvider1 = {
      providerName: 'google',
      getAuthUrl: jest.fn(),
      handleCallback: jest.fn(),
      verifyToken: jest.fn(),
      linkAccount: jest.fn(),
      getUserProfileFromCallback: jest.fn(),
    } as any;

    mockProvider2 = {
      providerName: 'apple',
      getAuthUrl: jest.fn(),
      handleCallback: jest.fn(),
      verifyToken: jest.fn(),
      linkAccount: jest.fn(),
      getUserProfileFromCallback: jest.fn(),
    } as any;

    // Instantiate service directly
    service = new SocialAuthService();
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
  // registerProvider() Method
  // ============================================================================

  describe('registerProvider', () => {
    it('should register provider successfully', () => {
      service.registerProvider(mockProvider1);

      expect(service.hasProvider('google')).toBe(true);
    });

    it('should throw error when provider already registered', () => {
      service.registerProvider(mockProvider1);

      expect(() => service.registerProvider(mockProvider1)).toThrow(NAuthException);
      expect(() => service.registerProvider(mockProvider1)).toThrow('already registered');
    });

    it('should allow multiple different providers', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      expect(service.hasProvider('google')).toBe(true);
      expect(service.hasProvider('apple')).toBe(true);
    });

    it('should register provider with correct name', () => {
      service.registerProvider(mockProvider1);

      const provider = service.getProvider('google');
      expect(provider).toBe(mockProvider1);
      expect(provider.providerName).toBe('google');
    });
  });

  // ============================================================================
  // getProvider() Method
  // ============================================================================

  describe('getProvider', () => {
    it('should return registered provider', () => {
      service.registerProvider(mockProvider1);

      const provider = service.getProvider('google');

      expect(provider).toBe(mockProvider1);
    });

    it('should throw error when provider not registered', () => {
      expect(() => service.getProvider('google')).toThrow(NAuthException);
      expect(() => service.getProvider('google')).toThrow('not registered');
    });

    it('should throw error with helpful message suggesting module import', () => {
      try {
        service.getProvider('facebook');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.message).toContain('Import the provider module');
      }
    });

    it('should use correct error code when provider not found', () => {
      try {
        service.getProvider('google');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
      }
    });
  });

  // ============================================================================
  // hasProvider() Method
  // ============================================================================

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      service.registerProvider(mockProvider1);

      expect(service.hasProvider('google')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(service.hasProvider('google')).toBe(false);
    });

    it('should return false for provider that was never registered', () => {
      service.registerProvider(mockProvider1);

      expect(service.hasProvider('facebook')).toBe(false);
    });
  });

  // ============================================================================
  // listProviders() Method
  // ============================================================================

  describe('listProviders', () => {
    it('should return empty array when no providers registered', () => {
      expect(service.listProviders()).toEqual([]);
    });

    it('should return all registered provider names', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      const providers = service.listProviders();

      expect(providers).toContain('google');
      expect(providers).toContain('apple');
      expect(providers.length).toBe(2);
    });

    it('should return provider names in registration order', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      const providers = service.listProviders();

      expect(providers[0]).toBe('google');
      expect(providers[1]).toBe('apple');
    });

    it('should return updated list after new provider registered', () => {
      expect(service.listProviders()).toEqual([]);

      service.registerProvider(mockProvider1);
      expect(service.listProviders()).toEqual(['google']);

      service.registerProvider(mockProvider2);
      expect(service.listProviders()).toEqual(['google', 'apple']);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should allow full provider lifecycle', () => {
      // Register
      service.registerProvider(mockProvider1);
      expect(service.hasProvider('google')).toBe(true);

      // Get
      const provider = service.getProvider('google');
      expect(provider).toBe(mockProvider1);

      // List
      const providers = service.listProviders();
      expect(providers).toContain('google');
    });

    it('should handle multiple providers independently', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      const googleProvider = service.getProvider('google');
      const appleProvider = service.getProvider('apple');

      expect(googleProvider).toBe(mockProvider1);
      expect(appleProvider).toBe(mockProvider2);
      expect(googleProvider).not.toBe(appleProvider);
    });

    it('should maintain provider registry across operations', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      // Verify both still registered
      expect(service.hasProvider('google')).toBe(true);
      expect(service.hasProvider('apple')).toBe(true);

      // Get both
      const google = service.getProvider('google');
      const apple = service.getProvider('apple');

      expect(google).toBe(mockProvider1);
      expect(apple).toBe(mockProvider2);
    });
  });
});
