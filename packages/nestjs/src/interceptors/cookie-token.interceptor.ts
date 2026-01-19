import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthResponseDTO } from '@nauth-toolkit/core';
import { TOKEN_DELIVERY_KEY, RouteDelivery } from '../decorators/token-delivery.decorator';
import { SKIP_RECAPTCHA_KEY, REQUIRE_RECAPTCHA_KEY } from '../decorators/recaptcha.decorator';
import { TokenDeliveryHttpService } from '../services/token-delivery-http.service';

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
    private readonly tokenDeliveryHttp: TokenDeliveryHttpService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only operate in HTTP context
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    type GenericRequest = { headers?: Record<string, unknown>; _nauthAttributes?: Record<string, unknown> };
    type GenericResponse = { cookie?: Function; setCookie?: Function } & Record<string, unknown>;
    const req = http.getRequest<GenericRequest>();
    const res = http.getResponse<GenericResponse>();

    // ============================================================================
    // Read reCAPTCHA decorator metadata and set on request attributes
    // ============================================================================
    const skipRecaptcha = this.reflector.get<boolean>(SKIP_RECAPTCHA_KEY, context.getHandler());
    const requireRecaptcha = this.reflector.get<boolean>(REQUIRE_RECAPTCHA_KEY, context.getHandler());

    // Set attributes for AuthService validation logic
    if (!req._nauthAttributes) {
      req._nauthAttributes = {};
    }
    if (skipRecaptcha === true) {
      req._nauthAttributes.nauthSkipRecaptcha = true;
    }
    if (requireRecaptcha === true) {
      req._nauthAttributes.nauthRequireRecaptcha = true;
    }

    // Determine effective delivery for this request
    const routeMode = this.reflector.get<RouteDelivery>(TOKEN_DELIVERY_KEY, context.getHandler());
    const effective = this.tokenDeliveryHttp.resolveEffectiveDelivery(req, routeMode);

    // ============================================================================
    // Expose route-level delivery decision to downstream handlers
    // ============================================================================
    // Social redirect endpoints (and other framework-neutral handlers) may need to
    // know the route-level delivery override in hybrid deployments. Provider callbacks
    // often omit `Origin`, so the only deterministic signal is the route itself.
    //
    // We store it on the request object using a non-enumerable-ish private-ish key.
    // Frameworks tolerate extra properties on the request object (Express/Fastify).
    (req as Record<string, unknown>).__nauthRouteDelivery = routeMode;
    req._nauthAttributes.nauthTokenDeliveryOverride = routeMode;

    return next.handle().pipe(
      map((data: unknown) => {
        // ============================================================================
        // SocialRedirectHandler cookie recipe support (cookies mode)
        // ============================================================================
        // Social redirect endpoints often return only `{ url }` (NestJS @Redirect()).
        // In cookies mode, the core handler sanitizes tokens out of the response body,
        // so we cannot rely on `accessToken` being present to set cookies.
        //
        // SocialRedirectHandler stashes a cookie recipe on the request object:
        //   (req as any).__nauthCookieRecipe = [{ name, value, options }, ...]
        //
        // We apply it here and keep the response body token-free.
        if (effective === 'cookies') {
          const recipe = (req as Record<string, unknown>).__nauthCookieRecipe;
          if (Array.isArray(recipe)) {
            for (const c of recipe) {
              const cookie = c as { name?: unknown; value?: unknown; options?: unknown };
              if (typeof cookie.name === 'string' && typeof cookie.value === 'string') {
                // TokenDeliveryHttpService already supports both Express (`res.cookie`) and Fastify (`res.setCookie`)
                // response shapes via getSetCookieFn().
                // We reuse its cookie-setting compatibility by calling res.cookie / res.setCookie directly.
                if (typeof res.cookie === 'function') {
                  res.cookie(cookie.name, cookie.value, cookie.options);
                } else if (typeof res.setCookie === 'function') {
                  res.setCookie(cookie.name, cookie.value, cookie.options);
                }
              }
            }
            // One-time use: prevent accidental double-application
            delete (req as Record<string, unknown>).__nauthCookieRecipe;
          }
        }

        // ============================================================================
        // Safety: Only process object responses
        // ============================================================================
        // Some consumer endpoints (e.g. health checks) legitimately return primitives
        // like strings. The `in` operator throws on non-objects, so we must no-op.
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return data;
        }

        type TokenishResponse = AuthResponseDTO & { deviceToken?: string };
        const responseData = data as TokenishResponse;
        const record = data as Record<string, unknown>;

        // Handle trust-device endpoint which returns only deviceToken
        const hasDeviceTokenOnly =
          'deviceToken' in record && !('accessToken' in record) && typeof responseData.deviceToken === 'string';
        const hasAccessToken =
          'accessToken' in record && typeof responseData.accessToken === 'string' && !!responseData.accessToken;

        // Only process responses that include tokens OR deviceToken
        if (!hasAccessToken && !hasDeviceTokenOnly) {
          return responseData;
        }

        // Set cookies only when effective is 'cookies'
        if (effective === 'cookies' && hasAccessToken && responseData.accessToken) {
          this.tokenDeliveryHttp.setAuthCookies(res, {
            accessToken: responseData.accessToken,
            refreshToken: typeof responseData.refreshToken === 'string' ? responseData.refreshToken : undefined,
            deviceToken: typeof responseData.deviceToken === 'string' ? responseData.deviceToken : undefined,
          });
          this.tokenDeliveryHttp.setCsrfCookie(res, responseData.accessToken);
        } else if (effective === 'cookies' && hasDeviceTokenOnly && responseData.deviceToken) {
          // trust-device endpoint: cookie only
          this.tokenDeliveryHttp.setDeviceTokenCookie(res, responseData.deviceToken);
        }

        // Strip tokens, deviceToken, and expiration fields only when effective is cookies (strict web path)
        // Expiration is managed by cookie maxAge, so these fields are not needed
        if (effective === 'cookies') {
          if (hasDeviceTokenOnly) {
            // For trust-device endpoint, return empty object (deviceToken set as cookie)
            return {};
          }
          const authData = responseData as AuthResponseDTO;
          const { accessToken, refreshToken, deviceToken, accessTokenExpiresAt, refreshTokenExpiresAt, ...sanitized } =
            authData;
          return sanitized;
        }
        return responseData;
      }),
    );
  }
}
