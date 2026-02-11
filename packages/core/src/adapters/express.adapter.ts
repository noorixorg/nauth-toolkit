/**
 * Express Framework Adapter
 *
 * Adapts NAuth to work with Express.js (4.x and 5.x compatible).
 *
 * **Context Management:**
 * - First middleware (clientInfo) initializes AsyncLocalStorage context
 * - Context automatically propagates through Express middleware chain
 * - Route handlers have automatic context access (no wrapper needed)
 *
 * **Express 5.x Compatibility:**
 * - Uses req.hostname instead of deprecated req.host
 * - Handles async middleware errors automatically
 * - Compatible with new path matching behavior
 */

import {
  NAuthAdapter,
  NAuthRequest,
  NAuthResponse,
  NAuthCookieOptions,
  NAuthRequestAttributes,
  NAuthMiddlewareHandler,
  NAuthResponseInterceptorHandler,
  NAuthRouteHandler,
  MiddlewareOptions,
} from '../platform/interfaces';
import { ContextStorage } from '../utils/context-storage';

// ============================================================================
// Express Adapter
// ============================================================================

/**
 * Express Adapter Implementation
 *
 * Provides NAuth integration for Express.js applications.
 */
export class ExpressAdapter implements NAuthAdapter {
  public readonly name = 'ExpressAdapter';

  /**
   * Register a middleware handler
   *
   * Wraps the generic NAuth handler into Express middleware format.
   * Handles context initialization for the first middleware.
   */
  public registerMiddleware(
    name: string,
    handler: NAuthMiddlewareHandler,
    options?: MiddlewareOptions,
  ): ExpressMiddleware {
    const initializesContext = options?.initializesContext || name === 'clientInfo';

    return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): Promise<void> => {
      // Ensure we have attribute storage
      if (!req._nauthAttributes) {
        req._nauthAttributes = {};
      }

      const nauthReq = new ExpressRequestWrapper(req);
      const nauthRes = new ExpressResponseWrapper(res);

      try {
        if (initializesContext) {
          // First middleware - initialize context
          await ContextStorage.run(async () => {
            await this.executeHandler(handler, nauthReq, nauthRes, next);
          });
        } else {
          // Subsequent middleware - context should exist from first middleware
          await this.executeHandler(handler, nauthReq, nauthRes, next);
        }
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Execute handler with proper async flow control
   */
  private async executeHandler(
    handler: NAuthMiddlewareHandler,
    req: NAuthRequest,
    res: NAuthResponse,
    next: ExpressNextFunction,
  ): Promise<void> {
    let nextCalled = false;
    const nextError: unknown = undefined;

    const wrappedNext = (): void => {
      nextCalled = true;
    };

    await handler(req, res, wrappedNext);

    // Only call Express next if handler called next and no response sent
    if (nextCalled && !res.isSent()) {
      next(nextError);
    }
  }

  /**
   * Register a response interceptor
   *
   * Uses res.json monkey-patching to intercept JSON responses.
   * This is the standard pattern for Express response interception.
   */
  public registerResponseInterceptor(handler: NAuthResponseInterceptorHandler): ExpressMiddleware {
    return (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): void => {
      // Ensure we have attribute storage
      if (!req._nauthAttributes) {
        req._nauthAttributes = {};
      }

      const originalJson = res.json.bind(res);

      // Monkey-patch res.json
      res.json = function (body: unknown): ExpressResponse {
        const nauthReq = new ExpressRequestWrapper(req);
        const nauthRes = new ExpressResponseWrapper(res);

        // Execute interceptor synchronously wrapped in promise handling
        Promise.resolve(handler(nauthReq, nauthRes, body))
          .then((modifiedBody) => {
            // Restore original json to prevent recursion
            res.json = originalJson;
            return originalJson(modifiedBody);
          })
          .catch((_error) => {
            // On error, send original body (error handled gracefully)
            res.json = originalJson;
            return originalJson(body);
          });

        // Return res for chaining (Express 5 style)
        return res;
      };

      next();
    };
  }

  /**
   * Wrap a route handler
   *
   * For Express, this provides:
   * - NAuthRequest/NAuthResponse wrappers
   * - Automatic error handling
   * - Context is automatically available (no restoration needed)
   */
  public wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): ExpressMiddleware {
    return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): Promise<void> => {
      // Ensure we have attribute storage
      if (!req._nauthAttributes) {
        req._nauthAttributes = {};
      }

      const nauthReq = new ExpressRequestWrapper(req);
      const nauthRes = new ExpressResponseWrapper(res);

      try {
        const result = await handler(nauthReq, nauthRes);

        // If handler returned a value and response not sent, send it as JSON
        if (result !== undefined && !res.headersSent) {
          res.json(result);
        }
      } catch (error) {
        next(error);
      }
    };
  }
}

// ============================================================================
// Express Request Wrapper
// ============================================================================

/**
 * Wraps Express request into NAuthRequest interface
 */
