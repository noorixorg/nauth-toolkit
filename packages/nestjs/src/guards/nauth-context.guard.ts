import { Injectable, CanActivate, ExecutionContext, Inject, Optional } from '@nestjs/common';
import {
  ContextStorage,
  IClientInfo,
  extractClientIp,
  ClientInfoService,
  NAuthConfig,
  getDeviceTokenCookieName,
  NAuthRequest,
  NAuthRequestAttributes,
} from '@nauth-toolkit/core';
import { GeoLocationService } from '@nauth-toolkit/core/internal';

/**
 * Symbol for storing context store on request (avoids property name collisions)
 */
const NAUTH_CONTEXT_STORE = Symbol.for('nauth.contextStore');

/**
 * NAuth Context Guard
 *
 * Runs FIRST for HTTP requests (registered as APP_GUARD).
 * Initializes AsyncLocalStorage context and extracts client information.
 *
 * **Responsibilities:**
 * - Creates a new AsyncLocalStorage store using `ContextStorage.run()`
 * - Stores the created store on the raw request object for subsequent hooks/interceptors
 * - Extracts and stores client info (IP, user agent, device token, geolocation)
 * - Stores HTTP_RESPONSE in context for services that need response access
 *
 * **Why a Guard (not Middleware):**
 * - Guards run before interceptors, ensuring context is available for both guards and controllers
 * - Works with Fastify adapter (Nest middleware is not consistently supported)
 * - Mirrors the core FastifyAdapter pattern for context management
 *
 * @example
 * ```typescript
 * // Registered globally in AuthModule as APP_GUARD
 * // No manual usage required - runs automatically for all HTTP requests
 * ```
 */
@Injectable()
export class NAuthContextGuard implements CanActivate {
  private readonly clientInfoService = new ClientInfoService();

  constructor(
    @Inject('NAUTH_CONFIG')
    private readonly config: NAuthConfig,
    @Optional()
    private readonly geoLocationService?: GeoLocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only operate in HTTP context
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Initialize AsyncLocalStorage context
    // Store the context store on the request for subsequent hooks/interceptors
    return ContextStorage.run(() => {
      // Store context store on request for restoration in interceptor
      (request as Record<symbol, unknown>)[NAUTH_CONTEXT_STORE] = ContextStorage.getStore();

      // Create wrapped request and store in context for core services
      // This is needed for reCAPTCHA decorators and other features that read request attributes
      const wrappedRequest = new NestRequestWrapper(request);
      ContextStorage.set('REQUEST', wrappedRequest);

      // Extract and store client information
      this.extractAndStoreClientInfo(request, response);

      return true;
    });
  }

