/**
 * Request Unit Tests
 *
 * Tests HTTP request functionality.
 */

import { httpRequest } from './request';
import { ResolvedNAuthClientConfig, defaultEndpoints } from './config';
import { NAuthEndpoints } from '../types/config.types';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';
import { InMemoryStorage } from '../storage/memory';
import { HttpAdapter } from './http-adapter';

// Mock fetch globally
global.fetch = jest.fn();

describe('httpRequest', () => {
  let mockConfig: ResolvedNAuthClientConfig;
  let mockEndpoints: NAuthEndpoints;

  beforeEach(() => {
    const mockHttpAdapter: HttpAdapter = {
      request: jest.fn(),
    };

    mockConfig = {
      baseUrl: 'https://api.example.com',
      headers: {},
      tokenDelivery: 'json',
      endpoints: defaultEndpoints,
      httpAdapter: mockHttpAdapter,
      timeout: 30000,
      csrf: {
        cookieName: 'nauth_csrf_token',
        headerName: 'x-csrf-token',
      },
      deviceTrust: {
        storageKey: 'nauth_device_token',
        headerName: 'x-device-token',
      },
      storage: new InMemoryStorage(),
    } as ResolvedNAuthClientConfig;

    mockEndpoints = {} as NAuthEndpoints;

    (global.fetch as jest.Mock).mockClear();
  });

  describe('buildUrl', () => {
    it('should build URL from base and path', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.any(Object),
      );
    });

    it('should handle absolute URLs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, 'https://other.com/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://other.com/test',
        expect.any(Object),
      );
    });
  });

  describe('JSON mode', () => {
    it('should add Authorization header with Bearer token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        accessToken: 'token123',
        tokenDelivery: 'json',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer token123');
    });

    it('should not add credentials for JSON mode', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[1].credentials).toBeUndefined();
    });
  });

  describe('Cookies mode', () => {
    it('should set credentials to include', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'cookies',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[1].credentials).toBe('include');
    });
  });

  describe('error handling', () => {
    it('should throw NAuthClientError on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        httpRequest(mockConfig, mockEndpoints, '/test', {
          method: 'GET',
          tokenDelivery: 'json',
        }),
      ).rejects.toThrow(NAuthClientError);

      await expect(
        httpRequest(mockConfig, mockEndpoints, '/test', {
          method: 'GET',
          tokenDelivery: 'json',
        }),
      ).rejects.toMatchObject({
        code: NAuthErrorCode.INTERNAL_ERROR,
        isNetworkError: true,
      });
    });

    it('should throw NAuthClientError on HTTP error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            code: NAuthErrorCode.VALIDATION_FAILED,
            message: 'Validation failed',
          }),
        ),
      });

      await expect(
        httpRequest(mockConfig, mockEndpoints, '/test', {
          method: 'POST',
          body: {},
          tokenDelivery: 'json',
        }),
      ).rejects.toThrow(NAuthClientError);

      await expect(
        httpRequest(mockConfig, mockEndpoints, '/test', {
          method: 'POST',
          body: {},
          tokenDelivery: 'json',
        }),
      ).rejects.toMatchObject({
        code: NAuthErrorCode.VALIDATION_FAILED,
        statusCode: 400,
      });
    });
  });

  describe('response parsing', () => {
    it('should parse JSON response', async () => {
      const responseData = { data: 'test' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
      });

      const result = await httpRequest<typeof responseData>(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      expect(result.data).toEqual(responseData);
      expect(result.status).toBe(200);
    });

    it('should handle non-JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('plain text'),
      });

      const result = await httpRequest<string>(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      expect(result.data).toBe('plain text');
    });

    it('should handle empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 204,
        text: jest.fn().mockResolvedValue(''),
      });

      const result = await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'DELETE',
        tokenDelivery: 'json',
      });

      expect(result.data).toBeNull();
      expect(result.status).toBe(204);
    });
  });

  describe('device token handling', () => {
    it('should add device token header in JSON mode when available', async () => {
      await mockConfig.storage.setItem(mockConfig.deviceTrust.storageKey, 'device-token-123');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get(mockConfig.deviceTrust.headerName)).toBe('device-token-123');
    });

    it('should not add device token header when not available', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get(mockConfig.deviceTrust.headerName)).toBeNull();
    });
  });

  describe('CSRF header handling', () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    beforeEach(() => {
      (global as any).window = {
        document: {
          cookie: 'nauth_csrf_token=csrf123; other=value',
        },
      };
      (global as any).document = (global as any).window.document;
    });

    afterEach(() => {
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
    });

    it('should add CSRF header for POST requests in cookies mode', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'POST',
        body: {},
        tokenDelivery: 'cookies',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('csrf123');
    });

    it('should not add CSRF header for GET requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'cookies',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('x-csrf-token')).toBeNull();
    });
  });

  describe('URL building', () => {
    it('should normalize base URL without trailing slash', async () => {
      mockConfig.baseUrl = 'https://api.example.com/';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', expect.any(Object));
    });

    it('should normalize path without leading slash', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, 'test', {
        method: 'GET',
        tokenDelivery: 'json',
      });

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', expect.any(Object));
    });
  });

  describe('body handling', () => {
    it('should stringify body for non-GET requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      const body = { key: 'value' };
      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'POST',
        body,
        tokenDelivery: 'json',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[1].body).toBe(JSON.stringify(body));
    });

    it('should set Content-Type header for non-GET requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      });

      await httpRequest(mockConfig, mockEndpoints, '/test', {
        method: 'POST',
        body: {},
        tokenDelivery: 'json',
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });
  });
});
