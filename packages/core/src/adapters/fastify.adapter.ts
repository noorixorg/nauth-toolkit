/**
 * Fastify Framework Adapter
 *
 * Adapts NAuth to work with Fastify with proper AsyncLocalStorage support.
 *
 * **Context Management:**
 * - First hook (clientInfo) initializes AsyncLocalStorage context
 * - Context is stored on request object for subsequent hooks
 * - Each hook restores context using ContextStorage.enterStore()
 * - Route handlers MUST use wrapRouteHandler() for context access
 *
 * **Why Context Restoration is Needed:**
 * Unlike Express where middleware runs in a continuous call stack,
 * Fastify hooks run independently. Each hook invocation loses the
 * AsyncLocalStorage context, so we store it on the request and restore it.
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

// Symbol for storing context on request (avoids property name collisions)
const NAUTH_CONTEXT_STORE = Symbol.for('nauth.contextStore');
const NAUTH_ATTRIBUTES = Symbol.for('nauth.attributes');

// ============================================================================
// Fastify Adapter
// ============================================================================

/**
 * Fastify Adapter Implementation
 *
 * Provides NAuth integration for Fastify applications.
 */
export class FastifyAdapter implements NAuthAdapter {
  public readonly name = 'FastifyAdapter';

  /**
   * Register a middleware handler as Fastify hook
   *
   * Handles context initialization for first hook and restoration for subsequent hooks.
   */
  public registerMiddleware(name: string, handler: NAuthMiddlewareHandler, options?: MiddlewareOptions): FastifyHook {
    const initializesContext = options?.initializesContext || name === 'clientInfo';

    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // Ensure we have attribute storage
      this.ensureAttributes(request);

      const nauthReq = new FastifyRequestWrapper(request);
      const nauthRes = new FastifyResponseWrapper(reply);

      if (initializesContext) {
        // First hook - initialize context
        await ContextStorage.run(async () => {
          // Store context on request for subsequent hooks
          (request as FastifyRequestWithContext)[NAUTH_CONTEXT_STORE] = ContextStorage.getStore();
          await this.executeHandler(handler, nauthReq, nauthRes);
        });
      } else {
        // Subsequent hook - restore context
        const store = (request as FastifyRequestWithContext)[NAUTH_CONTEXT_STORE];

        if (store) {
          await ContextStorage.enterStore(store, async () => {
            await this.executeHandler(handler, nauthReq, nauthRes);
          });
        } else {
          // No context available - execute without context
          // This shouldn't happen if clientInfo runs first
          await this.executeHandler(handler, nauthReq, nauthRes);
        }
      }
    };
  }

  /**
   * Execute handler with proper async flow control
   */
  private async executeHandler(handler: NAuthMiddlewareHandler, req: NAuthRequest, res: NAuthResponse): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const result = handler(req, res, () => {
        resolve();
      });

      if (result instanceof Promise) {
        result.then(() => resolve()).catch(reject);
      }
    });
  }

  /**
   * Register a response interceptor using Fastify onSend hook
   *
   * The onSend hook receives the serialized payload before sending.
   */
  public registerResponseInterceptor(handler: NAuthResponseInterceptorHandler): FastifyOnSendHook {
    return async (request: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<unknown> => {
      this.ensureAttributes(request);

      const nauthReq = new FastifyRequestWrapper(request);
      const nauthRes = new FastifyResponseWrapper(reply);

      // Restore context for interceptor
      const store = (request as FastifyRequestWithContext)[NAUTH_CONTEXT_STORE];

      if (!store) {
        // No context - pass through unchanged
        return payload;
      }

      return ContextStorage.enterStore(store, async () => {
        try {
          let parsedPayload = payload;

          // Parse JSON payload if needed (Fastify serializes before onSend)
          const contentType = reply.getHeader('content-type') as string | undefined;
          const isJson = contentType?.includes('application/json');

          if (isJson && typeof payload === 'string') {
            try {
              parsedPayload = JSON.parse(payload);
            } catch {
              // Not valid JSON, use as-is
            }
          }

          const modifiedBody = await handler(nauthReq, nauthRes, parsedPayload);

          // Re-serialize if we parsed it
          if (modifiedBody !== parsedPayload && isJson && typeof modifiedBody === 'object') {
            return JSON.stringify(modifiedBody);
          }

          return modifiedBody !== parsedPayload ? modifiedBody : payload;
        } catch {
          // On error, return original payload
          return payload;
        }
      });
    };
  }

  /**
   * Wrap a route handler to ensure context is available
   *
   * For Fastify, this is REQUIRED for route handlers to access ContextStorage.
   */
  public wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): FastifyRouteHandler {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<T | void> => {
      this.ensureAttributes(request);

      const nauthReq = new FastifyRequestWrapper(request);
      const nauthRes = new FastifyResponseWrapper(reply);

      // Restore context
      const store = (request as FastifyRequestWithContext)[NAUTH_CONTEXT_STORE];

      if (store) {
        return ContextStorage.enterStore(store, async () => {
          return handler(nauthReq, nauthRes);
        });
      }

      // No context - execute without (shouldn't happen with proper setup)
      return handler(nauthReq, nauthRes);
    };
  }

  /**
   * Ensure attribute storage exists on request
   */
  private ensureAttributes(request: FastifyRequest): void {
    if (!(request as FastifyRequestWithContext)[NAUTH_ATTRIBUTES]) {
      (request as FastifyRequestWithContext)[NAUTH_ATTRIBUTES] = {};
    }
  }
}

