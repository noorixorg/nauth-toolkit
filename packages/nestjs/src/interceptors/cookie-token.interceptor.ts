import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AuthResponseDTO,
  NAuthConfig,
  TokenDeliveryConfig,
  NAuthException,
  AuthErrorCode,
  resolveDeliveryForRequest,
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
} from '@nauth-toolkit/core';
import { JwtService } from '@nauth-toolkit/core/internal';
import { TOKEN_DELIVERY_KEY, RouteDelivery } from '../decorators/token-delivery.decorator';
import { CsrfService } from '../services/csrf.service';

/**
 * Cookie Token Interceptor
 *
 * Automatically sets JWT tokens as httpOnly cookies for HTTP responses when
 * token delivery mode is configured as 'cookies' or 'hybrid'.
 *
 * Security defaults:
 * - Cookie names prefixed with 'nauth_' to avoid conflicts: 'nauth_access_token', 'nauth_refresh_token'
 * - httpOnly: true (always)
 * - secure: true (configurable via cookieOptions.secure)
 * - sameSite: 'strict' (configurable via cookieOptions.sameSite)
 * - path: '/' (configurable via cookieOptions.path)
 *
 * This interceptor is transport-aware and only applies to HTTP requests.
 * It does nothing in other contexts (e.g., WebSocket, GraphQL).
 */
