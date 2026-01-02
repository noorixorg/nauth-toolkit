import * as crypto from 'crypto';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthResponseDTO } from '../dto/auth-response.dto';
import { NAuthException } from '../exceptions/nauth.exception';
import { NAuthConfig } from '../interfaces/config.interface';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthCookieOptions } from '../platform/interfaces';
import { SocialProviderRegistry } from '../services/social-provider-registry.service';
import { CsrfService } from '../services/csrf.service';
import {
  getAccessTokenCookieName,
  getDeviceTokenCookieName,
  getRefreshTokenCookieName,
} from '../utils/cookie-names.util';
import { resolveDeliveryForRequest } from '../utils/token-delivery-policy';
import { NAuthLogger } from '../utils/nauth-logger';

/**
 * Social Redirect Handler (framework-neutral)
 *
 * Consumer backends should implement their own HTTP controllers/routes and delegate to this handler.
 * The handler returns a small "response recipe" that the consumer applies to their framework response.
 *
 * Key properties:
 * - Backend-first redirect (provider -> backend callback -> frontend)
 * - Cluster-safe CSRF `state` storage via `ISocialAuthStateStore` (StorageAdapter-backed)
 * - Optional `appState` round-trip (opaque string, URL-encoded)
 * - Supports `cookies`, `json`, and `hybrid` (origin-based) delivery modes
 *
 * @example
 * ```typescript
 * // NestJS controller pseudocode
 * const start = await socialRedirect.start({ provider: 'google', returnTo: '/auth/callback', appState: '12345', req });
 * return res.redirect(start.redirectUrl);
 *
 * const cb = await socialRedirect.callback({ provider: 'google', code, state, req });
 * cb.cookies?.forEach((c) => res.setCookie(c.name, c.value, c.options));
 * return res.redirect(cb.redirectUrl);
 *
 * const auth = await socialRedirect.exchange(exchangeToken);
 * return auth;
 * ```
 */
export class SocialRedirectHandler {
  private readonly csrfService: CsrfService;
  private readonly exchangeTtlSeconds: number;

  constructor(
    private readonly config: NAuthConfig,
    private readonly providerRegistry: SocialProviderRegistry,
    private readonly socialStateStore: ISocialAuthStateStore,
    private readonly storage: StorageAdapter,
    private readonly logger?: NAuthLogger,
    exchangeTtlSeconds: number = 60,
  ) {
    this.csrfService = new CsrfService(config);
    this.exchangeTtlSeconds = exchangeTtlSeconds;
  }

  /**
   * Start redirect-first social login.
   *
   * @param input - Start parameters
   * @returns Redirect recipe to send user to the provider authorization URL
   * @throws {NAuthException} When provider/returnTo are invalid or config is missing
   */
  async start(input: SocialRedirectStartInput): Promise<SocialRedirectStartResult> {
    const provider = this.normalizeProvider(input.provider);
    const returnTo = input.returnTo || '/auth/callback';
    const action: 'login' | 'link' = input.action || 'login';

    const delivery = this.resolveEffectiveDelivery(input.req, undefined);

    const csrfState = await this.socialStateStore.createCsrfState(provider);
    await this.socialStateStore.setRedirectContext(csrfState, {
      returnTo,
      appState: input.appState,
      action,
      delivery,
    });

    // Get provider and generate OAuth URL directly
    const providerInstance = this.providerRegistry.getProvider(provider);
    const url = await providerInstance.getAuthUrl(csrfState);

    return { redirectUrl: url };
  }

  /**
   * Handle provider callback and produce a frontend redirect recipe.
   *
   * @param input - Callback parameters from provider (GET query or POST form_post)
   * @returns Redirect recipe to send user back to frontend with `appState` (and optional `exchangeToken`)
   * @throws {NAuthException} When required params are missing/invalid
   */
  async callback(input: SocialRedirectCallbackInput): Promise<SocialRedirectCallbackResult> {
    const provider = this.normalizeProvider(input.provider);
    const state = typeof input.state === 'string' ? input.state.trim() : '';
    if (!state) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Missing state', { field: 'state' });
    }

    const ctx = await this.socialStateStore.consumeRedirectContext(state);
    const frontendBaseUrl = this.getFrontendBaseUrl();
    const frontendUrl = this.buildFrontendRedirectUrl(frontendBaseUrl, ctx?.returnTo || '/auth/callback');

