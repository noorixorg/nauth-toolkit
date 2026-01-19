/**
 * Social Redirect Callback Guard Unit Tests
 */
import 'reflect-metadata';
import { PLATFORM_ID } from '@angular/core';
import { socialRedirectCallbackGuard } from './social-redirect-callback.guard';
import { AuthService } from '../ngmodule/auth.service';
import { NAuthClientError, NAuthErrorCode } from '@nauth-toolkit/client';

// Mock Angular inject
const mockInject = jest.fn();
jest.mock('@angular/core', () => {
  const actual = jest.requireActual('../../__mocks__/angular-core');
  return {
    ...actual,
    inject: (token: unknown, options?: { optional?: boolean }) => mockInject(token, options),
    PLATFORM_ID: 'browser',
  };
});

jest.mock('@angular/common', () => ({
  isPlatformBrowser: jest.fn((id: string) => id === 'browser'),
}));

// Store the search string for URLSearchParams to read
let mockSearchString = '';

// Mock URLSearchParams to read from our controlled variable
const OriginalURLSearchParams = global.URLSearchParams;
beforeAll(() => {
  global.URLSearchParams = class extends OriginalURLSearchParams {
    constructor(init?: string | string[][] | Record<string, string> | URLSearchParams) {
      // If no init provided, use our mock search string
      if (!init) {
        super(mockSearchString);
      } else {
        super(init);
      }
    }
  } as any;
});

afterAll(() => {
  global.URLSearchParams = OriginalURLSearchParams;
});

