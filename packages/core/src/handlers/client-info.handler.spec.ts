/**
 * Client Info Handler Unit Tests
 *
 * Tests client information extraction and storage in context.
 */

import 'reflect-metadata';
import { ClientInfoHandler } from './client-info.handler';
import { ClientInfoService, ContextStorage, NAuthLogger, IClientInfo } from '../index';
import { GeoLocationService } from '../internal';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

describe('ClientInfoHandler', () => {
  let handler: ClientInfoHandler;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockGeoLocationService: jest.Mocked<GeoLocationService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockRequest: jest.Mocked<NAuthRequest>;
  let mockResponse: jest.Mocked<NAuthResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockClientInfoService = {
      parseUserAgent: jest.fn().mockReturnValue({
        deviceName: 'iPhone',
        deviceType: 'mobile',
        platform: 'iOS',
        browser: 'Safari',
      }),
    } as any;

    mockGeoLocationService = {
      getIpGeolocation: jest.fn().mockResolvedValue({
        country: 'US',
        city: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
      }),
    } as any;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockRequest = {
      getHeader: jest.fn().mockReturnValue('Mozilla/5.0'),
      attributes: {},
    } as any;
    Object.defineProperty(mockRequest, 'ip', {
      value: '192.168.1.1',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockRequest, 'body', {
      value: {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockRequest, 'cookies', {
      value: {},
      writable: true,
      configurable: true,
    });

    mockResponse = {
      raw: {},
    } as any;

    mockNext = jest.fn().mockResolvedValue(undefined);

    handler = new ClientInfoHandler(mockClientInfoService, mockGeoLocationService, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    ContextStorage.clear();
  });

  describe('handle', () => {
    it('should extract and store client info', async () => {
      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        expect(mockClientInfoService.parseUserAgent).toHaveBeenCalledWith('Mozilla/5.0');
        expect(mockNext).toHaveBeenCalled();
        expect(mockRequest.attributes.clientInfo).toBeDefined();
      });
    });

    it('should continue even if extraction fails', async () => {
      mockClientInfoService.parseUserAgent = jest.fn().mockImplementation(() => {
        throw new Error('Parse error');
      });

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        expect(mockLogger.error).toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should extract device token from cookie', async () => {
      Object.defineProperty(mockRequest, 'cookies', {
        value: { nauth_device_token: 'device-token-123' },
        writable: true,
        configurable: true,
      });

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        const clientInfo = mockRequest.attributes.clientInfo as IClientInfo;
        expect(clientInfo.deviceToken).toBe('device-token-123');
      });
    });

    it('should extract device token from header when cookie not available', async () => {
      mockRequest.getHeader = jest.fn((name: string) => {
        if (name === 'user-agent') return 'Mozilla/5.0';
        if (name === 'x-device-token') return 'device-token-456';
        return undefined;
      });

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        const clientInfo = mockRequest.attributes.clientInfo as IClientInfo;
        expect(clientInfo.deviceToken).toBe('device-token-456');
      });
    });

    it('should populate geolocation when service available', async () => {
      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        expect(mockGeoLocationService.getIpGeolocation).toHaveBeenCalledWith('192.168.1.1');
        const clientInfo = mockRequest.attributes.clientInfo as IClientInfo;
        expect(clientInfo.ipCountry).toBe('US');
        expect(clientInfo.ipCity).toBe('New York');
      });
    });

    it('should skip geolocation for 0.0.0.0 IP', async () => {
      Object.defineProperty(mockRequest, 'ip', {
        value: '0.0.0.0',
        writable: true,
        configurable: true,
      });

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        expect(mockGeoLocationService.getIpGeolocation).not.toHaveBeenCalled();
      });
    });

    it('should handle geolocation errors gracefully', async () => {
      mockGeoLocationService.getIpGeolocation = jest.fn().mockRejectedValue(new Error('Geo service error'));

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        expect(mockLogger.error).toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should use deviceName from body if provided', async () => {
      Object.defineProperty(mockRequest, 'body', {
        value: { deviceName: 'My Custom Device' },
        writable: true,
        configurable: true,
      });

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        const clientInfo = mockRequest.attributes.clientInfo as IClientInfo;
        expect(clientInfo.deviceName).toBe('My Custom Device');
      });
    });

    it('should use deviceType from body if provided', async () => {
      Object.defineProperty(mockRequest, 'body', {
        value: { deviceType: 'tablet' },
        writable: true,
        configurable: true,
      });

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        const clientInfo = mockRequest.attributes.clientInfo as IClientInfo;
        expect(clientInfo.deviceType).toBe('tablet');
      });
    });

    it('should store client info in context', async () => {
      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        const clientInfo = ContextStorage.get('CLIENT_INFO') as IClientInfo;
        expect(clientInfo).toBeDefined();
        expect(clientInfo.ipAddress).toBe('192.168.1.1');
      });
    });

    it('should store response in context', async () => {
      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        const response = ContextStorage.get('HTTP_RESPONSE');
        expect(response).toBe(mockResponse.raw);
      });
    });

    it('should work without geolocation service', async () => {
      const handlerWithoutGeo = new ClientInfoHandler(mockClientInfoService, undefined, mockLogger);

      await ContextStorage.run(async () => {
        await handlerWithoutGeo.handle(mockRequest, mockResponse, mockNext);

        expect(mockNext).toHaveBeenCalled();
        const clientInfo = mockRequest.attributes.clientInfo as IClientInfo;
        expect(clientInfo.ipCountry).toBeUndefined();
      });
    });

    it('should handle missing user agent', async () => {
      mockRequest.getHeader = jest.fn().mockReturnValue(undefined);

      await ContextStorage.run(async () => {
        await handler.handle(mockRequest, mockResponse, mockNext);

        expect(mockClientInfoService.parseUserAgent).toHaveBeenCalledWith('unknown');
      });
    });
  });
});