    // Provider sign-in error (user cancelled, etc.)
    if (input.error) {
      return {
        redirectUrl: this.appendQuery(frontendUrl, {
          appState: ctx?.appState,
          error: input.error,
          errorDescription: input.errorDescription,
        }),
      };
    }

    const code = typeof input.code === 'string' ? input.code.trim() : '';
    if (!code) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Missing code', { field: 'code' });
    }

    // Handle OAuth callback directly with provider
    const providerInstance = this.providerRegistry.getProvider(provider);
    const authResponse = await providerInstance.handleCallback({ code, state });

    const effective = ctx?.delivery || this.resolveEffectiveDelivery(input.req, undefined);

    // ============================================================================
    // cookies mode: set cookies only when tokens exist; challenges must use exchangeToken
    // ============================================================================
    if (effective === 'cookies' && typeof authResponse.accessToken === 'string' && authResponse.accessToken) {
      const cookies: SocialRedirectCookie[] = [];
      cookies.push(...this.buildAuthCookies(authResponse));
      cookies.push(this.buildCsrfCookie());

      // ============================================================================
      // NestJS/Express/Fastify "magic": stash cookie recipe on the request object
      // ============================================================================
      // Why:
      // - Consumers often implement redirect routes that return only `{ url }` (NestJS @Redirect())
      // - In cookies mode we MUST NOT send tokens in the response body
      // - Therefore, token-based cookie interceptors can't rely on `accessToken` being present
      //
      // This recipe lets framework adapters set cookies automatically without requiring
      // consumers to manually loop `cookies` and set them on the response.
      (input.req as unknown as Record<string, unknown>).__nauthCookieRecipe = cookies;

      // Sanitize authResponse for cookies mode - remove tokens and expiries (same as signup/login)
      // Consumer apps must never see tokens in response body when using cookies delivery.
      const sanitizedAuthResponse = this.sanitizeAuthResponseForCookies(authResponse);

      return {
        redirectUrl: this.appendQuery(frontendUrl, { appState: ctx?.appState }),
        cookies,
        authResponse: sanitizedAuthResponse,
      };
    }

    // json/hybrid OR cookies-with-challenge: store payload and redirect with exchangeToken
    const exchangeToken = crypto.randomBytes(32).toString('hex');
    await this.storage.set(this.getExchangeKey(exchangeToken), JSON.stringify(authResponse), this.exchangeTtlSeconds);

    return {
      redirectUrl: this.appendQuery(frontendUrl, { appState: ctx?.appState, exchangeToken }),
    };
  }

  /**
   * Exchange a short-lived exchange token for an AuthResponse.
   *
   * @param exchangeToken - One-time token from callback redirect URL
   * @returns AuthResponse payload (tokens or challenge)
   * @throws {NAuthException} When exchangeToken is invalid/expired
   */
  async exchange(exchangeToken: string): Promise<AuthResponseDTO> {
    const token = typeof exchangeToken === 'string' ? exchangeToken.trim() : '';
    if (!token) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'exchangeToken is required', {
        field: 'exchangeToken',
      });
    }

    const key = this.getExchangeKey(token);
    const raw = await this.storage.get(key);
    if (!raw) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid exchangeToken', { field: 'exchangeToken' });
    }

    // One-time: delete immediately
    await this.storage.del(key);

    const parsed = this.safeParseExchangePayload(raw);
    return parsed;
  }

  // ============================================================================
  // Cookie helpers (framework-neutral recipe)
  // ============================================================================

  private buildAuthCookies(auth: AuthResponseDTO): SocialRedirectCookie[] {
    const accessToken = typeof auth.accessToken === 'string' ? auth.accessToken : '';
    const refreshToken = typeof auth.refreshToken === 'string' ? auth.refreshToken : '';
    const accessExp = typeof auth.accessTokenExpiresAt === 'number' ? auth.accessTokenExpiresAt : 0;
    const refreshExp = typeof auth.refreshTokenExpiresAt === 'number' ? auth.refreshTokenExpiresAt : 0;

    if (!accessToken || accessExp <= 0) {
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Missing access token expiry; refusing to set cookies');
    }

    const opt = this.config.tokenDelivery?.cookieOptions;
    const base: NAuthCookieOptions = {
      httpOnly: true,
      secure: opt?.secure !== false,
      sameSite: (opt?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
      domain: opt?.domain,
      path: opt?.path || '/',
    };

    const accessMaxAgeMs = Math.max(0, accessExp * 1000 - Date.now());
    if (accessMaxAgeMs <= 0) {
      throw new NAuthException(AuthErrorCode.TOKEN_INVALID, 'Access token already expired; refusing to set cookies');
    }

    const cookies: SocialRedirectCookie[] = [
      {
        name: getAccessTokenCookieName(this.config),
        value: accessToken,
        options: { ...base, maxAge: accessMaxAgeMs },
      },
    ];

    if (refreshToken && refreshExp > 0) {
      const refreshMaxAgeMs = Math.max(0, refreshExp * 1000 - Date.now());
      if (refreshMaxAgeMs > 0) {
        cookies.push({
          name: getRefreshTokenCookieName(this.config),
          value: refreshToken,
          options: { ...base, maxAge: refreshMaxAgeMs },
        });
      }
    }

    // Device token cookie (optional)
    const deviceToken = (auth as unknown as { deviceToken?: unknown }).deviceToken;
    if (typeof deviceToken === 'string' && deviceToken) {
      const rememberDeviceDays = this.config.mfa?.rememberDeviceDays || 30;
      cookies.push({
        name: getDeviceTokenCookieName(this.config),
        value: deviceToken,
        options: { ...base, maxAge: rememberDeviceDays * 24 * 60 * 60 * 1000 },
      });
    }

    return cookies;
  }

  private buildCsrfCookie(): SocialRedirectCookie {
    const csrfCookieName = this.csrfService.getCookieName();
    const csrfToken = this.csrfService.generateToken();

    // Default to readable cookie so browser SDK can send it in the CSRF header.
    const csrfOpt = this.csrfService.getCookieOptions();
    const tokenOpt = this.config.tokenDelivery?.cookieOptions;

    return {
      name: csrfCookieName,
      value: csrfToken,
      options: {
        httpOnly: csrfOpt.httpOnly ?? false,
        secure: tokenOpt?.secure !== false,
        sameSite: (tokenOpt?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
        domain: csrfOpt.domain ?? tokenOpt?.domain,
        path: csrfOpt.path ?? tokenOpt?.path ?? '/',
        ...csrfOpt,
      },
    };
  }

  // ============================================================================
  // URL / config helpers
  // ============================================================================

  private getFrontendBaseUrl(): string {
    const baseUrl = this.config.social?.redirect?.frontendBaseUrl;
    if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Missing config.social.redirect.frontendBaseUrl', {
        field: 'social.redirect.frontendBaseUrl',
      });
    }
    return baseUrl.trim();
  }

  private buildFrontendRedirectUrl(frontendBaseUrl: string, returnTo: string): string {
    const allowAbsolute = Boolean(this.config.social?.redirect?.allowAbsoluteReturnTo);
    const originAllowlist = this.config.social?.redirect?.allowedReturnToOrigins || [];

    if (!allowAbsolute) {
      if (!returnTo.startsWith('/')) {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'returnTo must be a relative path', {
          field: 'returnTo',
        });
      }
      const u = new URL(returnTo, frontendBaseUrl);
      u.hash = '';
      return u.toString();
    }

    const u = new URL(returnTo, frontendBaseUrl);
    u.hash = '';
    if (originAllowlist.length > 0 && !originAllowlist.includes(u.origin)) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'returnTo origin is not allowed', {
        field: 'returnTo',
      });
    }
    return u.toString();
  }

  private appendQuery(
    baseUrl: string,
    params: { appState?: string; exchangeToken?: string; error?: string; errorDescription?: string },
  ): string {
    const u = new URL(baseUrl);
    if (params.appState) u.searchParams.set('appState', params.appState);
    if (params.exchangeToken) u.searchParams.set('exchangeToken', params.exchangeToken);
    if (params.error) u.searchParams.set('error', params.error);
    if (params.errorDescription) u.searchParams.set('error_description', params.errorDescription);
    return u.toString();
  }

  private resolveEffectiveDelivery(req: unknown, routeMode?: 'cookies' | 'json'): 'cookies' | 'json' {
    const method = this.config.tokenDelivery?.method || 'json';

    // Route-level override from framework adapters (e.g. NestJS @TokenDelivery()).
    // This avoids relying on `Origin` for hybrid deployments (provider callbacks often omit it).
    const requestOverride = this.getRouteDeliveryOverrideFromRequest(req);
    const effectiveRouteMode = routeMode ?? requestOverride;

    // Validate explicit preference against global configuration
    if (effectiveRouteMode === 'cookies' && method === 'json') {
      throw new NAuthException(
        AuthErrorCode.COOKIES_NOT_ALLOWED,
        "Cookie delivery requested, but tokenDelivery.method is 'json' (cookies disabled)",
      );
    }
    if (effectiveRouteMode === 'json' && method === 'cookies') {
      // NOTE: We still allow JSON for challenge-only responses (no tokens),
      // but a consumer explicitly requesting JSON tokens in cookies-only mode is a misconfiguration.
      throw new NAuthException(
        AuthErrorCode.BEARER_NOT_ALLOWED,
        "JSON delivery requested, but tokenDelivery.method is 'cookies' (JSON/Bearer tokens disabled)",
      );
    }

    if (effectiveRouteMode) {
      return effectiveRouteMode;
    }
    if (method === 'hybrid') {
      return resolveDeliveryForRequest(req, this.config.tokenDelivery?.hybridPolicy);
    }
    return method === 'cookies' ? 'cookies' : 'json';
  }

  private getRouteDeliveryOverrideFromRequest(req: unknown): 'cookies' | 'json' | undefined {
    const r = req as Record<string, unknown> | undefined;
    const v = r?.__nauthRouteDelivery;
    return v === 'cookies' || v === 'json' ? v : undefined;
  }

  private normalizeProvider(provider: string): string {
    if (typeof provider !== 'string') {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Provider must be a string', { field: 'provider' });
    }
    const p = provider.trim().toLowerCase();
    if (!p) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Provider is required', { field: 'provider' });
    }
    return p;
  }

  private getExchangeKey(exchangeToken: string): string {
    return `social:oauth_exchange:${exchangeToken}`;
  }

  private safeParseExchangePayload(raw: string): AuthResponseDTO {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid payload');
      }
      return parsed as AuthResponseDTO;
    } catch (error) {
      this.logger?.debug?.('[SocialRedirectHandler] Failed to parse exchange payload', { error });
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Invalid exchange payload');
    }
  }

  /**
   * Sanitize AuthResponse for cookies mode
   *
   * Removes tokens and expiration fields from response body when cookies mode is used.
   * Follows same principle as signup/login endpoints - tokens delivered via httpOnly cookies,
   * not in response body.
   *
   * @param authResponse - Original auth response with tokens
   * @returns Sanitized auth response without tokens and expiries
   */
  private sanitizeAuthResponseForCookies(authResponse: AuthResponseDTO): AuthResponseDTO {
    // Create a copy to avoid mutating the original
    const sanitized: AuthResponseDTO = { ...authResponse };

    // Delete tokens and expiration fields (not just set to undefined)
    // This ensures they are completely removed from the response body
    delete sanitized.accessToken;
    delete sanitized.refreshToken;
    delete sanitized.accessTokenExpiresAt;
    delete sanitized.refreshTokenExpiresAt;
    delete sanitized.deviceToken;

    return sanitized;
  }
}

