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
        }),
      );
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

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find(
        (call) => call[0].includes('access'),
      );
      expect(accessCookieCall[2].maxAge).toBe(3600000); // 1 hour in ms

      const refreshCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find(
        (call) => call[0].includes('refresh'),
      );
      expect(refreshCookieCall[2].maxAge).toBe(604800000); // 7 days in ms
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

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find(
        (call) => call[0].includes('access'),
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

      const accessCookieCall = (mockResponse.setCookie as jest.Mock).mock.calls.find(
        (call) => call[0].includes('access'),
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
});
