import { ClientInfoService } from './client-info.service';
import { ClientInfo } from '../interfaces/client-info.interface';
import { ContextStorage } from '../utils/context-storage';

/**
 * Client Info Service Unit Tests
 *
 * Tests the client information extraction and retrieval functionality.
 * Uses ContextStorage (AsyncLocalStorage) for platform-agnostic context management.
 *
 * Covers:
 * - All service methods (get, getIpAddress, getUserAgent, getDeviceToken)
 * - ClientInfo retrieval from context
 * - Default values when no context exists
 * - All optional ClientInfo fields
 * - Edge cases (empty strings, undefined values, complete objects)
 * - ContextStorage integration
 */
describe('ClientInfoService', () => {
  let service: ClientInfoService;

  const mockClientInfo: ClientInfo = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    deviceToken: 'device-token-123',
    deviceName: 'My Laptop',
    deviceType: 'desktop',
    ipCountry: 'US',
    ipCity: 'New York',
    platform: 'Windows',
    browser: 'Chrome',
    sessionId: 123,
  };

  beforeEach(() => {
    service = new ClientInfoService();
    // Clear any existing context before each test
    ContextStorage.clear();
  });

  afterEach(() => {
    // Ensure context is cleared after each test
    ContextStorage.clear();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // get() Method
  // ============================================================================

  describe('get()', () => {
    it('should return client info from context when available', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        const result = service.get();

        expect(result).toEqual(mockClientInfo);
        expect(result.ipAddress).toBe('192.168.1.100');
        expect(result.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        expect(result.deviceToken).toBe('device-token-123');
      });
    });

    it('should return default values when no client info in context', () => {
      // Call outside ContextStorage.run() - no context
      const result = service.get();

      expect(result).toEqual({
        ipAddress: 'unknown',
        userAgent: 'unknown',
      });
    });

    it('should return default values when context returns null', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', null);

        const result = service.get();

        expect(result).toEqual({
          ipAddress: 'unknown',
          userAgent: 'unknown',
        });
      });
    });

    it('should return default values when context returns undefined', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', undefined);

        const result = service.get();

        expect(result).toEqual({
          ipAddress: 'unknown',
          userAgent: 'unknown',
        });
      });
    });

    it('should handle partial client info from context', () => {
      const partialClientInfo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Test Agent',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', partialClientInfo);

        const result = service.get();

        expect(result).toEqual(partialClientInfo);
        expect(result.ipAddress).toBe('10.0.0.1');
        expect(result.userAgent).toBe('Test Agent');
      });
    });

    it('should handle client info with all optional fields', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        const result = service.get();

        expect(result).toEqual(mockClientInfo);
        expect(result.deviceToken).toBe('device-token-123');
        expect(result.deviceName).toBe('My Laptop');
        expect(result.deviceType).toBe('desktop');
        expect(result.ipCountry).toBe('US');
        expect(result.ipCity).toBe('New York');
        expect(result.platform).toBe('Windows');
        expect(result.browser).toBe('Chrome');
        expect(result.sessionId).toBe(123);
      });
    });

    it('should handle client info with empty strings', () => {
      const clientInfoWithEmptyStrings: ClientInfo = {
        ipAddress: '',
        userAgent: '',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithEmptyStrings);

        const result = service.get();

        expect(result.ipAddress).toBe('');
        expect(result.userAgent).toBe('');
      });
    });

    it('should handle client info with only required fields', () => {
      const minimalClientInfo: ClientInfo = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', minimalClientInfo);

        const result = service.get();

        expect(result).toEqual(minimalClientInfo);
        expect(result.deviceToken).toBeUndefined();
        expect(result.deviceName).toBeUndefined();
        expect(result.deviceType).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // getIpAddress() Method
  // ============================================================================

  describe('getIpAddress()', () => {
    it('should return IP address from client info', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        const result = service.getIpAddress();

        expect(result.ipAddress).toBe('192.168.1.100');
      });
    });

    it('should return "unknown" when no client info in context', () => {
      // Call outside ContextStorage.run() - no context
      const result = service.getIpAddress();

      expect(result.ipAddress).toBe('unknown');
    });

    it('should return IP address from partial client info', () => {
      const partialClientInfo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Test',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', partialClientInfo);

        const result = service.getIpAddress();

        expect(result.ipAddress).toBe('10.0.0.1');
      });
    });

    it('should return empty string when IP address is empty', () => {
      const clientInfoWithEmptyIp: ClientInfo = {
        ipAddress: '',
        userAgent: 'Test',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithEmptyIp);

        const result = service.getIpAddress();

        expect(result.ipAddress).toBe('');
      });
    });
  });

  // ============================================================================
  // getUserAgent() Method
  // ============================================================================

  describe('getUserAgent()', () => {
    it('should return user agent from client info', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        const result = service.getUserAgent();

        expect(result.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      });
    });

    it('should return "unknown" when no client info in context', () => {
      // Call outside ContextStorage.run() - no context
      const result = service.getUserAgent();

      expect(result.userAgent).toBe('unknown');
    });

    it('should return user agent from partial client info', () => {
      const partialClientInfo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Test Agent',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', partialClientInfo);

        const result = service.getUserAgent();

        expect(result.userAgent).toBe('Test Agent');
      });
    });

    it('should return empty string when user agent is empty', () => {
      const clientInfoWithEmptyUA: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: '',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithEmptyUA);

        const result = service.getUserAgent();

        expect(result.userAgent).toBe('');
      });
    });
  });

  // ============================================================================
  // getDeviceToken() Method
  // ============================================================================

  describe('getDeviceToken()', () => {
    it('should return device token from client info when available', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        const result = service.getDeviceToken();

        expect(result.deviceToken).toBe('device-token-123');
      });
    });

    it('should return undefined when device token is not provided', () => {
      const clientInfoWithoutDeviceToken: ClientInfo = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithoutDeviceToken);

        const result = service.getDeviceToken();

        expect(result.deviceToken).toBeUndefined();
      });
    });

    it('should return undefined when no client info in context', () => {
      // Call outside ContextStorage.run() - no context
      const result = service.getDeviceToken();

      expect(result.deviceToken).toBeUndefined();
    });

    it('should return device token when only device token is provided', () => {
      const clientInfoWithDeviceToken: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Test',
        deviceToken: 'token-456',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithDeviceToken);

        const result = service.getDeviceToken();

        expect(result.deviceToken).toBe('token-456');
      });
    });
  });

  // ============================================================================
  // Integration with Different Request Scenarios
  // ============================================================================

  describe('Integration with different request scenarios', () => {
    it('should handle mobile user agent', () => {
      const mobileClientInfo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
        deviceType: 'mobile',
        platform: 'iOS',
        browser: 'Safari',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mobileClientInfo);

        const result = service.get();

        expect(result.ipAddress).toBe('10.0.0.1');
        expect(result.userAgent).toContain('iPhone');
        expect(result.deviceType).toBe('mobile');
        expect(result.platform).toBe('iOS');
        expect(result.browser).toBe('Safari');
      });
    });

    it('should handle API client without user agent', () => {
      const apiClientInfo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: '',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', apiClientInfo);

        const result = service.get();

        expect(result.ipAddress).toBe('10.0.0.1');
        expect(result.userAgent).toBe('');
      });
    });

    it('should handle IPv6 addresses', () => {
      const ipv6ClientInfo: ClientInfo = {
        ipAddress: '2001:db8::1',
        userAgent: 'curl/7.68.0',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', ipv6ClientInfo);

        const result = service.get();

        expect(result.ipAddress).toBe('2001:db8::1');
        expect(result.userAgent).toBe('curl/7.68.0');
      });
    });

    it('should handle tablet device type', () => {
      const tabletClientInfo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        deviceType: 'tablet',
        platform: 'iOS',
        browser: 'Safari',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', tabletClientInfo);

        const result = service.get();

        expect(result.deviceType).toBe('tablet');
        expect(result.platform).toBe('iOS');
      });
    });

    it('should handle client info with geolocation data', () => {
      const clientInfoWithGeo: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        ipCountry: 'CA',
        ipCity: 'Toronto',
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithGeo);

        const result = service.get();

        expect(result.ipCountry).toBe('CA');
        expect(result.ipCity).toBe('Toronto');
      });
    });

    it('should handle client info with session ID', () => {
      const clientInfoWithSession: ClientInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 456,
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', clientInfoWithSession);

        const result = service.get();

        expect(result.sessionId).toBe(456);
      });
    });

    it('should handle complete client info with all fields', () => {
      const completeClientInfo: ClientInfo = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceToken: 'device-token-789',
        deviceName: 'Work Desktop',
        deviceType: 'desktop',
        ipCountry: 'GB',
        ipCity: 'London',
        platform: 'Windows',
        browser: 'Firefox',
        sessionId: 789,
      };

      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', completeClientInfo);

        const result = service.get();

        expect(result).toEqual(completeClientInfo);
        expect(result.ipAddress).toBe('192.168.1.100');
        expect(result.deviceToken).toBe('device-token-789');
        expect(result.deviceName).toBe('Work Desktop');
        expect(result.deviceType).toBe('desktop');
        expect(result.ipCountry).toBe('GB');
        expect(result.ipCity).toBe('London');
        expect(result.platform).toBe('Windows');
        expect(result.browser).toBe('Firefox');
        expect(result.sessionId).toBe(789);
      });
    });
  });

  // ============================================================================
  // ContextStorage Integration
  // ============================================================================

  describe('ContextStorage integration', () => {
    it('should work across async boundaries', async () => {
      const result = await ContextStorage.run(async () => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        return service.get();
      });

      expect(result).toEqual(mockClientInfo);
    });

    it('should isolate context per run() call', () => {
      const firstContext = {
        ipAddress: '10.0.0.1',
        userAgent: 'First',
      };

      const secondContext = {
        ipAddress: '10.0.0.2',
        userAgent: 'Second',
      };

      const result1 = ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', firstContext);
        return service.get();
      });

      const result2 = ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', secondContext);
        return service.get();
      });

      expect(result1.ipAddress).toBe('10.0.0.1');
      expect(result2.ipAddress).toBe('10.0.0.2');
      expect(result1).not.toEqual(result2);
    });

    it('should return default values when called outside context', () => {
      // No ContextStorage.run() - should return defaults
      const result = service.get();

      expect(result).toEqual({
        ipAddress: 'unknown',
        userAgent: 'unknown',
      });
    });
  });

  // ============================================================================
  // getSessionId() Method
  // ============================================================================

  describe('getSessionId()', () => {
    it('should return session ID from client info when available', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', mockClientInfo);

        const result = service.getSessionId();

        expect(result.sessionId).toBe(123);
      });
    });

    it('should return undefined when no client info in context', () => {
      const result = service.getSessionId();
      expect(result.sessionId).toBeUndefined();
    });

    it('should return undefined when client info has no sessionId', () => {
      ContextStorage.run(() => {
        ContextStorage.set('CLIENT_INFO', { ipAddress: '1.2.3.4', userAgent: 'Test' });

        const result = service.getSessionId();

        expect(result.sessionId).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // getResponse() Method
  // ============================================================================

  describe('getResponse()', () => {
    it('should return null when no response in context', () => {
      ContextStorage.run(() => {
        const result = service.getResponse();
        expect(result).toBeNull();
      });
    });

    it('should return response object when set in context', () => {
      const mockClearCookie = jest.fn();
      const mockResponse = { clearCookie: mockClearCookie };

      ContextStorage.run(() => {
        ContextStorage.set('HTTP_RESPONSE', mockResponse);

        const result = service.getResponse();

        expect(result).not.toBeNull();
        expect(result?.clearCookie).toBe(mockClearCookie);
        result?.clearCookie?.('test-cookie');
        expect(mockClearCookie).toHaveBeenCalledWith('test-cookie');
      });
    });
  });

  // ============================================================================
  // parseUserAgent() Method
  // ============================================================================

  describe('parseUserAgent()', () => {
    it('should return nulls when userAgent is null', () => {
      const result = service.parseUserAgent(null);
      expect(result).toEqual({
        browser: null,
        platform: null,
        deviceType: null,
        deviceName: null,
      });
    });

    it('should return nulls when userAgent is undefined', () => {
      const result = service.parseUserAgent(undefined);
      expect(result).toEqual({
        browser: null,
        platform: null,
        deviceType: null,
        deviceName: null,
      });
    });

    it('should return nulls when userAgent is empty string', () => {
      const result = service.parseUserAgent('');
      expect(result).toEqual({
        browser: null,
        platform: null,
        deviceType: null,
        deviceName: null,
      });
    });

    it('should return nulls when userAgent is whitespace only', () => {
      const result = service.parseUserAgent('   ');
      expect(result).toEqual({
        browser: null,
        platform: null,
        deviceType: null,
        deviceName: null,
      });
    });

    it('should detect Windows 10', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.platform).toBe('Windows 10');
      expect(result.deviceType).toBe('desktop');
    });

    it('should detect Windows 11', () => {
      const ua = 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.platform).toBe('Windows 11');
    });

    it('should detect Chrome browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.browser).toMatch(/Chrome/);
      expect(result.deviceName).toContain('Chrome');
    });

    it('should detect Edge browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0';
      const result = service.parseUserAgent(ua);
      expect(result.browser).toBe('Edge');
    });

    it('should detect Safari browser', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      const result = service.parseUserAgent(ua);
      expect(result.browser).toMatch(/Safari/);
      expect(result.platform).toMatch(/macOS/);
    });

    it('should detect Firefox', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = service.parseUserAgent(ua);
      expect(result.browser).toMatch(/Firefox/);
    });

    it('should detect mobile device', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      const result = service.parseUserAgent(ua);
      expect(result.deviceType).toBe('mobile');
      expect(result.deviceName).toContain('iPhone');
    });

    it('should detect tablet (Android tablet)', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 10; Tablet) AppleWebKit/537.36 Chrome/90.0.0.0 Safari/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.deviceType).toBe('tablet');
      expect(result.platform).toMatch(/Android/);
    });

    it('should detect Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.platform).toMatch(/Android/);
      expect(result.deviceType).toBe('mobile');
    });

    it('should detect macOS version', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_2_1) AppleWebKit/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.platform).toBe('macOS Ventura+');
    });

    it('should detect Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
      const result = service.parseUserAgent(ua);
      expect(result.platform).toBe('Linux');
    });
  });
});
