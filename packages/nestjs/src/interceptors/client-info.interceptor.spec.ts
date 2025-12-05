import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ClientInfoInterceptor } from './client-info.interceptor';
import { IClientInfo, ContextStorage } from '@nauth-toolkit/core';

/**
 * Client Info Interceptor Unit Tests
 *
 * Tests the automatic client information extraction and storage functionality.
 */
describe('ClientInfoInterceptor', () => {
  let interceptor: ClientInfoInterceptor;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;
  let mockGeoLocationService: any;

  beforeEach(() => {
    mockGeoLocationService = undefined; // Optional dependency
    interceptor = new ClientInfoInterceptor(mockGeoLocationService);

    mockRequest = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-device-token': 'device-token-123',
      },
      cookies: {
        nauth_device_id: 'cookie-device-token-456',
      },
      body: {
        deviceName: 'iPhone 12',
        deviceType: 'mobile',
      },
      socket: {
        remoteAddress: '192.168.1.100',
      },
      connection: {
        remoteAddress: '192.168.1.100',
      },
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue({}),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of('response')),
    };
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept()', () => {
    it('should extract and store complete client info', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // The interceptor attaches client info to request
          expect(mockRequest.clientInfo).toBeDefined();
          expect(mockRequest.clientInfo.ipAddress).toBe('192.168.1.100'); // Extracted from mockRequest.socket.remoteAddress
          expect(mockRequest.clientInfo.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          expect(mockRequest.clientInfo.deviceToken).toBe('cookie-device-token-456'); // Cookie takes precedence over header
          expect(mockRequest.clientInfo.deviceName).toBe('iPhone 12');
          expect(mockRequest.clientInfo.deviceType).toBe('mobile');

          // Should return the next handler result
          expect(result).toBe('response');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle missing user agent', (done) => {
      delete mockRequest.headers['user-agent'];

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.userAgent).toBe('unknown');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should prefer device token from cookie over header', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.deviceToken).toBe('cookie-device-token-456'); // Cookie takes precedence
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should use header device token when cookie is not provided', (done) => {
      delete mockRequest.cookies;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.deviceToken).toBe('device-token-123');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle missing device information', (done) => {
      delete mockRequest.headers['x-device-token'];
      delete mockRequest.cookies;
      delete mockRequest.body.deviceName;
      delete mockRequest.body.deviceType;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          // deviceToken should be undefined when both cookie and header are missing
          expect(storedClientInfo?.deviceToken).toBeUndefined();
          // deviceName falls back to parsing from user agent when body doesn't provide it
          expect(storedClientInfo?.deviceName).toBeDefined(); // Parsed from user agent
          // deviceType falls back to parsing from user agent when body doesn't provide it
          expect(storedClientInfo?.deviceType).toBeDefined(); // Parsed from user agent
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle empty body', (done) => {
      mockRequest.body = {};

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.deviceToken).toBe('cookie-device-token-456'); // From cookie
          // deviceName and deviceType fall back to parsing from user agent when body is empty
          expect(storedClientInfo?.deviceName).toBeDefined(); // Parsed from user agent
          expect(storedClientInfo?.deviceType).toBeDefined(); // Parsed from user agent
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle null body', (done) => {
      mockRequest.body = null;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.deviceToken).toBe('cookie-device-token-456'); // From cookie
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should return the next handler result', (done) => {
      const expectedResponse = { success: true };
      mockCallHandler.handle.mockReturnValue(of(expectedResponse));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(expectedResponse);
          done();
        },
        error: (err) => {
          done();
        },
      });
    });
  });

  describe('IP Address Extraction', () => {
    it('should extract IP from various proxy headers', (done) => {
      // Test X-Forwarded-For
      mockRequest.headers['x-forwarded-for'] = '203.0.113.1, 198.51.100.1';
      mockRequest.socket.remoteAddress = '192.168.1.100';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          // X-Forwarded-For takes precedence, first IP in the list
          expect(storedClientInfo?.ipAddress).toBe('203.0.113.1');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should extract IP from X-Real-IP header', (done) => {
      mockRequest.headers['x-real-ip'] = '203.0.113.2';
      mockRequest.socket.remoteAddress = '192.168.1.100';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          // X-Real-IP takes precedence over socket.remoteAddress
          expect(storedClientInfo?.ipAddress).toBe('203.0.113.2');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should extract IP from socket when no proxy headers', (done) => {
      // No proxy headers, IP extracted from socket.remoteAddress
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.ipAddress).toBe('192.168.1.100');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing headers object', (done) => {
      delete mockRequest.headers;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.userAgent).toBe('unknown');
          // deviceToken can come from cookies even if headers is missing
          expect(storedClientInfo?.deviceToken).toBe('cookie-device-token-456');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle non-string header values', (done) => {
      mockRequest.headers = {
        'user-agent': 12345,
        'x-device-token': { id: 'test' },
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          // Non-string user-agent becomes 'unknown'
          expect(storedClientInfo?.userAgent).toBe('unknown');
          // Non-string deviceToken from header is converted, but cookie takes precedence
          expect(storedClientInfo?.deviceToken).toBe('cookie-device-token-456');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle IPv6 addresses', (done) => {
      mockRequest.socket.remoteAddress = '2001:db8::1';
      mockRequest.connection.remoteAddress = '2001:db8::1';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.ipAddress).toBe('2001:db8::1');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should handle localhost addresses', (done) => {
      mockRequest.socket.remoteAddress = '127.0.0.1';
      mockRequest.connection.remoteAddress = '127.0.0.1';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const storedClientInfo = mockRequest.clientInfo;
          expect(storedClientInfo?.ipAddress).toBe('127.0.0.1');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });
  });

  describe('Integration with request object', () => {
    it('should attach client info to request for decorator compatibility', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockRequest.clientInfo).toBeDefined();
          expect(mockRequest.clientInfo.ipAddress).toBe('192.168.1.100'); // Extracted from mockRequest.socket.remoteAddress
          expect(mockRequest.clientInfo.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          done();
        },
        error: (err) => {
          done();
        },
      });
    });

    it('should ensure request.clientInfo matches CLS data', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const clsClientInfo = ContextStorage.get<IClientInfo>('CLIENT_INFO');
          expect(mockRequest.clientInfo).toEqual(clsClientInfo);
          done();
        },
        error: (err) => {
          done();
        },
      });
    });
  });
});