describe('socialRedirectCallbackGuard', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockClient: any;
  let mockChallengeRouter: any;

  beforeEach(() => {
    // Reset mock search string
    mockSearchString = '';
    
    // Create a proper window mock with writable location.search
    const locationMock = Object.create(null);
    Object.defineProperty(locationMock, 'search', {
      get: () => mockSearchString,
      set: (value: string) => {
        mockSearchString = value;
      },
      configurable: true,
      enumerable: true,
    });
    
    // Ensure window.location is properly set up
    if (!global.window) {
      global.window = {} as any;
    }
    global.window.location = locationMock as any;

    mockChallengeRouter = {
      navigateToError: jest.fn().mockResolvedValue(undefined),
      navigateToSuccess: jest.fn().mockResolvedValue(undefined),
      handleAuthResponse: jest.fn().mockResolvedValue(undefined),
      isErrorRedirectDisabled: jest.fn().mockReturnValue(false),
      isSuccessRedirectDisabled: jest.fn().mockReturnValue(false),
    };

    mockClient = {
      storeOauthState: jest.fn().mockResolvedValue(undefined),
    };

    mockAuthService = {
      getChallengeRouter: jest.fn().mockReturnValue(mockChallengeRouter),
      getClient: jest.fn().mockReturnValue(mockClient),
      getProfile: jest.fn().mockResolvedValue({
        sub: 'user-1',
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        phone: null,
        isEmailVerified: true,
        isPhoneVerified: false,
        isActive: true,
        isLocked: false,
        mfaEnabled: false,
        socialProviders: null,
        hasPasswordHash: true,
        sessionAuthMethod: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      exchangeSocialRedirect: jest.fn().mockResolvedValue({} as any),
    } as any;

    // Reset mockInject for each test
    mockInject.mockReset();
    mockInject.mockImplementation((token: unknown) => {
      if (token === AuthService) return mockAuthService;
      if (token === PLATFORM_ID) return 'browser';
      return undefined;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSearchString = '';
  });

  it('should return false in non-browser environment', async () => {
    // Mock isPlatformBrowser to return false
    const { isPlatformBrowser } = require('@angular/common');
    (isPlatformBrowser as jest.Mock).mockReturnValueOnce(false);

    mockInject.mockImplementation((token: unknown) => {
      if (token === AuthService) return mockAuthService;
      if (token === PLATFORM_ID) return 'server';
      return undefined;
    });

    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockAuthService.getChallengeRouter).not.toHaveBeenCalled();
  });

  it('should handle error parameter and navigate to error', async () => {
    // Set search before calling guard
    mockSearchString = '?error=access_denied';
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockAuthService.getChallengeRouter).toHaveBeenCalled();
    expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
    expect(mockAuthService.exchangeSocialRedirect).not.toHaveBeenCalled();
  });

  it('should store appState when present', async () => {
    // Set search before calling guard
    mockSearchString = '?appState=test-state';
    
    const mockUser = {
      sub: 'user-1',
      email: 'test@example.com',
      firstName: null,
      lastName: null,
      phone: null,
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      isLocked: false,
      mfaEnabled: false,
      socialProviders: null,
      hasPasswordHash: true,
      sessionAuthMethod: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAuthService.getProfile.mockResolvedValue(mockUser);
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    await guard(mockRoute, mockState);

    expect(mockClient.storeOauthState).toHaveBeenCalledWith('test-state');
    expect(mockAuthService.getProfile).toHaveBeenCalled();
  });

  it('should exchange token when exchangeToken is present', async () => {
    mockSearchString = '?exchangeToken=token-123&appState=state-456';
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockClient.storeOauthState).toHaveBeenCalledWith('state-456');
    expect(mockAuthService.exchangeSocialRedirect).toHaveBeenCalledWith('token-123');
    expect(mockChallengeRouter.navigateToError).not.toHaveBeenCalled();
  });

  it('should handle cookie success path without exchangeToken', async () => {
    mockSearchString = '?appState=state-789';
    
    const mockUser = {
      sub: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      isLocked: false,
      mfaEnabled: false,
      socialProviders: ['google'],
      hasPasswordHash: false,
      sessionAuthMethod: 'google',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAuthService.getProfile.mockResolvedValue(mockUser);
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockAuthService.getProfile).toHaveBeenCalled();
    expect(mockClient.storeOauthState).toHaveBeenCalledWith('state-789');
    expect(mockChallengeRouter.handleAuthResponse).toHaveBeenCalledWith(
      {
        user: {
          sub: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          phone: null,
          isEmailVerified: true,
          isPhoneVerified: false,
          socialProviders: ['google'],
          hasPasswordHash: false,
        },
        authMethod: 'google',
      },
      { source: 'social', appState: 'state-789' }
    );
    expect(mockAuthService.exchangeSocialRedirect).not.toHaveBeenCalled();
  });

  it('should handle cookie success path without appState', async () => {
    mockSearchString = '';
    
    const mockUser = {
      sub: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      isLocked: false,
      mfaEnabled: false,
      socialProviders: ['google'],
      hasPasswordHash: false,
      sessionAuthMethod: 'google',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAuthService.getProfile.mockResolvedValue(mockUser);
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockAuthService.getProfile).toHaveBeenCalled();
    expect(mockChallengeRouter.handleAuthResponse).toHaveBeenCalledWith(
      {
        user: {
          sub: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          phone: null,
          isEmailVerified: true,
          isPhoneVerified: false,
          socialProviders: ['google'],
          hasPasswordHash: false,
        },
        authMethod: 'google',
      },
      { source: 'social', appState: undefined }
    );
    expect(mockClient.storeOauthState).not.toHaveBeenCalled();
  });

  it('should handle auth error (401) during profile fetch', async () => {
    mockSearchString = '';
    
    const authError = new NAuthClientError(NAuthErrorCode.AUTH_TOKEN_INVALID, 'Token invalid', {
      statusCode: 401,
    });
    mockAuthService.getProfile.mockRejectedValue(authError);

    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
    expect(mockChallengeRouter.navigateToSuccess).not.toHaveBeenCalled();
  });

  it('should handle auth error (403) during profile fetch', async () => {
    mockSearchString = '';
    
    const authError = new NAuthClientError(NAuthErrorCode.AUTH_SESSION_EXPIRED, 'Session expired', {
      statusCode: 403,
    });
    mockAuthService.getProfile.mockRejectedValue(authError);

    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
  });

  it('should handle network error during profile fetch and proceed to success', async () => {
    mockSearchString = '?appState=state-999';
    
    const networkError = new Error('Network error');
    mockAuthService.getProfile.mockRejectedValue(networkError);

    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    // Network errors should still proceed to success route
    // The guard should call navigateToSuccess with appState even after network error
    expect(mockChallengeRouter.navigateToSuccess).toHaveBeenCalled();
    // Check that it was called with appState (called in catch block)
    expect(mockChallengeRouter.navigateToSuccess).toHaveBeenCalledWith({ appState: 'state-999' });
    expect(mockChallengeRouter.navigateToError).not.toHaveBeenCalled();
  });

  it('should handle AUTH_SESSION_NOT_FOUND error code', async () => {
    mockSearchString = '';
    
    const authError = new NAuthClientError(NAuthErrorCode.AUTH_SESSION_NOT_FOUND, 'Session not found', {
      statusCode: 404,
    });
    mockAuthService.getProfile.mockRejectedValue(authError);

    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
  });

  it('should call handleAuthResponse with synthetic AuthResponse in cookie success path', async () => {
    mockSearchString = '?appState=invite-code-123';
    
    const mockUser = {
      sub: 'user-abc',
      email: 'john@example.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      isLocked: false,
      mfaEnabled: true,
      mfaExempt: false,
      socialProviders: ['google', 'apple'],
      hasPasswordHash: true,
      sessionAuthMethod: 'google',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    };
    mockAuthService.getProfile.mockResolvedValue(mockUser);
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    await guard(mockRoute, mockState);

    // Verify handleAuthResponse was called with correct synthetic response
    expect(mockChallengeRouter.handleAuthResponse).toHaveBeenCalledWith(
      {
        user: {
          sub: 'user-abc',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          isEmailVerified: true,
          isPhoneVerified: true,
          socialProviders: ['google', 'apple'],
          hasPasswordHash: true,
        },
        authMethod: 'google',
      },
      { source: 'social', appState: 'invite-code-123' }
    );

    // Verify appState was stored
    expect(mockClient.storeOauthState).toHaveBeenCalledWith('invite-code-123');
  });

  it('should handle sessionAuthMethod as undefined when null in cookie success path', async () => {
    mockSearchString = '';
    
    const mockUser = {
      sub: 'user-1',
      email: 'test@example.com',
      firstName: null,
      lastName: null,
      phone: null,
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      isLocked: false,
      mfaEnabled: false,
      socialProviders: null,
      hasPasswordHash: true,
      sessionAuthMethod: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAuthService.getProfile.mockResolvedValue(mockUser);
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    await guard(mockRoute, mockState);

    // Verify authMethod is undefined when sessionAuthMethod is null
    expect(mockChallengeRouter.handleAuthResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        authMethod: undefined,
      }),
      { source: 'social' }
    );
  });

  // ============================================================================
  // Auto-redirect disabled tests
  // ============================================================================
  describe('auto-redirect disabled (null redirect URLs)', () => {
    it('should return true when success redirect is disabled (exchangeToken present)', async () => {
      mockSearchString = '?exchangeToken=token-123';
      mockChallengeRouter.isSuccessRedirectDisabled.mockReturnValue(true);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      const result = await guard(mockRoute, mockState);

      expect(result).toBe(true);
      expect(mockAuthService.exchangeSocialRedirect).toHaveBeenCalledWith('token-123');
      expect(mockChallengeRouter.isSuccessRedirectDisabled).toHaveBeenCalledWith({
        source: 'social',
        appState: undefined,
      });
    });

    it('should return true when success redirect is disabled (cookie success path)', async () => {
      mockSearchString = '?appState=state-456';
      mockChallengeRouter.isSuccessRedirectDisabled.mockReturnValue(true);

      const mockUser = {
        sub: 'user-1',
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        phone: null,
        isEmailVerified: true,
        isPhoneVerified: false,
        isActive: true,
        isLocked: false,
        mfaEnabled: false,
        socialProviders: null,
        hasPasswordHash: true,
        sessionAuthMethod: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAuthService.getProfile.mockResolvedValue(mockUser);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      const result = await guard(mockRoute, mockState);

      expect(result).toBe(true);
      expect(mockAuthService.getProfile).toHaveBeenCalled();
      expect(mockChallengeRouter.isSuccessRedirectDisabled).toHaveBeenCalledWith({
        source: 'social',
        appState: 'state-456',
      });
    });

    it('should return true when oauthError redirect is disabled and error param is present', async () => {
      mockSearchString = '?error=access_denied';
      mockChallengeRouter.isErrorRedirectDisabled.mockReturnValue(true);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      const result = await guard(mockRoute, mockState);

      expect(result).toBe(true);
      expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
      expect(mockChallengeRouter.isErrorRedirectDisabled).toHaveBeenCalledWith('oauth');
    });

    it('should return true when auth error occurs and oauthError redirect is disabled', async () => {
      mockSearchString = '';
      mockChallengeRouter.isErrorRedirectDisabled.mockReturnValue(true);

      const authError = new NAuthClientError(NAuthErrorCode.AUTH_TOKEN_INVALID, 'Token invalid', {
        statusCode: 401,
      });
      mockAuthService.getProfile.mockRejectedValue(authError);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      const result = await guard(mockRoute, mockState);

      expect(result).toBe(true);
      expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
      expect(mockChallengeRouter.isErrorRedirectDisabled).toHaveBeenCalledWith('oauth');
    });

    it('should return false when auto-redirect is enabled (default behavior)', async () => {
      mockSearchString = '?exchangeToken=token-123';
      mockChallengeRouter.isSuccessRedirectDisabled.mockReturnValue(false);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      const result = await guard(mockRoute, mockState);

      expect(result).toBe(false);
      expect(mockAuthService.exchangeSocialRedirect).toHaveBeenCalledWith('token-123');
    });

    it('should return false when error redirect is enabled', async () => {
      mockSearchString = '?error=access_denied';
      mockChallengeRouter.isErrorRedirectDisabled.mockReturnValue(false);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      const result = await guard(mockRoute, mockState);

      expect(result).toBe(false);
      expect(mockChallengeRouter.navigateToError).toHaveBeenCalledWith('oauth');
    });

    it('should check isSuccessRedirectDisabled with appState in context', async () => {
      mockSearchString = '?exchangeToken=token-123&appState=invite-code';
      mockChallengeRouter.isSuccessRedirectDisabled.mockReturnValue(true);

      const guard = socialRedirectCallbackGuard;
      const mockRoute = {} as any;
      const mockState = {} as any;
      await guard(mockRoute, mockState);

      expect(mockChallengeRouter.isSuccessRedirectDisabled).toHaveBeenCalledWith({
        source: 'social',
        appState: 'invite-code',
      });
    });
  });
});
