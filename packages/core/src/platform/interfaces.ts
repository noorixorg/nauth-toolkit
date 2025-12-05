/**
 * Platform Abstraction Interfaces
 *
 * Defines generic interfaces for HTTP requests and responses to decouple
 * the core logic from specific frameworks (Express, Fastify, Koa, etc.).
 *
 * **Design Principles:**
 * - Handlers MUST NOT access `raw` directly - all needed properties exposed via interface
 * - Adapters are responsible for context management (AsyncLocalStorage)
 * - Handlers assume context is available and focus purely on business logic
 */

// ============================================================================
// Request Interface
// ============================================================================

/**
 * Standardized HTTP Request interface
 *
 * Provides framework-agnostic access to request data. Handlers should use
 * these properties instead of accessing `raw` directly.
 */
export interface NAuthRequest {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) - always uppercase */
  readonly method: string;

  /** Request path without query string (e.g., /api/auth/login) */
  readonly path: string;

  /** Full request URL including query string */
  readonly url: string;

  /** Request body (parsed JSON/form data) */
  readonly body: Record<string, unknown>;

  /** URL query parameters */
  readonly query: Record<string, unknown>;

  /** URL path parameters (e.g., :id in /users/:id) */
  readonly params: Record<string, string>;

  /** HTTP Headers (lowercase keys) */
  readonly headers: Record<string, string | string[] | undefined>;

  /** Parsed cookies */
  readonly cookies: Record<string, string | undefined>;

  /** Client IP address */
  readonly ip: string;

  /**
   * Request-scoped attribute storage
   *
   * Used for passing data between handlers (e.g., user, token, clientInfo).
   * This is isolated storage managed by the adapter, NOT the raw request object.
   */
  readonly attributes: NAuthRequestAttributes;

  /**
   * Underlying framework request object (escape hatch)
   *
   * @deprecated Avoid using raw - add needed properties to NAuthRequest interface instead.
   *             Only use for framework-specific edge cases.
   */
  readonly raw: unknown;

  /**
   * Get a header value in a case-insensitive way
   *
   * @param name - Header name (case-insensitive)
   * @returns Header value as string, or undefined if not found
   */
  getHeader(name: string): string | undefined;
}

/**
 * Request attributes storage interface
 *
 * Provides type-safe access to common NAuth attributes.
 */
export interface NAuthRequestAttributes {
  /** Current authenticated user (set by AuthHandler) */
  user?: unknown;

  /** JWT payload (set by AuthHandler) */
  token?: unknown;

  /** Client info extracted by ClientInfoHandler */
  clientInfo?: unknown;

  /** Route marked as public (bypasses CSRF) */
  nauthPublic?: boolean;

  /** Deferred CSRF validation error */
  nauthCsrfError?: Error;

  /** Token delivery mode override */
  nauthTokenDelivery?: 'json' | 'cookies';

  /** Allow arbitrary string keys for extensibility */
  [key: string]: unknown;
}

// ============================================================================
// Response Interface
// ============================================================================

/**
 * Cookie options for setCookie/clearCookie
 */
export interface NAuthCookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: Date;
}

/**
 * Standardized HTTP Response interface
 *
 * Provides framework-agnostic response methods.
 */
export interface NAuthResponse {
  /**
   * Underlying framework response object (escape hatch)
   *
   * @deprecated Avoid using raw - add needed methods to NAuthResponse interface instead.
   */
  readonly raw: unknown;

  /**
   * Set HTTP status code
   *
   * @param code - Status code (e.g., 200, 401, 500)
   * @returns this for method chaining
   */
  status(code: number): this;

  /**
   * Set HTTP header
   *
   * @param name - Header name
   * @param value - Header value(s)
   * @returns this for method chaining
   */
  header(name: string, value: string | string[]): this;

  /**
   * Set a cookie
   *
   * @param name - Cookie name
   * @param value - Cookie value
   * @param options - Cookie options
   * @returns this for method chaining
   */
  setCookie(name: string, value: string, options?: NAuthCookieOptions): this;