  /**
   * Extract client information and store in context
   *
   * Equivalent to core ClientInfoHandler behavior.
   */
  private async extractAndStoreClientInfo(request: unknown, response: unknown): Promise<void> {
    const req = request as {
      headers?: Record<string, unknown>;
      cookies?: Record<string, unknown>;
      body?: Record<string, unknown>;
      ip?: string;
    };

    const headers = req.headers || {};
    const userAgent = headers['user-agent'];
    const userAgentString = typeof userAgent === 'string' ? userAgent : 'unknown';

    // Parse user agent to extract platform and browser
    const parsedUA = this.clientInfoService.parseUserAgent(userAgentString);

    // Extract device token from cookie or header
    const deviceTokenCookieName = getDeviceTokenCookieName(this.config);
    const deviceTokenCookie = req.cookies?.[deviceTokenCookieName];
    const deviceTokenHeader = headers['x-device-token'] || headers['X-Device-Token'];
    const deviceToken =
      (typeof deviceTokenCookie === 'string' ? deviceTokenCookie : undefined) ||
      (typeof deviceTokenHeader === 'string' ? deviceTokenHeader : undefined) ||
      (deviceTokenHeader ? String(deviceTokenHeader) : undefined);

    // Extract IP address
    const ipAddress = extractClientIp(req);

    const clientInfo: IClientInfo = {
      ipAddress,
      userAgent: userAgentString,
      deviceToken,
      deviceName: (req.body?.deviceName as string) || parsedUA.deviceName || undefined,
      deviceType: ((req.body?.deviceType as string) || parsedUA.deviceType || undefined) as
        | 'desktop'
        | 'mobile'
        | 'tablet'
        | undefined,
      platform: parsedUA.platform || undefined,
      browser: parsedUA.browser || undefined,
      sessionId: undefined, // Set later by AuthGuard after token validation
      userId: undefined, // Set later by AuthGuard after token validation
      ipCountry: undefined,
      ipCity: undefined,
      ipLatitude: undefined,
      ipLongitude: undefined,
    };

    // Populate geolocation if service available
    if (this.geoLocationService && clientInfo.ipAddress && clientInfo.ipAddress !== '0.0.0.0') {
      try {
        const geo = await this.geoLocationService.getIpGeolocation(clientInfo.ipAddress);
        clientInfo.ipCountry = geo.country;
        clientInfo.ipCity = geo.city;
        clientInfo.ipLatitude = geo.latitude;
        clientInfo.ipLongitude = geo.longitude;
      } catch {
        // Non-blocking: Silently fail - geolocation remains undefined
        // Errors are already logged by GeoLocationService
      }
    }

    // Store in AsyncLocalStorage context
    ContextStorage.set('CLIENT_INFO', clientInfo);
    ContextStorage.set('HTTP_RESPONSE', response);
  }
}

/**
 * Get the context store from request (for use in interceptor)
 */
export function getNAuthContextStore(request: unknown): Map<string, unknown> | undefined {
  return (request as Record<symbol, unknown>)[NAUTH_CONTEXT_STORE] as Map<string, unknown> | undefined;
}

// ============================================================================
// Request Wrapper
// ============================================================================

/**
 * Wraps raw NestJS request (Express/Fastify) into NAuthRequest interface
 *
 * This wrapper provides the standard NAuthRequest interface that core services expect.
 * Most importantly, it maps `_nauthAttributes` (set by interceptors/decorators) to
 * the `attributes` getter that core validation logic reads from.
 */
class NestRequestWrapper implements NAuthRequest {
  constructor(
    private readonly req: {
      method?: string;
      path?: string;
      url?: string;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      params?: Record<string, string>;
      headers?: Record<string, unknown>;
      cookies?: Record<string, unknown>;
      ip?: string;
      socket?: { remoteAddress?: string };
      _nauthAttributes?: NAuthRequestAttributes;
      get?: (name: string) => string | undefined;
    },
  ) {}

  get method(): string {
    return (this.req.method || 'GET').toUpperCase();
  }

  get path(): string {
    // Express uses req.path, Fastify uses req.routerPath or req.url
    return (this.req.path || this.req.url || '/').split('?')[0];
  }

  get url(): string {
    return this.req.url || '';
  }

  get body(): Record<string, unknown> {
    return this.req.body || {};
  }

  get query(): Record<string, unknown> {
    return this.req.query || {};
  }

  get params(): Record<string, string> {
    return this.req.params || {};
  }

  get headers(): Record<string, string | string[] | undefined> {
    return (this.req.headers || {}) as Record<string, string | string[] | undefined>;
  }

  get cookies(): Record<string, string | undefined> {
    return (this.req.cookies || {}) as Record<string, string | undefined>;
  }

  get ip(): string {
    return this.req.ip || this.req.socket?.remoteAddress || '0.0.0.0';
  }

  get attributes(): NAuthRequestAttributes {
    // Map _nauthAttributes (set by interceptors) to attributes (read by core)
    return this.req._nauthAttributes || {};
  }

  get raw(): unknown {
    return this.req;
  }

  public getHeader(name: string): string | undefined {
    // Try Express-style req.get() first, then fallback to direct header access
    if (typeof this.req.get === 'function') {
      return this.req.get(name);
    }
    const headers = this.req.headers || {};
    const val = headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] as string;
    return val as string | undefined;
  }
}