class ExpressRequestWrapper implements NAuthRequest {
  constructor(private readonly req: ExpressRequest) {}

  get raw(): unknown {
    return this.req;
  }

  get method(): string {
    return this.req.method.toUpperCase();
  }

  get path(): string {
    // Express provides path without query string
    return this.req.path || this.req.url.split('?')[0];
  }

  get url(): string {
    return this.req.originalUrl || this.req.url;
  }

  get body(): Record<string, unknown> {
    return (this.req.body as Record<string, unknown>) || {};
  }

  get query(): Record<string, unknown> {
    return (this.req.query as Record<string, unknown>) || {};
  }

  get params(): Record<string, string> {
    return (this.req.params as Record<string, string>) || {};
  }

  get headers(): Record<string, string | string[] | undefined> {
    return this.req.headers as Record<string, string | string[] | undefined>;
  }

  get cookies(): Record<string, string | undefined> {
    // Express with cookie-parser middleware
    return (this.req.cookies as Record<string, string | undefined>) || {};
  }

  get ip(): string {
    // Express 4.x and 5.x compatible
    // Trust proxy must be configured for X-Forwarded-For
    return this.req.ip || this.req.socket?.remoteAddress || '0.0.0.0';
  }

  get attributes(): NAuthRequestAttributes {
    // Return isolated storage, not raw request
    return this.req._nauthAttributes || {};
  }

  public getHeader(name: string): string | undefined {
    // Express provides req.get() for case-insensitive header lookup
    const val = this.req.get ? this.req.get(name) : this.req.headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  }
}

// ============================================================================
// Express Response Wrapper
// ============================================================================

/**
 * Wraps Express response into NAuthResponse interface
 */
class ExpressResponseWrapper implements NAuthResponse {
  constructor(private readonly res: ExpressResponse) {}

  get raw(): unknown {
    return this.res;
  }

  public status(code: number): this {
    this.res.status(code);
    return this;
  }

  public header(name: string, value: string | string[]): this {
    this.res.setHeader(name, value);
    return this;
  }

  public setCookie(name: string, value: string, options?: NAuthCookieOptions): this {
    // Express provides res.cookie()
    if (typeof this.res.cookie === 'function') {
      this.res.cookie(name, value, this.convertCookieOptions(options));
    }
    return this;
  }

  public clearCookie(name: string, options?: NAuthCookieOptions): this {
    if (typeof this.res.clearCookie === 'function') {
      this.res.clearCookie(name, this.convertCookieOptions(options));
    }
    return this;
  }

  public send(body: unknown): void {
    this.res.send(body);
  }

  public json(body: unknown): void {
    this.res.json(body);
  }

  public redirect(url: string, status?: number): void {
    if (status) {
      this.res.redirect(status, url);
    } else {
      this.res.redirect(url);
    }
  }

  public isSent(): boolean {
    return this.res.headersSent;
  }

  /**
   * Convert NAuth cookie options to Express cookie options
   */
  private convertCookieOptions(options?: NAuthCookieOptions): Record<string, unknown> {
    if (!options) return {};

    return {
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      domain: options.domain,
      path: options.path,
      maxAge: options.maxAge,
      expires: options.expires,
    };
  }
}

// ============================================================================
// Express Type Definitions (minimal, for internal use)
// ============================================================================

/**
 * Express Request type (minimal interface for our needs)
 * Compatible with Express 4.x and 5.x
 */
interface ExpressRequest {
  method: string;
  path: string;
  url: string;
  originalUrl: string;
  body: unknown;
  query: unknown;
  params: unknown;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  ip: string;
  socket?: { remoteAddress?: string };
  get?(name: string): string | undefined;

  /** NAuth attribute storage - isolated from raw request */
  _nauthAttributes?: NAuthRequestAttributes;
}

/**
 * Express Response type (minimal interface for our needs)
 * Compatible with Express 4.x and 5.x
 */
interface ExpressResponse {
  status(code: number): this;
  setHeader(name: string, value: string | string[]): void;
  cookie(name: string, value: string, options?: Record<string, unknown>): void;
  clearCookie(name: string, options?: Record<string, unknown>): void;
  send(body: unknown): void;
  json(body: unknown): this;
  redirect(status: number, url: string): void;
  redirect(url: string): void;
  headersSent: boolean;
}

/**
 * Express NextFunction type
 */
type ExpressNextFunction = (err?: unknown) => void;

/**
 * Express middleware signature
 */
type ExpressMiddleware = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void | Promise<void>;

// ============================================================================
// Type Exports for Consumer Applications
// ============================================================================

/**
 * Express middleware type for use with app.use()
 *
 * Consumer apps should cast nauth.middleware.* to this type:
 * ```typescript
 * app.use(nauth.middleware.clientInfo as ExpressMiddlewareType);
 * ```
 */
export type ExpressMiddlewareType = (req: unknown, res: unknown, next: (err?: unknown) => void) => void | Promise<void>;
