/**
 * Fastify Adapter Unit Tests
 *
 * Tests Fastify adapter functionality including:
 * - Hook registration
 * - Response interceptor registration
 * - Route handler wrapping
 * - Cookie management
 * - Context management
 */

import { FastifyAdapter } from './fastify.adapter';
import { NAuthMiddlewareHandler, NAuthResponseInterceptorHandler, NAuthRouteHandler } from '../platform/interfaces';
import { ContextStorage } from '../utils/context-storage';

describe('FastifyAdapter', () => {
  let adapter: FastifyAdapter;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    adapter = new FastifyAdapter();
    mockRequest = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      body: {},
    };
    mockReply = {
      setCookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis(),
    };
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('FastifyAdapter');
    });
  });

  describe('registerMiddleware', () => {
    it('should return Fastify hook function', () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockResolvedValue(undefined);
      const hook = adapter.registerMiddleware('test', handler);

      expect(typeof hook).toBe('function');
    });

    it('should initialize context for clientInfo hook', async () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockImplementation((req, res, next) => {
        expect(ContextStorage.getStore()).toBeDefined();
        next();
      });

      const hook = adapter.registerMiddleware('clientInfo', handler, { initializesContext: true });
      await hook(mockRequest, mockReply);

      expect(handler).toHaveBeenCalled();
    });

    it('should execute handler', async () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockImplementation((req, res, next) => {
        next();
      });

      const hook = adapter.registerMiddleware('test', handler);
      await hook(mockRequest, mockReply);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('registerResponseInterceptor', () => {
    it('should return Fastify hook function', () => {
      const handler: NAuthResponseInterceptorHandler = jest.fn().mockResolvedValue({});
      const hook = adapter.registerResponseInterceptor(handler);

      expect(typeof hook).toBe('function');
    });
  });

  describe('wrapRouteHandler', () => {
    it('should wrap route handler with context', async () => {
      const routeHandler: NAuthRouteHandler = jest.fn().mockResolvedValue({ result: 'test' });
      const wrapped = adapter.wrapRouteHandler(routeHandler);

      expect(typeof wrapped).toBe('function');
    });

    it('should execute route handler with context', async () => {
      const routeHandler: NAuthRouteHandler = jest.fn().mockResolvedValue({ result: 'test' });
      const wrapped = adapter.wrapRouteHandler(routeHandler);

      await wrapped(mockRequest, mockReply);

      expect(routeHandler).toHaveBeenCalled();
    });
  });

});
