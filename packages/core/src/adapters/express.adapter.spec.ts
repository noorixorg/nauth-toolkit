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
      clearCookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      redirect: jest.fn(),
      headersSent: false,
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

    it('should pass cookie options including priority through to res.cookie', async () => {
      const handler: NAuthMiddlewareHandler = jest.fn().mockImplementation((req, res, next) => {
        res.setCookie('test_cookie', 'value', {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          priority: 'low',
        });
        next();
      });

      const middleware = adapter.registerMiddleware('test', handler);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
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

  describe('mountRaw', () => {
    /** Captures what the adapter registers, standing in for an Express app. */
    const createApp = (): { use: jest.Mock; dispatch: (req: unknown, res: unknown) => void } => {
      const registered: Array<(req: unknown, res: unknown, next: () => void) => void> = [];
      const use = jest.fn((handler: (req: unknown, res: unknown, next: () => void) => void) => {
        registered.push(handler);
      });
      return {
        use,
        dispatch: (req, res): void => {
          registered.forEach((handler) => handler(req, res, mockNext));
        },
      };
    };

    it('should hand matching requests to the handler and not call next', () => {
      const app = createApp();
      const handler = jest.fn();

      adapter.mountRaw(app, (path) => path.startsWith('/oidc/'), handler);
      app.dispatch({ path: '/oidc/token', url: '/oidc/token' }, mockRes);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass the raw request and response straight through', () => {
      const app = createApp();
      const handler = jest.fn();
      const req = { path: '/oidc/auth', url: '/oidc/auth' };

      adapter.mountRaw(app, () => true, handler);
      app.dispatch(req, mockRes);

      expect(handler).toHaveBeenCalledWith(req, mockRes);
    });

    it('should call next for non-matching requests', () => {
      const app = createApp();
      const handler = jest.fn();

      adapter.mountRaw(app, (path) => path.startsWith('/oidc/'), handler);
      app.dispatch({ path: '/auth/login', url: '/auth/login' }, mockRes);

      expect(handler).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should strip the query string before testing the predicate', () => {
      const app = createApp();
      const predicate = jest.fn().mockReturnValue(true);

      adapter.mountRaw(app, predicate, jest.fn());
      app.dispatch({ url: '/oidc/auth?client_id=demo&scope=openid' }, mockRes);

      expect(predicate).toHaveBeenCalledWith('/oidc/auth');
    });

    it('should register without a path prefix so the provider sees the full path', () => {
      const app = createApp();

      adapter.mountRaw(app, () => true, jest.fn());

      // A single-argument use() is what keeps Express from rewriting req.url. Mounting
      // as use('/oidc', ...) would strip the prefix and break every generated issuer URL.
      expect(app.use).toHaveBeenCalledTimes(1);
      expect(app.use.mock.calls[0]).toHaveLength(1);
    });

    it('should throw a helpful error when the app cannot be attached to', () => {
      expect(() => adapter.mountRaw({}, () => true, jest.fn())).toThrow(/use\(\) method/);
      expect(() => adapter.mountRaw(undefined, () => true, jest.fn())).toThrow(/use\(\) method/);
    });
  });
});
