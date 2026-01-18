/**
 * CSRF Guard Unit Tests
 *
 * Tests CSRF protection guard functionality.
 */

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from '../services/csrf.service';
import { NAuthConfig, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let mockCsrfService: jest.Mocked<CsrfService>;
  let mockReflector: jest.Mocked<Reflector>;
  let mockConfig: NAuthConfig;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;

  function createHttpContext(requestOverrides: any = {}): ExecutionContext {
    mockRequest = {
      method: 'POST',
      headers: {},
      cookies: {},
      url: '/test',
      ...requestOverrides,
    };

    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  beforeEach(() => {
    mockCsrfService = {
      getCookieName: jest.fn().mockReturnValue('nauth_csrf_token'),
      getHeaderName: jest.fn().mockReturnValue('x-csrf-token'),
      validateToken: jest.fn().mockReturnValue(true),
    } as any;

    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      security: {
        csrf: {
          cookieName: 'nauth_csrf_token',
          headerName: 'x-csrf-token',
        },
      },
    } as NAuthConfig;

    mockExecutionContext = createHttpContext();
    guard = new CsrfGuard(mockConfig, mockCsrfService, mockReflector);
  });

  describe('canActivate', () => {
    it('should return true for non-HTTP context', () => {
      const rpcContext = {
        getType: () => 'rpc',
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as any;
      expect(guard.canActivate(rpcContext)).toBe(true);
    });

    it('should return true when CSRF config not provided', () => {
      const guardWithoutConfig = new CsrfGuard({ jwt: mockConfig.jwt } as NAuthConfig, mockCsrfService, mockReflector);
      expect(guardWithoutConfig.canActivate(mockExecutionContext)).toBe(true);
    });

    it('should return true for safe HTTP methods', () => {
      const methods = ['GET', 'HEAD', 'OPTIONS'];
      for (const method of methods) {
        const ctx = createHttpContext({ method });
        expect(guard.canActivate(ctx)).toBe(true);
      }
    });

    it('should return true for public routes', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      expect(guard.canActivate(mockExecutionContext)).toBe(true);
    });

    it('should return true for excluded paths', () => {
      const configWithExclusions = {
        ...mockConfig,
        security: {
          ...mockConfig.security,
          csrf: {
            ...mockConfig.security!.csrf!,
            excludedPaths: ['/webhook'],
          },
        },
      };
      const guardWithExclusions = new CsrfGuard(configWithExclusions, mockCsrfService, mockReflector);
      const ctx = createHttpContext({ method: 'POST', url: '/webhook/test' });
      expect(guardWithExclusions.canActivate(ctx)).toBe(true);
    });

    it('should return true for JSON token delivery mode', () => {
      const jsonConfig: NAuthConfig = {
        ...mockConfig,
        tokenDelivery: { method: 'json' as const },
      };
      const jsonGuard = new CsrfGuard(jsonConfig, mockCsrfService, mockReflector);
      expect(jsonGuard.canActivate(mockExecutionContext)).toBe(true);
    });

    it('should enforce CSRF for cookie-based delivery', () => {
      const cookieConfig: NAuthConfig = {
        ...mockConfig,
        tokenDelivery: { method: 'cookies' as const },
      };
      const cookieGuard = new CsrfGuard(cookieConfig, mockCsrfService, mockReflector);
      const ctx = createHttpContext({
        method: 'POST',
        headers: { 'x-csrf-token': 'token123' },
        cookies: { nauth_csrf_token: 'token123', nauth_access_token: 'access-token' },
      });
      expect(cookieGuard.canActivate(ctx)).toBe(true);
    });

    it('should throw error when CSRF token missing in header', () => {
      const cookieConfig: NAuthConfig = {
        ...mockConfig,
        tokenDelivery: { method: 'cookies' as const },
      };
      const cookieGuard = new CsrfGuard(cookieConfig, mockCsrfService, mockReflector);
      const ctx = createHttpContext({
        method: 'POST',
        headers: {},
        cookies: { nauth_access_token: 'access-token' },
      });
      expect(() => cookieGuard.canActivate(ctx)).toThrow(NAuthException);
      try {
        cookieGuard.canActivate(ctx);
      } catch (error) {
        expect((error as NAuthException).code).toBe(AuthErrorCode.CSRF_TOKEN_MISSING);
      }
    });

    it('should throw error when CSRF token missing in cookie', () => {
      const cookieConfig: NAuthConfig = {
        ...mockConfig,
        tokenDelivery: { method: 'cookies' as const },
      };
      const cookieGuard = new CsrfGuard(cookieConfig, mockCsrfService, mockReflector);
      const ctx = createHttpContext({
        method: 'POST',
        headers: { 'x-csrf-token': 'token123' },
        cookies: { nauth_access_token: 'access-token' },
      });
      expect(() => cookieGuard.canActivate(ctx)).toThrow(NAuthException);
      try {
        cookieGuard.canActivate(ctx);
      } catch (error) {
        expect((error as NAuthException).code).toBe(AuthErrorCode.CSRF_TOKEN_MISSING);
      }
    });

    it('should throw error when CSRF tokens do not match', () => {
      const cookieConfig: NAuthConfig = {
        ...mockConfig,
        tokenDelivery: { method: 'cookies' as const },
      };
      const cookieGuard = new CsrfGuard(cookieConfig, mockCsrfService, mockReflector);
      const ctx = createHttpContext({
        method: 'POST',
        headers: { 'x-csrf-token': 'token123' },
        cookies: { nauth_csrf_token: 'token456', nauth_access_token: 'access-token' },
      });
      // The guard compares tokens directly, not using validateToken
      expect(() => cookieGuard.canActivate(ctx)).toThrow(NAuthException);
      try {
        cookieGuard.canActivate(ctx);
      } catch (error) {
        expect((error as NAuthException).code).toBe(AuthErrorCode.CSRF_TOKEN_INVALID);
      }
    });
  });
});