// ============================================================================
// Fastify Request Wrapper
// ============================================================================

/**
 * Wraps Fastify request into NAuthRequest interface
 */
class FastifyRequestWrapper implements NAuthRequest {
  constructor(private readonly request: FastifyRequest) {}

  get raw(): unknown {
    return this.request;
  }

  get method(): string {
    return this.request.method.toUpperCase();
  }

  get path(): string {
    // Fastify provides routeOptions.url for path, or extract from url
    return this.request.url.split('?')[0];
  }

  get url(): string {
    return this.request.url;
  }

  get body(): Record<string, unknown> {
    return (this.request.body as Record<string, unknown>) || {};
  }

  get query(): Record<string, unknown> {
    return (this.request.query as Record<string, unknown>) || {};
  }

  get params(): Record<string, string> {
    return (this.request.params as Record<string, string>) || {};
  }

  get headers(): Record<string, string | string[] | undefined> {
    return this.request.headers as Record<string, string | string[] | undefined>;
  }

  get cookies(): Record<string, string | undefined> {
    // Fastify with @fastify/cookie
    return ((this.request as FastifyRequestWithCookies).cookies as Record<string, string | undefined>) || {};
  }

  get ip(): string {
    return this.request.ip || '0.0.0.0';
  }

  get attributes(): NAuthRequestAttributes {
    // Return isolated storage
    return (this.request as FastifyRequestWithContext)[NAUTH_ATTRIBUTES] || {};
  }

  public getHeader(name: string): string | undefined {
    const val = this.request.headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  }
}

// ============================================================================
// Fastify Response Wrapper
// ============================================================================

/**
 * Wraps Fastify reply into NAuthResponse interface
 */
class FastifyResponseWrapper implements NAuthResponse {
  constructor(private readonly reply: FastifyReply) {}

  get raw(): unknown {
    return this.reply;
  }

  public status(code: number): this {
    this.reply.code(code);
    return this;
  }

  public header(name: string, value: string | string[]): this {
    this.reply.header(name, value);
    return this;
  }

  public setCookie(name: string, value: string, options?: NAuthCookieOptions): this {
    // Fastify with @fastify/cookie
    const replyWithCookies = this.reply as FastifyReplyWithCookies;
    if (typeof replyWithCookies.setCookie === 'function') {
      replyWithCookies.setCookie(name, value, this.convertCookieOptions(options));
    }
    return this;
  }

  public clearCookie(name: string, options?: NAuthCookieOptions): this {
    const replyWithCookies = this.reply as FastifyReplyWithCookies;
    if (typeof replyWithCookies.clearCookie === 'function') {
      replyWithCookies.clearCookie(name, this.convertCookieOptions(options));
    } else if (typeof replyWithCookies.setCookie === 'function') {
      // Fallback: set empty cookie with immediate expiry
      replyWithCookies.setCookie(name, '', {
        ...this.convertCookieOptions(options),
        maxAge: 0,
        expires: new Date(0),
      });
    }
    return this;
  }

  public send(body: unknown): void {
    this.reply.send(body);
  }

  public json(body: unknown): void {
    // Fastify auto-serializes objects
    this.reply.send(body);
  }

  public redirect(url: string, status?: number): void {
    if (status) {
      this.reply.redirect(status, url);
    } else {
      this.reply.redirect(url);
    }
  }

  public isSent(): boolean {
    return this.reply.sent;
  }

  /**
   * Convert NAuth cookie options to Fastify cookie options
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
      priority: options.priority,
    };
  }
}

// ============================================================================
// Fastify Type Definitions (minimal, for internal use)
// ============================================================================

interface FastifyRequest {
  method: string;
  url: string;
  body: unknown;
  query: unknown;
  params: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}

interface FastifyRequestWithCookies extends FastifyRequest {
  cookies?: Record<string, string>;
}

interface FastifyRequestWithContext extends FastifyRequest {
  [NAUTH_CONTEXT_STORE]?: Map<string, unknown>;
  [NAUTH_ATTRIBUTES]?: NAuthRequestAttributes;
}

interface FastifyReply {
  code(statusCode: number): this;
  header(name: string, value: string | string[]): this;
  send(payload?: unknown): this;
  redirect(url: string): this;
  redirect(statusCode: number, url: string): this;
  getHeader(name: string): string | undefined;
  sent: boolean;
}

interface FastifyReplyWithCookies extends FastifyReply {
  setCookie?(name: string, value: string, options?: Record<string, unknown>): this;
  clearCookie?(name: string, options?: Record<string, unknown>): this;
}

type FastifyHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
type FastifyOnSendHook = (request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<unknown>;
type FastifyRouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

// ============================================================================
// NOTE
// ============================================================================
// For route handlers, use `nauth.adapter.wrapRouteHandler(...)` to ensure AsyncLocalStorage
// context is available when calling `nauth.helpers.*` and context-dependent services.
