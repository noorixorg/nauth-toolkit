/**
 * CSRF Service Unit Tests
 *
 * Tests CSRF token generation and validation functionality.
 */

import { CsrfService } from './csrf.service';
import { NAuthConfig } from '../interfaces/config.interface';

describe('CsrfService', () => {
  let service: CsrfService;
  let mockConfig: NAuthConfig;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: {
          secret: 'test-secret',
          expiresIn: 3600,
        },
        refreshToken: {
          secret: 'test-secret',
          expiresIn: 86400,
        },
      },
      security: {
        csrf: {
          cookieName: 'test_csrf_token',
          headerName: 'x-test-csrf-token',
          cookieOptions: {
            httpOnly: false,
            secure: true,
            sameSite: 'strict',
          },
        },
      },
    } as NAuthConfig;

    service = new CsrfService(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with custom config', () => {
      expect(service).toBeDefined();
      expect(service.getCookieName()).toBe('test_csrf_token');
      expect(service.getHeaderName()).toBe('x-test-csrf-token');
    });

    it('should use default values when config not provided', () => {
      const defaultConfig = {
        jwt: {
          accessToken: { secret: 'test', expiresIn: 3600 },
          refreshToken: { secret: 'test', expiresIn: 86400 },
        },
      } as NAuthConfig;

      const defaultService = new CsrfService(defaultConfig);
      expect(defaultService.getCookieName()).toBe('nauth_csrf_token');
      expect(defaultService.getHeaderName()).toBe('x-csrf-token');
    });
  });

  describe('generateToken', () => {
    it('should generate a token', () => {
      const token = service.generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateToken', () => {
    it('should return true for matching tokens', () => {
      const token = service.generateToken();
      const isValid = service.validateToken(token, token);
      expect(isValid).toBe(true);
    });

    it('should return false for non-matching tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();
      const isValid = service.validateToken(token1, token2);
      expect(isValid).toBe(false);
    });

    it('should return false when header token is missing', () => {
      const cookieToken = service.generateToken();
      const isValid = service.validateToken('', cookieToken);
      expect(isValid).toBe(false);
    });

    it('should return false when cookie token is missing', () => {
      const headerToken = service.generateToken();
      const isValid = service.validateToken(headerToken, '');
      expect(isValid).toBe(false);
    });

    it('should return false when both tokens are missing', () => {
      const isValid = service.validateToken('', '');
      expect(isValid).toBe(false);
    });
  });

  describe('getCookieName', () => {
    it('should return configured cookie name', () => {
      expect(service.getCookieName()).toBe('test_csrf_token');
    });
  });

  describe('getHeaderName', () => {
    it('should return configured header name', () => {
      expect(service.getHeaderName()).toBe('x-test-csrf-token');
    });
  });

  describe('getCookieOptions', () => {
    it('should return configured cookie options', () => {
      const options = service.getCookieOptions();
      expect(options).toEqual({
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
      });
    });
  });
});
