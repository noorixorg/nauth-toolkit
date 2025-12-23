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
});


