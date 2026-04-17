/**
 * Cookie Utilities Unit Tests
 *
 * Tests cookie clearing functionality.
 */

import { clearAuthCookies } from './cookies.util';
import { NAuthConfig } from '../interfaces/config.interface';

describe('clearAuthCookies', () => {
  it('should clear cookies using Express-style cookie method', () => {
    const mockRes = {
      cookie: jest.fn(),
    };

    clearAuthCookies(mockRes);

    expect(mockRes.cookie).toHaveBeenCalledWith('nauth_access_token', '', expect.any(Object));
    expect(mockRes.cookie).toHaveBeenCalledWith('nauth_refresh_token', '', expect.any(Object));
    expect(mockRes.cookie).toHaveBeenCalledWith('nauth_csrf_token', '', expect.any(Object));
  });

  it('should clear cookies using Fastify-style setCookie method', () => {
    const mockRes = {
      setCookie: jest.fn(),
    };

    clearAuthCookies(mockRes);

    expect(mockRes.setCookie).toHaveBeenCalledWith('nauth_access_token', '', expect.any(Object));
    expect(mockRes.setCookie).toHaveBeenCalledWith('nauth_refresh_token', '', expect.any(Object));
    expect(mockRes.setCookie).toHaveBeenCalledWith('nauth_csrf_token', '', expect.any(Object));
  });

  it('should clear device token cookie when forgetDevice is true', () => {
    const mockRes = {
      cookie: jest.fn(),
    };

    clearAuthCookies(mockRes, undefined, undefined, true);

    expect(mockRes.cookie).toHaveBeenCalledWith('nauth_device_token', '', expect.any(Object));
  });

  it('should not clear device token cookie when forgetDevice is false', () => {
    const mockRes = {
      cookie: jest.fn(),
    };

    clearAuthCookies(mockRes, undefined, undefined, false);

    const deviceTokenCall = (mockRes.cookie as jest.Mock).mock.calls.find((call) => call[0] === 'nauth_device_token');
    expect(deviceTokenCall).toBeUndefined();
  });

  it('should use custom cookie names from config', () => {
    const mockRes = {
      cookie: jest.fn(),
    };
    const config = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      tokenDelivery: {
        cookieNamePrefix: 'myapp_',
      },
    } as NAuthConfig;

    clearAuthCookies(mockRes, config);

    expect(mockRes.cookie).toHaveBeenCalledWith('myapp_access_token', '', expect.any(Object));
    expect(mockRes.cookie).toHaveBeenCalledWith('myapp_refresh_token', '', expect.any(Object));
  });

  it('should apply cookie options', () => {
    const mockRes = {
      cookie: jest.fn(),
    };
    const cookieOptions = {
      domain: '.example.com',
      path: '/api',
      secure: true,
      sameSite: 'lax' as const,
    };

    clearAuthCookies(mockRes, cookieOptions);

    expect(mockRes.cookie).toHaveBeenCalledWith(
      expect.any(String),
      '',
      expect.objectContaining({
        domain: '.example.com',
        path: '/api',
        secure: true,
        sameSite: 'lax',
        maxAge: 0,
      }),
    );
  });

  it('should use CSRF cookie options with httpOnly: false', () => {
    const mockRes = {
      cookie: jest.fn(),
    };

    clearAuthCookies(mockRes);

    const csrfCall = (mockRes.cookie as jest.Mock).mock.calls.find((call) => call[0] === 'nauth_csrf_token');
    expect(csrfCall).toBeDefined();
    expect(csrfCall[2].httpOnly).toBe(false);
  });
});
