import { CookieTokenInterceptor } from './cookie-token.interceptor';
import { NAuthConfig, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { JwtService } from '@nauth-toolkit/core/internal';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TOKEN_DELIVERY_KEY } from '../decorators/token-delivery.decorator';
import { TokenDeliveryHttpService } from '../services/token-delivery-http.service';

function createHttpContextMock(origin: string = 'http://web.example.com') {
  const cookiesSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      cookiesSet.push({ name, value, options });
    },
  } as any;

  const ctx = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ headers: { origin } }) }),
    getHandler: () => ({}) as any,
  } as unknown as ExecutionContext;

  return { ctx, cookiesSet };
}

describe('CookieTokenInterceptor', () => {
  const jwtMock: Partial<JwtService> = {
    decodeToken: (token: string) => {
      // Very simple mock: parse suffix ":exp=<seconds>" if present, else return a fixed exp in the future
      const match = /exp=(\d+)/.exec(token);
      const exp = match ? parseInt(match[1], 10) : Math.floor(Date.now() / 1000) + 900;
      return { exp } as any;
    },
  };
  const reflector = { get: () => undefined } as unknown as Reflector;

  function createTokenDeliveryService(config: NAuthConfig, cookiesSet?: Array<{ name: string; value: string; options: Record<string, unknown> }>): TokenDeliveryHttpService {
    return {
      resolveEffectiveDelivery: jest.fn((req: any, routeMode?: any) => {
        const method = config.tokenDelivery?.method || 'json';

        // Validate route override against global configuration (mimicking real behavior)
        if (routeMode === 'cookies' && method === 'json') {
          throw new NAuthException(
            AuthErrorCode.COOKIES_NOT_ALLOWED,
            "Route-level cookie delivery requested, but tokenDelivery.method is 'json' (cookies disabled)",
          );
        }
        if (routeMode === 'json' && method === 'cookies') {
          throw new NAuthException(
            AuthErrorCode.BEARER_NOT_ALLOWED,
            "Route-level JSON delivery requested, but tokenDelivery.method is 'cookies' (JSON/Bearer tokens disabled)",
          );
        }

        // If route mode is specified and valid, use it
        if (routeMode) {
          return routeMode;
        }

        // In hybrid mode, default to cookies if no origin or unknown origin
        if (method === 'hybrid') {
          const origin = req?.headers?.origin;
          if (!origin || !origin.includes('example.com')) {
            return 'cookies'; // Default to cookies for unknown origins
          }
          return 'json'; // Use json for known web origins
        }
        return method;
      }),
      setAuthCookies: jest.fn((res: any, tokens: any) => {
        // Mock implementation that actually sets cookies via res.cookie
        // Check for exp claim in tokens (mimicking real behavior)
        if (tokens.accessToken) {
          const match = /exp=(\d+)/.exec(tokens.accessToken);
          if (!match) {
            // Token missing exp claim - throw error like real implementation
            throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Access token missing exp claim; refusing to set cookies');
          }
        }
        if (tokens.refreshToken) {
          const match = /exp=(\d+)/.exec(tokens.refreshToken);
          if (!match) {
            throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Refresh token missing exp claim; refusing to set cookies');
          }
        }

        if (res.cookie && cookiesSet) {
          const cookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' };
          if (tokens.accessToken) {
            res.cookie('nauth_access_token', tokens.accessToken, { ...cookieOptions, maxAge: 900000 });
            cookiesSet.push({ name: 'nauth_access_token', value: tokens.accessToken, options: cookieOptions });
          }
          if (tokens.refreshToken) {
            res.cookie('nauth_refresh_token', tokens.refreshToken, { ...cookieOptions, maxAge: 3600000 });
            cookiesSet.push({ name: 'nauth_refresh_token', value: tokens.refreshToken, options: cookieOptions });
          }
          if (tokens.deviceToken) {
            res.cookie('nauth_device_token', tokens.deviceToken, cookieOptions);
            cookiesSet.push({ name: 'nauth_device_token', value: tokens.deviceToken, options: cookieOptions });
          }
        }
      }),
      setCsrfCookie: jest.fn(),
      setDeviceTokenCookie: jest.fn((res: any, deviceToken: string) => {
        if (res.cookie && cookiesSet) {
          const cookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' };
          res.cookie('nauth_device_token', deviceToken, cookieOptions);
          cookiesSet.push({ name: 'nauth_device_token', value: deviceToken, options: cookieOptions });
        }
      }),
    } as unknown as TokenDeliveryHttpService;
  }

  it('sets cookies and removes tokens in cookie mode', (done) => {
    const config = { tokenDelivery: { method: 'cookies' } } as unknown as NAuthConfig;
    const { ctx, cookiesSet } = createHttpContextMock();
    const tokenDeliveryService = createTokenDeliveryService(config, cookiesSet);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflector);

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
          refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    interceptor.intercept(ctx, next).subscribe((result: any) => {
      expect(cookiesSet.find((c) => c.name === 'nauth_access_token')).toBeTruthy();
      expect(cookiesSet.find((c) => c.name === 'nauth_refresh_token')).toBeTruthy();
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(result.user).toBeTruthy();
      done();
    });
  });

  it('is a no-op in json mode', (done) => {
    const config = { tokenDelivery: { method: 'json' } } as unknown as NAuthConfig;
    const { ctx, cookiesSet } = createHttpContextMock();
    const tokenDeliveryService = createTokenDeliveryService(config, cookiesSet);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflector);

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    interceptor.intercept(ctx, next).subscribe((result: any) => {
      expect(cookiesSet.length).toBe(0);
      // Tokens are returned as-is with their exp suffix from mock
      expect(result.accessToken).toContain('access');
      expect(result.refreshToken).toContain('refresh');
      done();
    });
  });

  it('does not throw for non-object responses (e.g. health checks)', (done) => {
    const config = { tokenDelivery: { method: 'cookies' } } as unknown as NAuthConfig;
    const { ctx, cookiesSet } = createHttpContextMock();
    const tokenDeliveryService = createTokenDeliveryService(config, cookiesSet);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflector);

    const next: CallHandler = {
      handle: () => of('Hello World!'),
    } as any;

    interceptor.intercept(ctx, next).subscribe((result: any) => {
      expect(cookiesSet.length).toBe(0);
      expect(result).toBe('Hello World!');
      done();
    });
  });

  it('in strict hybrid, defaults to cookies and strips tokens (safe default)', (done) => {
    const config = { tokenDelivery: { method: 'hybrid' } } as unknown as NAuthConfig;
    const { ctx, cookiesSet } = createHttpContextMock('http://unknown-origin');
    const tokenDeliveryService = createTokenDeliveryService(config, cookiesSet);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflector);

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
          refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    interceptor.intercept(ctx, next).subscribe((result: any) => {
      expect(cookiesSet.find((c) => c.name === 'nauth_access_token')).toBeTruthy();
      expect(cookiesSet.find((c) => c.name === 'nauth_refresh_token')).toBeTruthy();
      // Strict hybrid defaults to cookies (no tokens in body for web-like paths)
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      done();
    });
  });

  it('throws when exp claim is missing (no insecure fallback)', (done) => {
    const config = { tokenDelivery: { method: 'cookies' } } as unknown as NAuthConfig;
    const badJwtMock: Partial<JwtService> = {
      decodeToken: () => ({}) as any,
    };
    const tokenDeliveryService = createTokenDeliveryService(config);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflector);
    const { ctx } = createHttpContextMock();

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: 'access',
          refreshToken: 'refresh',
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    interceptor.intercept(ctx, next).subscribe({
      next: () => {
        // This should not be called - error is expected
        expect(true).toBe(false); // Force test failure
        done();
      },
      error: () => {
        done();
      },
    });
  });

  it('throws when route requests cookies but config is json', (done) => {
    const config = { tokenDelivery: { method: 'json' } } as unknown as NAuthConfig;
    const reflectorWithCookies = {
      get: (key: string) => (key === TOKEN_DELIVERY_KEY ? 'cookies' : undefined),
    } as unknown as Reflector;
    const tokenDeliveryService = createTokenDeliveryService(config);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflectorWithCookies);
    const { ctx } = createHttpContextMock();

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    // Error is thrown synchronously in intercept(), not in observable chain
    try {
      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(true).toBe(false); // Should not succeed
          done();
        },
        error: (err) => {
          expect(err).toBeInstanceOf(NAuthException);
          expect((err as NAuthException).code).toBe(AuthErrorCode.COOKIES_NOT_ALLOWED);
          done();
        },
      });
    } catch (err) {
      // Catch synchronous error
      expect(err).toBeInstanceOf(NAuthException);
      expect((err as NAuthException).code).toBe(AuthErrorCode.COOKIES_NOT_ALLOWED);
      done();
    }
  });

  it('throws when route requests json but config is cookies', (done) => {
    const config = { tokenDelivery: { method: 'cookies' } } as unknown as NAuthConfig;
    const reflectorWithJson = {
      get: (key: string) => (key === TOKEN_DELIVERY_KEY ? 'json' : undefined),
    } as unknown as Reflector;
    const tokenDeliveryService = createTokenDeliveryService(config);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflectorWithJson);
    const { ctx } = createHttpContextMock();

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    // Error is thrown synchronously in intercept(), not in observable chain
    try {
      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(true).toBe(false); // Should not succeed
          done();
        },
        error: (err) => {
          expect(err).toBeInstanceOf(NAuthException);
          expect((err as NAuthException).code).toBe(AuthErrorCode.BEARER_NOT_ALLOWED);
          done();
        },
      });
    } catch (err) {
      // Catch synchronous error
      expect(err).toBeInstanceOf(NAuthException);
      expect((err as NAuthException).code).toBe(AuthErrorCode.BEARER_NOT_ALLOWED);
      done();
    }
  });

  it('allows cookies route override when config is hybrid', (done) => {
    const config = { tokenDelivery: { method: 'hybrid' } } as unknown as NAuthConfig;
    const reflectorWithCookies = {
      get: (key: string) => (key === TOKEN_DELIVERY_KEY ? 'cookies' : undefined),
    } as unknown as Reflector;
    const { ctx, cookiesSet } = createHttpContextMock();
    const tokenDeliveryService = createTokenDeliveryService(config, cookiesSet);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflectorWithCookies);

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
          refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    interceptor.intercept(ctx, next).subscribe((result: any) => {
      expect(cookiesSet.find((c) => c.name === 'nauth_access_token')).toBeTruthy();
      expect(cookiesSet.find((c) => c.name === 'nauth_refresh_token')).toBeTruthy();
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      done();
    });
  });

  it('allows json route override when config is hybrid', (done) => {
    const config = { tokenDelivery: { method: 'hybrid' } } as unknown as NAuthConfig;
    const reflectorWithJson = {
      get: (key: string) => (key === TOKEN_DELIVERY_KEY ? 'json' : undefined),
    } as unknown as Reflector;
    const { ctx, cookiesSet } = createHttpContextMock();
    const tokenDeliveryService = createTokenDeliveryService(config, cookiesSet);
    const interceptor = new CookieTokenInterceptor(tokenDeliveryService, reflectorWithJson);

    const next: CallHandler = {
      handle: () =>
        of({
          accessToken: `access:exp=${Math.floor(Date.now() / 1000) + 900}`,
          refreshToken: `refresh:exp=${Math.floor(Date.now() / 1000) + 3600}`,
          user: { sub: 'sub', email: 'a@b.c', isEmailVerified: true },
        }),
    } as any;

    interceptor.intercept(ctx, next).subscribe((result: any) => {
      expect(cookiesSet.length).toBe(0); // No cookies set
      expect(result.accessToken).toContain('access');
      expect(result.refreshToken).toContain('refresh');
      done();
    });
  });
});