/**
 * Start input for redirect-first social login.
 */
export interface SocialRedirectStartInput {
  /** OAuth provider (google|apple|facebook) */
  provider: string;
  /** Frontend path or URL to return to (default: `/auth/callback`) */
  returnTo?: string;
  /** Optional application state to round-trip back to frontend */
  appState?: string;
  /** Optional action (default: `login`) */
  action?: 'login' | 'link';
  /** Request object for hybrid origin-based delivery */
  req?: unknown;
}

/**
 * Callback input for redirect-first social login.
 */
export interface SocialRedirectCallbackInput {
  provider: string;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  req?: unknown;
}

/**
 * Cookie instruction returned by SocialRedirectHandler.
 */
export interface SocialRedirectCookie {
  name: string;
  value: string;
  options?: NAuthCookieOptions;
}

/**
 * Start redirect result.
 */
export interface SocialRedirectStartResult {
  redirectUrl: string;
}

/**
 * Callback redirect result.
 */
export interface SocialRedirectCallbackResult {
  redirectUrl: string;
  cookies?: SocialRedirectCookie[];
  /**
   * AuthResponse payload, only populated when:
   * - effective delivery is `cookies`, AND
   * - the social callback produced tokens
   *
   * This enables frameworks with automatic cookie delivery (e.g., NestJS interceptor + `@TokenDelivery()`)
   * to set cookies without consumer code manually iterating over `cookies`.
   *
   * WARNING: Do not log this value (contains tokens).
   */
  authResponse?: AuthResponseDTO;
}
