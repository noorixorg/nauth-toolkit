/**
 * NAuth Context Guard Unit Tests
 *
 * Tests context initialization guard functionality.
 */

import { ExecutionContext } from '@nestjs/common';
import { NAuthContextGuard, getNAuthContextStore } from './nauth-context.guard';
import { GeoLocationService } from '@nauth-toolkit/core/internal';
import { NAuthConfig, ContextStorage } from '@nauth-toolkit/core';

describe('NAuthContextGuard', () => {
  let guard: NAuthContextGuard;
  let mockConfig: NAuthConfig;
  let mockGeoLocationService: jest.Mocked<GeoLocationService>;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;

  function createHttpContext(): ExecutionContext {
    mockRequest = {
      headers: { 'user-agent': 'Mozilla/5.0' },
      cookies: {},
      ip: '1.2.3.4',
      body: {},
    };

    mockResponse = {};

    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;
  }

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
    } as NAuthConfig;

    mockGeoLocationService = {
      getIpGeolocation: jest.fn().mockResolvedValue({
        country: 'US',
        city: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
      }),
    } as any;

    mockExecutionContext = createHttpContext();
    guard = new NAuthContextGuard(mockConfig, mockGeoLocationService);
  });

  describe('canActivate', () => {
    it('should return true for non-HTTP context', async () => {
      const rpcContext = {
        getType: () => 'rpc',
        switchToHttp: () => ({
          getRequest: () => ({}),
          getResponse: () => ({}),
        }),
      } as any;
      const result = await guard.canActivate(rpcContext);
      expect(result).toBe(true);
    });

    it('should initialize context for HTTP requests', async () => {
      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
      const store = getNAuthContextStore(mockRequest);
      expect(store).toBeDefined();
    });

    it('should extract and store client info', async () => {
      await guard.canActivate(mockExecutionContext);
      const store = getNAuthContextStore(mockRequest);
      expect(store).toBeDefined();
      const clientInfo = store?.get('CLIENT_INFO') as any;
      expect(clientInfo).toBeDefined();
      expect(clientInfo?.ipAddress).toBe('1.2.3.4');
      expect(clientInfo?.userAgent).toBe('Mozilla/5.0');
    });

    it('should populate geolocation when service available', async () => {
      await guard.canActivate(mockExecutionContext);
      expect(mockGeoLocationService.getIpGeolocation).toHaveBeenCalledWith('1.2.3.4');
      const store = getNAuthContextStore(mockRequest);
      const clientInfo = store?.get('CLIENT_INFO') as any;
      expect(clientInfo?.ipCountry).toBe('US');
      expect(clientInfo?.ipCity).toBe('New York');
    });

    it('should work without geolocation service', async () => {
      const guardWithoutGeo = new NAuthContextGuard(mockConfig);
      await guardWithoutGeo.canActivate(mockExecutionContext);
      const store = getNAuthContextStore(mockRequest);
      expect(store).toBeDefined();
      const clientInfo = store?.get('CLIENT_INFO') as any;
      expect(clientInfo).toBeDefined();
      expect(clientInfo?.ipCountry).toBeUndefined();
    });
  });

  describe('getNAuthContextStore', () => {
    it('should return context store from request', async () => {
      await guard.canActivate(mockExecutionContext);
      const store = getNAuthContextStore(mockRequest);
      expect(store).toBeDefined();
      expect(store instanceof Map).toBe(true);
    });

    it('should return undefined when store not set', () => {
      const request = {};
      const store = getNAuthContextStore(request);
      expect(store).toBeUndefined();
    });
  });
});
