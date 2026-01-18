/**
 * NAuth HTTP Exception Filter Unit Tests
 *
 * Tests exception filter functionality.
 */

import { ArgumentsHost } from '@nestjs/common';
import { NAuthHttpExceptionFilter } from './nauth-http-exception.filter';
import { NAuthException } from '@nauth-toolkit/core';
import { AuthErrorCode } from '@nauth-toolkit/core';

describe('NAuthHttpExceptionFilter', () => {
  let filter: NAuthHttpExceptionFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    filter = new NAuthHttpExceptionFilter();

    mockRequest = {
      url: '/test',
      method: 'POST',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      statusCode: undefined,
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;
  });

  describe('catch', () => {
    it('should handle NAuthException and send proper response', () => {
      const exception = new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: AuthErrorCode.VALIDATION_FAILED,
          message: 'Validation failed',
        }),
      );
    });

    it('should use Fastify response pattern when available', () => {
      const fastifyResponse = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const fastifyHost = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
          getResponse: jest.fn().mockReturnValue(fastifyResponse),
        }),
      } as any;

      const exception = new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      filter.catch(exception, fastifyHost);

      expect(fastifyResponse.code).toHaveBeenCalledWith(400);
      expect(fastifyResponse.send).toHaveBeenCalled();
    });

    it('should handle 500 errors and log as error', () => {
      const exception = new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Internal error');
      const loggerSpy = jest.spyOn(filter['logger'], 'error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle 400 errors and log as warn', () => {
      const exception = new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      const loggerSpy = jest.spyOn(filter['logger'], 'warn');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should include request path in response', () => {
      const exception = new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed');
      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/test',
        }),
      );
    });
  });
});
