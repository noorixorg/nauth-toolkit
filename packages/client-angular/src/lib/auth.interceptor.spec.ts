/**
 * Auth Interceptor Unit Tests
 */
import 'reflect-metadata';
import { PLATFORM_ID } from '@angular/core';
import { HttpRequest, HttpHandlerFn, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { authInterceptor, AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../ngmodule/auth.service';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';
import { createNAuthAuthHttpInterceptor } from './auth-interceptor.shared';

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

jest.mock('./auth-interceptor.shared', () => ({
  createNAuthAuthHttpInterceptor: jest.fn(),
}));

describe('authInterceptor', () => {
  let mockConfig: any;
  let mockHttp: any;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRouter: any;
  let mockRequest: HttpRequest<unknown>;
  let mockNext: HttpHandlerFn;
  let mockResponse: any;

  beforeEach(() => {
    mockResponse = of({});
    mockRequest = new HttpRequest('GET', '/api/test');
    mockNext = jest.fn().mockReturnValue(mockResponse);

    mockConfig = { baseUrl: 'http://localhost:3000' };
    mockHttp = {};
    mockAuthService = {} as any;
    mockRouter = {};

    mockInject.mockImplementation((token: unknown) => {
      if (token === NAUTH_CLIENT_CONFIG) return mockConfig;
      if (token === HttpClient) return mockHttp;
      if (token === AuthService) return mockAuthService;
      if (token === Router) return mockRouter;
      if (token === PLATFORM_ID) return 'browser';
      return undefined;
    });

    (createNAuthAuthHttpInterceptor as jest.Mock).mockReturnValue(mockResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call createNAuthAuthHttpInterceptor in browser', () => {
    const result = authInterceptor(mockRequest, mockNext);

    expect(createNAuthAuthHttpInterceptor).toHaveBeenCalledWith({
      config: mockConfig,
      http: mockHttp,
      authService: mockAuthService,
      router: mockRouter,
      next: mockNext,
      req: mockRequest,
    });
    expect(result).toBe(mockResponse);
  });

  it('should skip interceptor in non-browser environment', () => {
    mockInject.mockImplementation((token: unknown) => {
      if (token === PLATFORM_ID) return 'server';
      if (token === NAUTH_CLIENT_CONFIG) return mockConfig;
      if (token === 'HttpClient') return mockHttp;
      if (token === AuthService) return mockAuthService;
      if (token === 'Router') return mockRouter;
      return undefined;
    });

    const result = authInterceptor(mockRequest, mockNext);

    expect(createNAuthAuthHttpInterceptor).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(mockRequest);
    expect(result).toBe(mockResponse);
  });
});

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let mockRequest: HttpRequest<unknown>;
  let mockNext: any;
  let mockResponse: any;

  beforeEach(() => {
    mockResponse = of({});
    mockRequest = new HttpRequest('GET', '/api/test');
    mockNext = jest.fn().mockReturnValue(mockResponse);

    (createNAuthAuthHttpInterceptor as jest.Mock).mockReturnValue(mockResponse);

    interceptor = new AuthInterceptor();
  });

  it('should call authInterceptor function', () => {
    const result = interceptor.intercept(mockRequest, mockNext);

    // AuthInterceptor just calls authInterceptor function
    // which will be tested via the authInterceptor tests above
    expect(result).toBe(mockResponse);
  });
});
