/**
 * Token Delivery Handler Unit Tests
 *
 * Tests token delivery via cookies or JSON based on configuration.
 */

import 'reflect-metadata';
import { TokenDeliveryHandler } from './token-delivery.handler';
import { NAuthConfig, NAuthLogger } from '../index';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

describe('TokenDeliveryHandler', () => {
  let handler: TokenDeliveryHandler;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockRequest: jest.Mocked<NAuthRequest>;
  let mockResponse: jest.Mocked<NAuthResponse>;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      tokenDelivery: {
        method: 'json',
      },
    } as NAuthConfig;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockRequest = {
      attributes: {},
      raw: {},
    } as any;

    mockResponse = {
      setCookie: jest.fn(),
    } as any;

    handler = new TokenDeliveryHandler(mockConfig, mockLogger);
  });

  describe('handleResponse', () => {
    it('should return body as-is for JSON mode', async () => {
      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
        user: { sub: 'user-1' },
      };

      const result = await handler.handleResponse(mockRequest, mockResponse, body);

      expect(result).toEqual(body);
      expect(mockLogger.debug).toHaveBeenCalledWith('Tokens delivered via JSON');
    });

    it('should set cookies and remove tokens from body in cookies mode', async () => {
      mockConfig.tokenDelivery = { method: 'cookies' };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
        accessTokenExpiresAt: 1000,
        refreshTokenExpiresAt: 2000,
        user: { sub: 'user-1' },
      };

      const result = await handler.handleResponse(mockRequest, mockResponse, body);

      expect(mockResponse.setCookie).toHaveBeenCalledTimes(2);
      expect((result as any).accessToken).toBeUndefined();
      expect((result as any).refreshToken).toBeUndefined();
      expect((result as any).accessTokenExpiresAt).toBeUndefined();
      expect((result as any).refreshTokenExpiresAt).toBeUndefined();
      expect((result as any).user).toEqual({ sub: 'user-1' });
      expect(mockLogger.debug).toHaveBeenCalledWith('Tokens delivered via cookies');
    });

    it('should return non-auth response body unchanged', async () => {
      const body = { message: 'Success', data: { id: 1 } };

      const result = await handler.handleResponse(mockRequest, mockResponse, body);

      expect(result).toEqual(body);
      expect(mockResponse.setCookie).not.toHaveBeenCalled();
    });

    it('should handle route override for token delivery', async () => {
      mockRequest.attributes['nauthTokenDelivery'] = 'cookies';
      mockConfig.tokenDelivery = { method: 'json' };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      expect(mockResponse.setCookie).toHaveBeenCalled();
    });

    it('should handle hybrid mode', async () => {
      mockConfig.tokenDelivery = {
        method: 'hybrid',
        hybridPolicy: {
          webOrigins: ['https://example.com'],
          nativeOrigins: ['mobile://app'],
        },
      };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      // Should resolve based on hybrid policy
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should set cookies with correct options', async () => {
      mockConfig.tokenDelivery = {
        method: 'cookies',
        cookieOptions: {
          secure: true,
          sameSite: 'strict',
          domain: '.example.com',
        },
      };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      expect(mockResponse.setCookie).toHaveBeenCalledWith(
        expect.any(String),
        'token-123',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          domain: '.example.com',
          path: '/',
          priority: 'high',
        }),
      );
    });

    it('should set cookies with custom cookie priority when configured', async () => {
      mockConfig.tokenDelivery = {
        method: 'cookies',
        cookieOptions: {
          priority: 'low',
        },
      };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls[0];
      expect(accessCookieCall[2]).toMatchObject({ priority: 'low' });
    });

    it('should parse expiry string correctly', async () => {
      mockConfig.jwt = {
        accessToken: { secret: 'test', expiresIn: '1h' },
        refreshToken: { secret: 'test', expiresIn: '7d' },
      };
      mockConfig.tokenDelivery = { method: 'cookies' };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find((call) =>
        call[0].includes('access'),
      );
      expect(accessCookieCall[2].maxAge).toBe(3600000); // 1 hour in ms

      const refreshCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find((call) =>
        call[0].includes('refresh'),
      );
      expect(refreshCookieCall[2].maxAge).toBe(604800000); // 7 days in ms
    });

    it('should align refresh cookie maxAge with hybridPolicy.cookieRefreshExpiresIn when set', async () => {
      mockConfig.jwt = {
        accessToken: { secret: 'test', expiresIn: '15m' },
        refreshToken: { secret: 'test', expiresIn: '30d' },
      };
      mockConfig.tokenDelivery = {
        method: 'hybrid',
        hybridPolicy: {
          webOrigins: ['https://web.example.com'],
          nativeOrigins: ['mobile://app'],
          cookieRefreshExpiresIn: '7d',
          jsonRefreshExpiresIn: '90d',
        },
      };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);
      (mockRequest as any).raw = { headers: { origin: 'https://web.example.com' } };

      await handler.handleResponse(mockRequest, mockResponse, {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      });

      const refreshCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find((call) =>
        call[0].includes('refresh'),
      );
      expect(refreshCookieCall[2].maxAge).toBe(604800000); // 7d, not 30d
    });

    it('should fall back to jwt.refreshToken.expiresIn when hybrid override is unset', async () => {
      mockConfig.jwt = {
        accessToken: { secret: 'test', expiresIn: '15m' },
        refreshToken: { secret: 'test', expiresIn: '30d' },
      };
      mockConfig.tokenDelivery = {
        method: 'hybrid',
        hybridPolicy: {
          webOrigins: ['https://web.example.com'],
          // No cookieRefreshExpiresIn set
        },
      };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);
      (mockRequest as any).raw = { headers: { origin: 'https://web.example.com' } };

      await handler.handleResponse(mockRequest, mockResponse, {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      });

      const refreshCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find((call) =>
        call[0].includes('refresh'),
      );
      expect(refreshCookieCall[2].maxAge).toBe(2592000000); // 30d from config
    });

    it('should handle numeric expiry', async () => {
      mockConfig.jwt = {
        accessToken: { secret: 'test', expiresIn: 1800 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      };
      mockConfig.tokenDelivery = { method: 'cookies' };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find((call) =>
        call[0].includes('access'),
      );
      expect(accessCookieCall[2].maxAge).toBe(1800000); // 1800 seconds in ms
    });

    it('should use default expiry for invalid format', async () => {
      mockConfig.jwt = {
        accessToken: { secret: 'test', expiresIn: 'invalid' as any },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      };
      mockConfig.tokenDelivery = { method: 'cookies' };
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);

      const body = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };

      await handler.handleResponse(mockRequest, mockResponse, body);

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find((call) =>
        call[0].includes('access'),
      );
      expect(accessCookieCall[2].maxAge).toBe(900000); // Default 15 minutes in ms
    });

    it('should handle null body', async () => {
      const result = await handler.handleResponse(mockRequest, mockResponse, null);

      expect(result).toBeNull();
      expect(mockResponse.setCookie).not.toHaveBeenCalled();
    });

    it('should handle body without tokens', async () => {
      const body = { user: { sub: 'user-1' }, message: 'Success' };

      const result = await handler.handleResponse(mockRequest, mockResponse, body);

      expect(result).toEqual(body);
      expect(mockResponse.setCookie).not.toHaveBeenCalled();
    });
  });

  describe('route override conflicts', () => {
    const body = { accessToken: 'token-123', refreshToken: 'refresh-456', user: { sub: 'user-1' } };

    /** Build a handler whose config conflicts with the override the route will ask for. */
    const setup = (
      method: 'json' | 'cookies' | 'hybrid',
      override: 'json' | 'cookies',
      strictOverrides?: boolean,
    ): void => {
      mockConfig.tokenDelivery = { ...mockConfig.tokenDelivery, method, strictOverrides };
      mockRequest.attributes['nauthTokenDelivery'] = override;
      handler = new TokenDeliveryHandler(mockConfig, mockLogger);
    };

    it('should warn and honour a JSON override under cookies mode by default', async () => {
      setup('cookies', 'json');

      const result = await handler.handleResponse(mockRequest, mockResponse, body);

      // Honoured: tokens stay in the body and no cookies are set.
      expect(result).toEqual(body);
      expect(mockResponse.setCookie).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('tokenDelivery.method'));
    });

    it('should warn and honour a cookie override under json mode by default', async () => {
      setup('json', 'cookies');

      const result = await handler.handleResponse(mockRequest, mockResponse, body);

      expect(mockResponse.setCookie).toHaveBeenCalled();
      expect(result).not.toHaveProperty('accessToken');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw when strictOverrides is enabled', async () => {
      setup('cookies', 'json', true);

      await expect(handler.handleResponse(mockRequest, mockResponse, body)).rejects.toMatchObject({
        code: 'AUTH_BEARER_NOT_ALLOWED',
      });
    });

    it('should throw COOKIES_NOT_ALLOWED for the mirrored conflict', async () => {
      setup('json', 'cookies', true);

      await expect(handler.handleResponse(mockRequest, mockResponse, body)).rejects.toMatchObject({
        code: 'AUTH_COOKIES_NOT_ALLOWED',
      });
    });

    it('should accept either override under hybrid mode without warning', async () => {
      for (const override of ['json', 'cookies'] as const) {
        mockLogger.warn.mockClear();
        setup('hybrid', override, true);

        await handler.handleResponse(mockRequest, mockResponse, body);

        expect(mockLogger.warn).not.toHaveBeenCalled();
      }
    });

    it('should not warn when the override agrees with the configured method', async () => {
      setup('cookies', 'cookies', true);

      await handler.handleResponse(mockRequest, mockResponse, body);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
