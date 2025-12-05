import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Optional } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import {
  ContextStorage,
  IClientInfo,
  extractClientIp,
  ClientInfoService,
} from '@nauth-toolkit/core';
import { GeoLocationService } from '@nauth-toolkit/core/internal';

/**
 * Client Info Interceptor
 *
 * Automatically extracts client information (IP address, user agent, device info)
 * from incoming HTTP requests and stores it in async local storage (CLS).
 *
 * This interceptor runs globally when configured in AuthModule, ensuring that
 * all authentication services have transparent access to client metadata without
 * needing to pass it as parameters.
 *
 * Benefits:
 * - Transparent IP/user agent handling (like AWS Cognito)
 * - Handles proxies and load balancers automatically
 * - No parameters needed - services read from context automatically
 * - Works across async boundaries
 * - Type-safe and consistent
 *
 * @example
 * // In your controller (no IP/UA parameters needed!)
 * @Post('login')
 * async login(@Body() dto: LoginDTO) {
 *   return this.authService.login(dto); // IP extracted internally!
 * }
 *
 * // In AuthService (reads from context automatically)
 * async login(dto: LoginDTO) {
 *   const clientInfo = this.clientInfoService.get(); // From context!
 *   // Use clientInfo.ipAddress, clientInfo.userAgent, etc.
 * }
 */
@Injectable()
export class ClientInfoInterceptor implements NestInterceptor {
  private readonly clientInfoService = new ClientInfoService();

  constructor(
    @Optional()
    private readonly geoLocationService?: GeoLocationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Initialize context storage for this request (platform-agnostic)
    return new Observable((subscriber) => {
      ContextStorage.run(() => {
        this.extractAndStoreClientInfo(context, next).subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }

  /**
   * Extract and store client information in context
   *
   * @param context - Execution context
   * @param next - Call handler
   * @returns Observable
   */
  private extractAndStoreClientInfo(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract client information
    const headers = request.headers || {};
    const userAgent = headers['user-agent'];
    const userAgentString = typeof userAgent === 'string' ? userAgent : 'unknown';

    // Parse user agent to extract platform and browser using ClientInfoService
    const parsedUA = this.clientInfoService.parseUserAgent(userAgentString);

    // Extract device token from cookie (web) or header (mobile)
    // Security: Never accept device token from request body (prevent client manipulation)
    // Use hardcoded name to match original working implementation
    // TODO: Make configurable via cookieNamePrefix after verifying it works
    const deviceTokenCookie = request.cookies?.['nauth_device_id'];
    const deviceTokenHeader = headers['x-device-token'] || headers['X-Device-Token'];
    const deviceToken =
      (typeof deviceTokenCookie === 'string' ? deviceTokenCookie : undefined) ||
      (typeof deviceTokenHeader === 'string' ? deviceTokenHeader : undefined) ||
      (deviceTokenHeader ? String(deviceTokenHeader) : undefined);

    // Extract sessionId from token (set by AuthGuard after validation)
    // sessionId is a string in JWT payload, convert to number for database
    const sessionIdFromToken: string | undefined = request?.token?.sessionId;
    const sessionIdNumber: number | undefined = sessionIdFromToken ? parseInt(sessionIdFromToken, 10) : undefined;

    const clientInfo: IClientInfo = {
      //ipAddress: extractClientIp(request),
      /**
       * In development mode, assign a random known public IP address
       * for better testability (to trigger geolocation flows, etc.).
       * In production, default to 'unknown' if IP extraction fails.
       */
      ipAddress: extractClientIp(request),
      // process.env.NODE_ENV === 'development'
      //   ? [
      //       '203.97.24.118', // Invercargill, New Zealand
      //       '194.103.82.33', // Umeå, Sweden
      //       '80.12.134.67', // La Rochelle, France
      //       '124.148.98.45', // Port Hedland, Australia
      //       '200.68.114.22', // Mar del Plata, Argentina
      //       '213.216.200.77', // Oulu, Finland
      //       '206.248.142.91', // Timmins, Canada
      //       '95.43.18.140', // Plovdiv, Bulgaria
      //       '110.164.231.162', // Surat Thani, Thailand
      //       '190.186.7.20', // Cochabamba, Bolivia
      //     ][Math.floor(Math.random() * 10)]
      //   : extractClientIp(request),

      userAgent: userAgentString,
      deviceToken, // Extracted from cookie or header only
      // Use deviceName from request body if provided, otherwise parse from user agent
      deviceName: request.body?.deviceName || parsedUA.deviceName || undefined,
      deviceType: request.body?.deviceType || parsedUA.deviceType || undefined,
      platform: parsedUA.platform || undefined,
      browser: parsedUA.browser || undefined,
      // Session ID from authenticated request (set by AuthGuard after token validation)
      sessionId: sessionIdNumber && !isNaN(sessionIdNumber) ? sessionIdNumber : undefined,
      // Geolocation populated below if GeoLocationService is available
      ipCountry: undefined,
      ipCity: undefined,
    };

    // ============================================================================
    // Populate Geolocation (Optional)
    // ============================================================================
    if (this.geoLocationService && clientInfo.ipAddress) {
      // Use RxJS operators to await geolocation lookup
      return from(this.geoLocationService.getIpGeolocation(clientInfo.ipAddress)).pipe(
        switchMap((geo) => {
          // Update clientInfo with geolocation
          clientInfo.ipCountry = geo.country;
          clientInfo.ipCity = geo.city;

          // Store in async local storage for transparent access
          ContextStorage.set('CLIENT_INFO', clientInfo);

          // Store response object for services to access (e.g., for clearing cookies)
          ContextStorage.set('HTTP_RESPONSE', response);

          // Also attach to request object for @ClientInfo() decorator (backward compatibility)
          request.clientInfo = clientInfo;

          // Expose current session id for observability/debugging (set by AuthGuard after validation)
          // This is safe metadata; tokens are never exposed. If unavailable, header is omitted.
          const sessionId: string | undefined = request?.token?.sessionId;
          if (sessionId && typeof response.setHeader === 'function') {
            response.setHeader('X-Session-Id', sessionId);
          }

          return next.handle();
        }),
        catchError(() => {
          // Non-blocking: Silently fail - geolocation remains undefined
          // Errors are already logged by GeoLocationService
          // Store in async local storage without geolocation
          ContextStorage.set('CLIENT_INFO', clientInfo);

          // Store response object for services to access (e.g., for clearing cookies)
          ContextStorage.set('HTTP_RESPONSE', response);

          request.clientInfo = clientInfo;

          const sessionId: string | undefined = request?.token?.sessionId;
          if (sessionId && typeof response.setHeader === 'function') {
            response.setHeader('X-Session-Id', sessionId);
          }

          return next.handle();
        }),
      );
    }

    // Store in async local storage for transparent access
    ContextStorage.set('CLIENT_INFO', clientInfo);

    // Store response object for services to access (e.g., for clearing cookies)
    ContextStorage.set('HTTP_RESPONSE', response);

    // Also attach to request object for @ClientInfo() decorator (backward compatibility)
    request.clientInfo = clientInfo;

    // Expose current session id for observability/debugging (set by AuthGuard after validation)
    // This is safe metadata; tokens are never exposed. If unavailable, header is omitted.
    const sessionId: string | undefined = request?.token?.sessionId;
    if (sessionId && typeof response.setHeader === 'function') {
      response.setHeader('X-Session-Id', sessionId);
    }

    return next.handle();
  }
}
