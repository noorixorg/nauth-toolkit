/**
 * Cookie Names Utility Unit Tests
 *
 * Tests cookie name generation utilities.
 */

import {
  getCookieNamePrefix,
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  getDeviceTokenCookieName,
  getCsrfTokenCookieName,
} from './cookie-names.util';
import { NAuthConfig } from '../interfaces/config.interface';

describe('Cookie Names Utilities', () => {
  describe('getCookieNamePrefix', () => {
    it('should return default prefix when config not provided', () => {
      expect(getCookieNamePrefix()).toBe('nauth_');
    });

    it('should return default prefix when tokenDelivery not configured', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
      } as NAuthConfig;
      expect(getCookieNamePrefix(config)).toBe('nauth_');
    });

    it('should return configured prefix', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
        tokenDelivery: {
          cookieNamePrefix: 'myapp_',
        },
      } as NAuthConfig;
      expect(getCookieNamePrefix(config)).toBe('myapp_');
    });
  });

  describe('getAccessTokenCookieName', () => {
    it('should return default access token cookie name', () => {
      expect(getAccessTokenCookieName()).toBe('nauth_access_token');
    });

    it('should return cookie name with custom prefix', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
        tokenDelivery: {
          cookieNamePrefix: 'myapp_',
        },
      } as NAuthConfig;
      expect(getAccessTokenCookieName(config)).toBe('myapp_access_token');
    });
  });

  describe('getRefreshTokenCookieName', () => {
    it('should return default refresh token cookie name', () => {
      expect(getRefreshTokenCookieName()).toBe('nauth_refresh_token');
    });

    it('should return cookie name with custom prefix', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
        tokenDelivery: {
          cookieNamePrefix: 'myapp_',
        },
      } as NAuthConfig;
      expect(getRefreshTokenCookieName(config)).toBe('myapp_refresh_token');
    });
  });

  describe('getDeviceTokenCookieName', () => {
    it('should return default device token cookie name', () => {
      expect(getDeviceTokenCookieName()).toBe('nauth_device_token');
    });

    it('should return cookie name with custom prefix', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
        tokenDelivery: {
          cookieNamePrefix: 'myapp_',
        },
      } as NAuthConfig;
      expect(getDeviceTokenCookieName(config)).toBe('myapp_device_token');
    });
  });

  describe('getCsrfTokenCookieName', () => {
    it('should return default CSRF token cookie name', () => {
      expect(getCsrfTokenCookieName()).toBe('nauth_csrf_token');
    });

    it('should return explicitly configured CSRF cookie name', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
        security: {
          csrf: {
            cookieName: 'custom_csrf_token',
          },
        },
      } as NAuthConfig;
      expect(getCsrfTokenCookieName(config)).toBe('custom_csrf_token');
    });

    it('should use prefix when CSRF cookie name not explicitly configured', () => {
      const config = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
        tokenDelivery: {
          cookieNamePrefix: 'myapp_',
        },
      } as NAuthConfig;
      expect(getCsrfTokenCookieName(config)).toBe('myapp_csrf_token');
    });
  });
});
