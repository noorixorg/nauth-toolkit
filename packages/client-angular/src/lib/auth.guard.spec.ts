/**
 * Auth Guard Unit Tests
 */
import 'reflect-metadata';
import { Router, UrlTree } from '@angular/router';
import { authGuard, AuthGuard } from './auth.guard';
import { AuthService } from '../ngmodule/auth.service';
import { NAUTH_CLIENT_CONFIG } from '../ngmodule/tokens';
import { NAuthClientConfig } from '@nauth-toolkit/client';

// Mock Angular inject - must be before importing the guard
const mockInject = jest.fn();
jest.mock('@angular/core', () => {
  const actual = jest.requireActual('../../__mocks__/angular-core');
  return {
    ...actual,
    inject: (token: unknown, options?: { optional?: boolean }) => mockInject(token, options),
  };
});

describe('authGuard', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRouter: jest.Mocked<Router>;
  let mockConfig: NAuthClientConfig | undefined;
  let mockUrlTree: UrlTree;

  beforeEach(() => {
    mockUrlTree = {} as UrlTree;
    mockAuthService = {
      isAuthenticated: jest.fn(),
    } as any;

    mockRouter = {
      createUrlTree: jest.fn().mockReturnValue(mockUrlTree),
    } as any;

    mockConfig = undefined;

    mockInject.mockImplementation((token: unknown) => {
      if (token === AuthService) return mockAuthService;
      if (token === Router) return mockRouter;
      if (token === NAUTH_CLIENT_CONFIG) return mockConfig;
      return undefined;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    const guard = authGuard();
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = guard(mockRoute, mockState);

    expect(result).toBe(true);
    expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to default /login when not authenticated and no config', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    const guard = authGuard();
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = guard(mockRoute, mockState);

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect to config.redirects.sessionExpired when provided', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockConfig = {
      baseUrl: 'http://localhost:3000',
      redirects: { sessionExpired: '/custom-login' },
    } as NAuthClientConfig;
    mockInject.mockImplementation((token: unknown) => {
      if (token === AuthService) return mockAuthService;
      if (token === Router) return mockRouter;
      if (token === NAUTH_CLIENT_CONFIG) return mockConfig;
      return undefined;
    });

    const guard = authGuard();
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = guard(mockRoute, mockState);

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/custom-login']);
  });

  it('should use provided redirectTo parameter', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    const guard = authGuard('/admin/login');
    const mockRoute = {} as any;
    const mockState = {} as any;
    const result = guard(mockRoute, mockState);

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/admin/login']);
  });
});

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRouter: jest.Mocked<Router>;
  let mockConfig: NAuthClientConfig | undefined;
  let mockUrlTree: UrlTree;

  beforeEach(() => {
    mockUrlTree = {} as UrlTree;
    mockAuthService = {
      isAuthenticated: jest.fn(),
    } as any;

    mockRouter = {
      createUrlTree: jest.fn().mockReturnValue(mockUrlTree),
    } as any;

    mockConfig = undefined;
  });

  it('should return true when authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    guard = new AuthGuard(mockAuthService, mockRouter, mockConfig);

    const result = guard.canActivate();

    expect(result).toBe(true);
    expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to default /login when not authenticated and no config', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    guard = new AuthGuard(mockAuthService, mockRouter, mockConfig);

    const result = guard.canActivate();

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect to config.redirects.sessionExpired when provided', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockConfig = {
      baseUrl: 'http://localhost:3000',
      redirects: { sessionExpired: '/custom-login' },
    } as NAuthClientConfig;
    guard = new AuthGuard(mockAuthService, mockRouter, mockConfig);

    const result = guard.canActivate();

    expect(result).toBe(mockUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/custom-login']);
  });
});
