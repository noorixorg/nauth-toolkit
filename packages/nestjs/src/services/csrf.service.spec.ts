import { CsrfService } from './csrf.service';
import { NAuthConfig, getCsrfTokenCookieName } from '@nauth-toolkit/core';

/**
 * CSRF Service Unit Tests
 *
 * Tests CSRF token generation and cookie configuration.
 * Uses direct instantiation, no NestJS TestingModule.
 */
describe('CsrfService', () => {
  let service: CsrfService;
  let mockConfig: NAuthConfig;

  beforeEach(() => {
    mockConfig = {
      security: {
        csrf: {
          tokenLength: 32,
          cookieName: 'nauth_csrf_token',
          headerName: 'x-csrf-token',
          cookieOptions: {
            secure: true,
            sameSite: 'strict',
            path: '/',
          },
        },
      },
    } as NAuthConfig;

    // Instantiate service directly (bypassing NestJS decorators)
    service = new CsrfService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate CSRF token', () => {
      const token = service.generateToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should use custom token length from config', () => {
      mockConfig.security!.csrf!.tokenLength = 16;
      const newService = new CsrfService(mockConfig);
      const token = newService.generateToken();

      expect(token.length).toBe(32); // 16 bytes = 32 hex characters
    });

    it('should use default token length when not configured', () => {
      delete mockConfig.security!.csrf!.tokenLength;
      const newService = new CsrfService(mockConfig);
      const token = newService.generateToken();

      expect(token.length).toBe(64); // Default 32 bytes = 64 hex characters
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('getCookieOptions', () => {
    it('should return cookie options with httpOnly false', () => {
      const options = service.getCookieOptions();

      expect(options.httpOnly).toBe(false);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
      expect(options.path).toBe('/');
    });

    it('should use configured cookie options', () => {
      mockConfig.security!.csrf!.cookieOptions = {
        secure: false,
        sameSite: 'lax',
        domain: 'example.com',
        path: '/api',
      };

      const newService = new CsrfService(mockConfig);
      const options = newService.getCookieOptions();

      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
      expect(options.domain).toBe('example.com');
      expect(options.path).toBe('/api');
    });

    it('should use defaults when cookie options not configured', () => {
      delete mockConfig.security!.csrf!.cookieOptions;
      const newService = new CsrfService(mockConfig);
      const options = newService.getCookieOptions();

      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
      expect(options.path).toBe('/');
    });
  });

  describe('getCookieName', () => {
    it('should return configured cookie name', () => {
      const cookieName = service.getCookieName();

      expect(cookieName).toBe('nauth_csrf_token');
    });

    it('should use getCsrfTokenCookieName from core', () => {
      const cookieName = service.getCookieName();
      const expectedName = getCsrfTokenCookieName(mockConfig);

      expect(cookieName).toBe(expectedName);
    });
  });

  describe('getHeaderName', () => {
    it('should return configured header name', () => {
      const headerName = service.getHeaderName();

      expect(headerName).toBe('x-csrf-token');
    });

    it('should use default header name when not configured', () => {
      delete mockConfig.security!.csrf!.headerName;
      const newService = new CsrfService(mockConfig);
      const headerName = newService.getHeaderName();

      expect(headerName).toBe('x-csrf-token');
    });

    it('should use custom header name from config', () => {
      mockConfig.security!.csrf!.headerName = 'x-custom-csrf-token';
      const newService = new CsrfService(mockConfig);
      const headerName = newService.getHeaderName();

      expect(headerName).toBe('x-custom-csrf-token');
    });
  });
});
