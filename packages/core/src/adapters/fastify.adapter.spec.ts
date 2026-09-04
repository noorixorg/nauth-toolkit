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

    it('should pass cookie options including priority through to reply.setCookie', async () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockImplementation((req, res, next) => {
        res.setCookie('test_cookie', 'value', {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          priority: 'low',
        });
        next();
      });

      const hook = adapter.registerMiddleware('test', handler);
      await hook(mockRequest, mockReply);

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        'test_cookie',
        'value',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          priority: 'low',
        }),
      );
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

  describe('mountRaw', () => {
    /** Captures what the adapter registers, standing in for a root Fastify instance. */
    const createInstance = (): {
      addHook: jest.Mock;
      dispatch: (request: unknown, reply: unknown, done: () => void) => void;
    } => {
      const hooks: Array<(request: unknown, reply: unknown, done: () => void) => void> = [];
      const addHook = jest.fn((_event: string, handler: (request: unknown, reply: unknown, done: () => void) => void) => {
        hooks.push(handler);
      });
      return {
        addHook,
        dispatch: (request, reply, done): void => {
          hooks.forEach((hook) => hook(request, reply, done));
        },
      };
    };

    const createReply = (): { raw: Record<string, unknown>; hijack: jest.Mock } => ({
      raw: { setHeader: jest.fn(), end: jest.fn() },
      hijack: jest.fn(),
    });

    it('should register on onRequest, which runs before body parsing', () => {
      const instance = createInstance();

      adapter.mountRaw(instance, () => true, jest.fn());

      // onRequest is the only hook early enough to leave the request stream intact.
      expect(instance.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
    });

    it('should hijack the reply and hand over raw Node objects on a match', () => {
      const instance = createInstance();
      const handler = jest.fn();
      const reply = createReply();
      const request = { url: '/oidc/token', raw: { method: 'POST' } };
      const done = jest.fn();

      adapter.mountRaw(instance, (path) => path.startsWith('/oidc/'), handler);
      instance.dispatch(request, reply, done);

      expect(reply.hijack).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(request.raw, reply.raw);
      // done() must not run - the handler owns the socket from here.
      expect(done).not.toHaveBeenCalled();
    });

    it('should claim paths that match no route, such as discovery', () => {
      const instance = createInstance();
      const handler = jest.fn();
      const done = jest.fn();

      adapter.mountRaw(instance, (path) => path.startsWith('/.well-known/'), handler);
      instance.dispatch({ url: '/.well-known/openid-configuration', raw: {} }, createReply(), done);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(done).not.toHaveBeenCalled();
    });

    it('should call done and leave the reply alone for non-matching requests', () => {
      const instance = createInstance();
      const handler = jest.fn();
      const reply = createReply();
      const done = jest.fn();

      adapter.mountRaw(instance, (path) => path.startsWith('/oidc/'), handler);
      instance.dispatch({ url: '/auth/login', raw: {} }, reply, done);

      expect(handler).not.toHaveBeenCalled();
      expect(reply.hijack).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalledTimes(1);
    });

    it('should strip the query string before testing the predicate', () => {
      const instance = createInstance();
      const predicate = jest.fn().mockReturnValue(false);

      adapter.mountRaw(instance, predicate, jest.fn());
      instance.dispatch({ url: '/oidc/auth?client_id=demo', raw: {} }, createReply(), jest.fn());

      expect(predicate).toHaveBeenCalledWith('/oidc/auth');
    });

    it('should throw a helpful error when the instance cannot be attached to', () => {
      expect(() => adapter.mountRaw({}, () => true, jest.fn())).toThrow(/addHook\(\) method/);
      expect(() => adapter.mountRaw(undefined, () => true, jest.fn())).toThrow(/addHook\(\) method/);
    });
  });
});