  /**
   * Clear a cookie
   *
   * @param name - Cookie name
   * @param options - Cookie options (path/domain must match original)
   * @returns this for method chaining
   */
  clearCookie(name: string, options?: NAuthCookieOptions): this;

  /**
   * Send response body
   *
   * @param body - Response body (string, object, buffer)
   */
  send(body: unknown): void;

  /**
   * Send JSON response
   *
   * @param body - Object to serialize as JSON
   */
  json(body: unknown): void;

  /**
   * Redirect to URL
   *
   * @param url - Target URL
   * @param status - HTTP status code (default: 302)
   */
  redirect(url: string, status?: number): void;

  /**
   * Check if response has been sent
   *
   * @returns true if headers have been sent
   */
  isSent(): boolean;
}

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Handler function signature for middleware
 */
export type NAuthMiddlewareHandler = (
  req: NAuthRequest,
  res: NAuthResponse,
  next: () => Promise<void> | void,
) => Promise<void> | void;

/**
 * Handler function signature for response interceptors
 */
export type NAuthResponseInterceptorHandler = (
  req: NAuthRequest,
  res: NAuthResponse,
  body: unknown,
) => Promise<unknown>;

/**
 * Handler function signature for route handlers
 */
export type NAuthRouteHandler<T = unknown> = (req: NAuthRequest, res: NAuthResponse) => Promise<T> | T;

/**
 * Platform Adapter Interface
 *
 * Implemented by framework-specific adapters (ExpressAdapter, FastifyAdapter, etc.).
 *
 * **Responsibilities:**
 * 1. Wrap framework req/res into NAuthRequest/NAuthResponse
 * 2. Manage AsyncLocalStorage context (initialize, preserve across hooks)
 * 3. Convert handlers to framework-specific middleware/hooks
 * 4. Handle errors appropriately for the framework
 *
 * **Context Management Contract:**
 * - The FIRST middleware registered (clientInfo) initializes the context
 * - Subsequent middleware must have access to the same context
 * - Route handlers wrapped with `wrapRouteHandler` must have context access
 */
export interface NAuthAdapter {
  /**
   * Register a middleware/hook handler
   *
   * The adapter is responsible for:
   * - Wrapping req/res into NAuthRequest/NAuthResponse
   * - Managing AsyncLocalStorage context
   * - Calling handler with wrapped objects
   * - Handling errors
   *
   * @param name - Handler name (e.g., 'clientInfo', 'auth', 'csrf')
   * @param handler - The generic handler function
   * @param options - Optional configuration for this middleware
   * @returns Framework-specific middleware/hook
   */
  registerMiddleware(name: string, handler: NAuthMiddlewareHandler, options?: MiddlewareOptions): unknown;

  /**
   * Register a response interceptor (for Token Delivery)
   *
   * The interceptor receives the response body before it's sent and can modify it.
   * Used to inject tokens into cookies or modify response payload.
   *
   * @param handler - Handler that receives body and returns modified body
   * @returns Framework-specific response interceptor
   */
  registerResponseInterceptor(handler: NAuthResponseInterceptorHandler): unknown;

  /**
   * Wrap a route handler to ensure context is available
   *
   * For frameworks like Fastify where handlers run outside the middleware context,
   * this wrapper ensures AsyncLocalStorage context is restored.
   *
   * For Express, this may be a no-op or provide additional functionality.
   *
   * @param handler - Route handler function
   * @returns Framework-specific wrapped handler
   */
  wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): unknown;

  /**
   * Get the adapter name for logging/debugging
   */
  readonly name: string;
}

/**
 * Options for middleware registration
 */
export interface MiddlewareOptions {
  /**
   * Whether this middleware initializes the context
   * Only the first middleware (clientInfo) should set this to true
   */
  initializesContext?: boolean;
}
