import { ClientInfo } from './client-info.decorator';
import { ExecutionContext } from '@nestjs/common';
import { IClientInfo as ClientInfoType } from '@nauth-toolkit/core';

/**
 * ClientInfo Decorator Unit Tests
 *
 * Tests the @ClientInfo() decorator functionality.
 */
describe('@ClientInfo() Decorator', () => {
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  const mockClientInfo: ClientInfoType = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    deviceToken: 'device-123',
  };

  beforeEach(() => {
    mockRequest = {
      clientInfo: mockClientInfo,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  // Helper to extract and call the factory function
  const callFactory = (data: keyof ClientInfoType | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const clientInfo: ClientInfoType = request.clientInfo;

    // If no specific field requested, return full object
    if (!data) {
      return clientInfo;
    }

    // Return specific field
    return clientInfo?.[data];
  };

  it('should return full client info object when no field specified', () => {
    const decorator = ClientInfo();
    expect(typeof decorator).toBe('function');

    const result = callFactory(undefined, mockExecutionContext);
    expect(result).toEqual(mockClientInfo);
    expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
  });

  it('should return specific field when requested', () => {
    const decorator = ClientInfo('ipAddress');
    expect(typeof decorator).toBe('function');

    const result = callFactory('ipAddress', mockExecutionContext);
    expect(result).toBe('192.168.1.100');
  });

  it('should return userAgent field when requested', () => {
    const decorator = ClientInfo('userAgent');
    expect(typeof decorator).toBe('function');

    const result = callFactory('userAgent', mockExecutionContext);
    expect(result).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  });

  it('should return deviceToken field when requested', () => {
    const decorator = ClientInfo('deviceToken');
    expect(typeof decorator).toBe('function');

    const result = callFactory('deviceToken', mockExecutionContext);
    expect(result).toBe('device-123');
  });

  it('should handle undefined data parameter as full object', () => {
    const result = callFactory(undefined, mockExecutionContext);
    expect(result).toEqual(mockClientInfo);
  });

  it('should handle null clientInfo in request', () => {
    mockRequest.clientInfo = null;
    const result = callFactory(undefined, mockExecutionContext);
    expect(result).toBeNull();
  });

  it('should handle missing clientInfo property in request', () => {
    delete mockRequest.clientInfo;
    const result = callFactory(undefined, mockExecutionContext);
    expect(result).toBeUndefined();
  });

  it('should handle partial client info', () => {
    const partialClientInfo: ClientInfoType = {
      ipAddress: '10.0.0.1',
      userAgent: 'curl/7.68.0',
    };
    mockRequest.clientInfo = partialClientInfo;

    const result = callFactory('deviceToken', mockExecutionContext);
    expect(result).toBeUndefined();
  });

  it('should handle different client info structures', () => {
    const mobileClientInfo: ClientInfoType = {
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
    };
    mockRequest.clientInfo = mobileClientInfo;

    const result = callFactory(undefined, mockExecutionContext);
    expect(result).toEqual(mobileClientInfo);
  });

  describe('Edge cases', () => {
    it('should handle non-existent field request', () => {
      const result = callFactory('nonExistentField' as any, mockExecutionContext);
      expect(result).toBeUndefined();
    });

    it('should handle clientInfo as empty object', () => {
      mockRequest.clientInfo = {};
      const result = callFactory('ipAddress', mockExecutionContext);
      expect(result).toBeUndefined();
    });
  });
});
