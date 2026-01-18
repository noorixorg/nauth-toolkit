import { TokenDeliveryHttpService } from './token-delivery-http.service';
import { NAuthConfig, AuthErrorCode, NAuthException } from '@nauth-toolkit/core';
import { JwtService } from '@nauth-toolkit/core/internal';

describe('TokenDeliveryHttpService', () => {
  const makeConfig = (method: 'cookies' | 'json' | 'hybrid'): NAuthConfig =>
    ({
      jwt: {
        algorithm: 'HS256',
        issuer: 'test',
        audience: ['web'],
        accessToken: { secret: 's', expiresIn: '15m' },
        refreshToken: { secret: 's2', expiresIn: '1d' },
      },
      tokenDelivery: { method },
      security: {
        csrf: {
          cookieName: 'nauth_csrf_token',
          headerName: 'x-csrf-token',
          cookieOptions: {},
        },
      },
    }) as unknown as NAuthConfig;

  it('should resolve effective delivery in cookies mode', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    expect(svc.resolveEffectiveDelivery({ headers: {} })).toBe('cookies');
  });

  it('should throw when route requests cookies but global is json', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('json'), jwt, undefined);
    expect(() => svc.resolveEffectiveDelivery({ headers: {} }, 'cookies')).toThrow(NAuthException);
    try {
      svc.resolveEffectiveDelivery({ headers: {} }, 'cookies');
    } catch (e) {
      expect((e as NAuthException).code).toBe(AuthErrorCode.COOKIES_NOT_ALLOWED);
    }
  });

  it('should set access and refresh cookies using JWT exp', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = {
      decodeToken: jest.fn((token: string) => ({ exp: token === 'a' ? nowSec + 60 : nowSec + 3600 })),
    } as unknown as JwtService;
    const cfg = makeConfig('cookies');
    const svc = new TokenDeliveryHttpService(cfg, jwt, undefined);

    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const res = {
      setCookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    };

    svc.setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' });
    expect(cookies.find((c) => c.name.includes('access_token'))).toBeTruthy();
    expect(cookies.find((c) => c.name.includes('refresh_token'))).toBeTruthy();
  });

  it('should set device token cookie', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = {
      decodeToken: jest.fn(() => ({ exp: nowSec + 60 })),
    } as unknown as JwtService;
    const cfg = makeConfig('cookies');
    const svc = new TokenDeliveryHttpService(cfg, jwt, undefined);

    const cookies: Array<{ name: string; value: string }> = [];
    const res = {
      setCookie: (name: string, value: string) => {
        cookies.push({ name, value });
      },
    };

    svc.setDeviceTokenCookie(res, 'devtok');
    expect(cookies.find((c) => c.name.includes('device_token'))).toBeTruthy();
  });

  it('should throw when deviceToken is empty', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const res = { setCookie: jest.fn() };

    expect(() => svc.setDeviceTokenCookie(res, '')).toThrow(NAuthException);
    try {
      svc.setDeviceTokenCookie(res, '');
    } catch (e) {
      expect((e as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
    }
  });

  it('should resolve effective delivery in json mode', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('json'), jwt, undefined);
    expect(svc.resolveEffectiveDelivery({ headers: {} })).toBe('json');
  });

  it('should throw when route requests json but global is cookies', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    expect(() => svc.resolveEffectiveDelivery({ headers: {} }, 'json')).toThrow(NAuthException);
    try {
      svc.resolveEffectiveDelivery({ headers: {} }, 'json');
    } catch (e) {
      expect((e as NAuthException).code).toBe(AuthErrorCode.BEARER_NOT_ALLOWED);
    }
  });

  it('should resolve hybrid mode delivery', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const cfg = {
      ...makeConfig('hybrid'),
      tokenDelivery: {
        method: 'hybrid' as const,
        hybridPolicy: { default: 'cookies' as const },
      },
    } as any;
    const svc = new TokenDeliveryHttpService(cfg, jwt, undefined);
    const result = svc.resolveEffectiveDelivery({ headers: {} });
    expect(['cookies', 'json']).toContain(result);
  });

  it('should throw when access token missing exp claim', () => {
    const jwt = { decodeToken: jest.fn(() => ({})) } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const res = { setCookie: jest.fn() };

    expect(() => svc.setAuthCookies(res, { accessToken: 'token' })).toThrow(NAuthException);
    try {
      svc.setAuthCookies(res, { accessToken: 'token' });
    } catch (e) {
      expect((e as NAuthException).code).toBe(AuthErrorCode.TOKEN_INVALID);
    }
  });

  it('should throw when access token already expired', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = { decodeToken: jest.fn(() => ({ exp: nowSec - 60 })) } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const res = { setCookie: jest.fn() };

    expect(() => svc.setAuthCookies(res, { accessToken: 'token' })).toThrow(NAuthException);
  });

  it('should throw when refresh token missing exp claim', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = {
      decodeToken: jest.fn((token: string) => (token === 'a' ? { exp: nowSec + 60 } : {})),
    } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const res = { setCookie: jest.fn() };

    expect(() => svc.setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' })).toThrow(NAuthException);
  });

  it('should set CSRF cookie when csrfService is available', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = { decodeToken: jest.fn(() => ({ exp: nowSec + 60 })) } as unknown as JwtService;
    const mockCsrfService = {
      generateToken: jest.fn().mockReturnValue('csrf-token'),
      getCookieName: jest.fn().mockReturnValue('nauth_csrf_token'),
      getCookieOptions: jest.fn().mockReturnValue({ httpOnly: false }),
    };
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, mockCsrfService as any);
    const cookies: Array<{ name: string; value: string }> = [];
    const res = {
      setCookie: (name: string, value: string) => {
        cookies.push({ name, value });
      },
    };

    svc.setCsrfCookie(res, 'access-token');
    expect(mockCsrfService.generateToken).toHaveBeenCalled();
    expect(cookies.find((c) => c.name === 'nauth_csrf_token')).toBeTruthy();
  });

  it('should not set CSRF cookie when csrfService is not available', () => {
    const jwt = { decodeToken: jest.fn() } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const res = { setCookie: jest.fn() };

    svc.setCsrfCookie(res, 'token');
    expect(res.setCookie).not.toHaveBeenCalled();
  });

  it('should use Express cookie method when available', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = { decodeToken: jest.fn(() => ({ exp: nowSec + 60 })) } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const cookies: Array<{ name: string; value: string }> = [];
    const res = {
      cookie: (name: string, value: string) => {
        cookies.push({ name, value });
      },
    };

    svc.setAuthCookies(res, { accessToken: 'token' });
    expect(cookies.length).toBeGreaterThan(0);
  });

  it('should throw when response does not support cookies', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = { decodeToken: jest.fn(() => ({ exp: nowSec + 60 })) } as unknown as JwtService;
    const svc = new TokenDeliveryHttpService(makeConfig('cookies'), jwt, undefined);
    const res = {}; // No cookie or setCookie method

    expect(() => svc.setAuthCookies(res, { accessToken: 'token' })).toThrow(NAuthException);
  });
});