@Injectable()
export class CookieTokenInterceptor implements NestInterceptor {
  constructor(
    @Inject('NAUTH_CONFIG')
    private readonly config: NAuthConfig,
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly csrfService?: CsrfService, // Optional - only available when CSRF is enabled
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only operate in HTTP context
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const deliveryConfig: TokenDeliveryConfig | undefined = this.config.tokenDelivery;
    const http = context.switchToHttp();
    type GenericRequest = { headers?: Record<string, unknown> };
    type GenericResponse = { cookie?: Function; setCookie?: Function } & Record<string, unknown>;
    const req = http.getRequest<GenericRequest>();
    const res = http.getResponse<GenericResponse>();

    // Determine effective delivery for this request
    const routeMode = this.reflector.get<RouteDelivery>(TOKEN_DELIVERY_KEY, context.getHandler());
    const method = deliveryConfig?.method || 'json';

    // Validate route-level delivery mode against global configuration
    if (routeMode === 'cookies') {
      // Route requests cookies - config must allow cookies (cookies or hybrid)
      if (method === 'json') {
        throw new NAuthException(
          AuthErrorCode.COOKIES_NOT_ALLOWED,
          "Route-level cookie delivery requested, but tokenDelivery.method is 'json' (cookies disabled)",
        );
      }
      // method === 'cookies' or 'hybrid' - both allow cookies, so OK
    } else if (routeMode === 'json') {
      // Route requests JSON - config must allow JSON (json or hybrid)
      if (method === 'cookies') {
        throw new NAuthException(
          AuthErrorCode.BEARER_NOT_ALLOWED,
          "Route-level JSON delivery requested, but tokenDelivery.method is 'cookies' (JSON/Bearer tokens disabled)",
        );
      }
      // method === 'json' or 'hybrid' - both allow JSON, so OK
    }

    let effective: 'cookies' | 'json' = 'json';
    if (routeMode) {
      effective = routeMode;
    } else if (method === 'hybrid') {
      effective = resolveDeliveryForRequest(req, deliveryConfig?.hybridPolicy);
    } else if (method === 'cookies') {
      effective = 'cookies';
    } else {
      effective = 'json';
    }

    return next.handle().pipe(
      map((data: AuthResponseDTO | { deviceToken?: string }) => {
        // Handle trust-device endpoint which returns only deviceToken
        const hasDeviceTokenOnly = data && 'deviceToken' in data && !('accessToken' in data);
        const hasAccessToken = data && 'accessToken' in data && data.accessToken;

        // Only process responses that include tokens OR deviceToken
        if (!data || (!hasAccessToken && !hasDeviceTokenOnly)) {
          return data;
        }

        // Smart default cookie options
        const opt = deliveryConfig?.cookieOptions;

        // Cookie domain handling:
        // - undefined: Cookie set for exact host:port (e.g., localhost:3000)
        //   For cross-port requests (localhost:4200 → localhost:3000), cookies work IF:
        //   - Frontend sends withCredentials: true
        //   - Backend CORS allows credentials
        //   - SameSite allows cross-site requests (e.g., 'lax' or 'none')
        //
        // - 'localhost' or '.localhost': Some browsers accept this, others reject it
        //   Modern browsers generally allow 'localhost' without domain attribute
        //
        // - '.example.com': For production cross-subdomain sharing
        //   Allows cookies set by api.example.com to be sent from app.example.com
        const cookieOptions: {
          httpOnly: true;
          secure: boolean;
          sameSite: 'strict' | 'lax' | 'none';
          path: string;
          domain?: string;
        } = {
          httpOnly: true as const,
          secure: opt?.secure !== false, // default true
          sameSite: (opt?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
          path: opt?.path || '/',
        };

        // Include domain if provided (browsers handle localhost differently - some accept, some reject)
        // For cross-port testing (like Cognito), omitting domain works with sameSite: 'lax' or 'none'
        if (opt?.domain) {
          cookieOptions.domain = opt.domain;
        }

        // Derive expiry strictly from JWT claims (no fallback)
        // We decode here (signature already trusted as tokens are freshly issued);
        // full validation and blacklist checks happen in the AuthGuard on subsequent requests.
        let accessTokenMaxAgeMs = 0;
        if (hasAccessToken && 'accessToken' in data && data.accessToken) {
          const accessPayload = this.jwtService.decodeToken(data.accessToken);
          if (!accessPayload?.exp) {
            throw new NAuthException(
              AuthErrorCode.TOKEN_INVALID,
              'Access token missing or invalid exp claim; refusing to set cookies',
            );
          }
          const accessExpSeconds = accessPayload.exp as number;
          accessTokenMaxAgeMs = Math.max(0, accessExpSeconds * 1000 - Date.now());
          if (accessTokenMaxAgeMs <= 0) {
            throw new NAuthException(
              AuthErrorCode.TOKEN_INVALID,
              'Access token already expired; refusing to set cookies',
            );
          }
        }

        const setCookie = (name: string, value: string, options: Record<string, unknown>) => {
          if (res && typeof res.cookie === 'function') {
            res.cookie(name, value, options);
          } else if (res && typeof res.setCookie === 'function') {
            res.setCookie(name, value, options);
          }
        };

        // Set cookies only when effective is 'cookies'
        if (effective === 'cookies' && hasAccessToken && 'accessToken' in data && data.accessToken) {
          const accessTokenCookieName = getAccessTokenCookieName(this.config);
          setCookie(accessTokenCookieName, data.accessToken, {
            ...cookieOptions,
            maxAge: accessTokenMaxAgeMs,
          });
        }

        if ('refreshToken' in data && data.refreshToken && effective === 'cookies') {
          const refreshPayload = this.jwtService.decodeToken(data.refreshToken);
          if (!refreshPayload?.exp) {
            throw new NAuthException(
              AuthErrorCode.TOKEN_INVALID,
              'Refresh token missing or invalid exp claim; refusing to set cookies',
            );
          }
          const refreshExpSeconds = refreshPayload.exp as number;
          const refreshTokenMaxAgeMs = Math.max(0, refreshExpSeconds * 1000 - Date.now());
          if (refreshTokenMaxAgeMs <= 0) {
            throw new NAuthException(
              AuthErrorCode.TOKEN_INVALID,
              'Refresh token already expired; refusing to set cookies',
            );
          }
          const refreshTokenCookieName = getRefreshTokenCookieName(this.config);
          setCookie(refreshTokenCookieName, data.refreshToken, {
            ...cookieOptions,
            maxAge: refreshTokenMaxAgeMs,
          });
        }

        // Set device token cookie for trusted device feature (web)
        // Only set cookie when deviceToken is present and effective is cookies
        // (hybrid mode may resolve to cookies for web origins)
        if ('deviceToken' in data && data.deviceToken && effective === 'cookies') {
          const rememberDeviceDays = this.config.mfa?.rememberDeviceDays || 30;
          const deviceTokenMaxAgeMs = rememberDeviceDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
          // Use hardcoded name to match original working implementation
          // TODO: Make configurable via cookieNamePrefix after verifying it works
          setCookie('nauth_device_id', data.deviceToken, {
            ...cookieOptions,
            maxAge: deviceTokenMaxAgeMs,
          });
        }

        // Set CSRF token cookie when using cookie-based token delivery
        // CSRF token is required for state-changing requests to prevent CSRF attacks
        if (effective === 'cookies' && this.csrfService && this.config.security?.csrf) {
          const csrfToken = this.csrfService.generateToken();
          const csrfCookieName = this.csrfService.getCookieName();
          const csrfCookieOptions = this.csrfService.getCookieOptions();

          // Use same max age as access token for CSRF cookie
          // This ensures CSRF token expires when access token expires
          setCookie(csrfCookieName, csrfToken, {
            ...csrfCookieOptions,
            maxAge: accessTokenMaxAgeMs > 0 ? accessTokenMaxAgeMs : undefined,
          });
        }

        // Strip tokens and deviceToken only when effective is cookies (strict web path)
        if (effective === 'cookies') {
          if (hasDeviceTokenOnly) {
            // For trust-device endpoint, return empty object (deviceToken set as cookie)
            return {};
          }
          const authData = data as AuthResponseDTO;
          const { accessToken, refreshToken, deviceToken, ...sanitized } = authData;
          return sanitized;
        }
        return data;
      }),
    );
  }
}
