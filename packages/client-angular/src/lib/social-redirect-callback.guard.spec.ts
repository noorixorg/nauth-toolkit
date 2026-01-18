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
    };

    mockClient = {
      storeOauthState: jest.fn().mockResolvedValue(undefined),
    };

    mockAuthService = {
      getChallengeRouter: jest.fn().mockReturnValue(mockChallengeRouter),
      getClient: jest.fn().mockReturnValue(mockClient),
      getProfile: jest.fn().mockResolvedValue({ sub: 'user-1' }),
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
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockAuthService.getProfile).toHaveBeenCalled();
    expect(mockChallengeRouter.navigateToSuccess).toHaveBeenCalledWith({ appState: 'state-789' });
    expect(mockAuthService.exchangeSocialRedirect).not.toHaveBeenCalled();
  });

  it('should handle cookie success path without appState', async () => {
    mockSearchString = '';
    
    const guard = socialRedirectCallbackGuard;
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = await guard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(mockAuthService.getProfile).toHaveBeenCalled();
    expect(mockChallengeRouter.navigateToSuccess).toHaveBeenCalledWith(undefined);
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
});
