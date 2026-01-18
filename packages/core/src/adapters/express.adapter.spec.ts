/**
 * Express Adapter Unit Tests
 *
 * Tests Express adapter functionality including:
 * - Middleware registration
 * - Response interceptor registration
 * - Route handler wrapping
 * - Cookie management
 * - Context initialization
 */

import { ExpressAdapter } from './express.adapter';
import { NAuthMiddlewareHandler, NAuthResponseInterceptorHandler, NAuthRouteHandler } from '../platform/interfaces';
import { ContextStorage } from '../utils/context-storage';

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    adapter = new ExpressAdapter();
    mockNext = jest.fn();
    mockReq = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      body: {},
      _nauthAttributes: {},
    };
    mockRes = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      _nauthIsSent: false,
      isSent: jest.fn().mockReturnValue(false),
    };
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('ExpressAdapter');
    });
  });

  describe('registerMiddleware', () => {
    it('should return Express middleware function', () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockResolvedValue(undefined);
      const middleware = adapter.registerMiddleware('test', handler);

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware signature: (req, res, next)
    });

    it('should initialize context for clientInfo middleware', async () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockImplementation((req, res, next) => {
        expect(ContextStorage.getStore()).toBeDefined();
        next();
      });

      const middleware = adapter.registerMiddleware('clientInfo', handler, { initializesContext: true });
      await middleware(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should execute handler and call next', async () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockImplementation((req, res, next) => {
        next();
      });

      const middleware = adapter.registerMiddleware('test', handler);
      await middleware(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors in handler', async () => {
      const error = new Error('Test error');
      const handler: NAuthMiddlewareHandler = jest.fn().mockRejectedValue(error);

      const middleware = adapter.registerMiddleware('test', handler);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('registerResponseInterceptor', () => {
    it('should return Express middleware function', () => {
      const handler: NAuthResponseInterceptorHandler = jest.fn().mockResolvedValue({});
      const middleware = adapter.registerResponseInterceptor(handler);

      expect(typeof middleware).toBe('function');
    });

    it('should intercept JSON responses', async () => {
      const originalBody = { message: 'test' };
      const modifiedBody = { message: 'modified' };
      const handler: NAuthResponseInterceptorHandler = jest.fn().mockResolvedValue(modifiedBody);

      const middleware = adapter.registerResponseInterceptor(handler);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(typeof mockRes.json).toBe('function');

      mockRes.json(originalBody);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
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

      await wrapped(mockReq, mockRes, mockNext);

      expect(routeHandler).toHaveBeenCalled();
    });
  });

});
