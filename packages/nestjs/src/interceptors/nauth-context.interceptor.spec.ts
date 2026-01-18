/**
 * NAuth Context Interceptor Unit Tests
 *
 * Tests context restoration interceptor functionality.
 */

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { NAuthContextInterceptor } from './nauth-context.interceptor';
import { ContextStorage } from '@nauth-toolkit/core';
import { getNAuthContextStore } from '../guards/nauth-context.guard';

describe('NAuthContextInterceptor', () => {
  let interceptor: NAuthContextInterceptor;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  beforeEach(() => {
    interceptor = new NAuthContextInterceptor();

    const mockRequest = {
      headers: {},
      cookies: {},
    };

    mockExecutionContext = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    } as any;
  });

  describe('intercept', () => {
    it('should pass through for non-HTTP context', (done) => {
      mockExecutionContext.getType.mockReturnValue('rpc');
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockCallHandler.handle).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should re-enter context store when available', (done) => {
      const store = new Map<string, unknown>();
      store.set('CLIENT_INFO', { ipAddress: '1.2.3.4' });
      const request = mockExecutionContext.switchToHttp().getRequest();
      (request as Record<symbol, unknown>)[Symbol.for('nauth.contextStore')] = store;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const clientInfo = ContextStorage.get('CLIENT_INFO');
          expect(clientInfo).toBeDefined();
          done();
        },
      });
    });

    it('should continue without context when store not available', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockCallHandler.handle).toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
