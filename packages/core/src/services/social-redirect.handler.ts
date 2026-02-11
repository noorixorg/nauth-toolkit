import * as crypto from 'crypto';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthResponseDTO } from '../dto/auth-response.dto';
import {
  StartSocialRedirectResponseDTO,
  SocialRedirectCallbackResponseDTO,
} from '../dto/social-redirect.dto';
import { NAuthException } from '../exceptions/nauth.exception';
import { NAuthConfig } from '../interfaces/config.interface';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthCookieOptions } from '../platform/interfaces';
import { SocialProviderRegistry } from '../services/social-provider-registry.service';
import { CsrfService } from '../services/csrf.service';
import { ContextStorage } from '../utils/context-storage';
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
 * // NestJS controller
 * const result = await socialRedirect.start(provider, dto);
 * return result; // { url }
 *
 * const result = await socialRedirect.callback(provider, dto);
 * return result; // { url } - cookies applied via HTTP_RESPONSE in context
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
   * Delivery and deviceToken are read from ContextStorage (set by framework before controller).
   *
   * @param provider - OAuth provider (e.g. 'google', 'apple', 'facebook')
   * @param dto - Query DTO with returnTo, appState, action, oauthParams (JSON string)
   * @returns Redirect URL for NestJS @Redirect() or equivalent
   * @throws {NAuthException} When provider/returnTo are invalid or config is missing
   */
  async start(
    provider: string,
    dto: { returnTo?: string; appState?: string; action?: 'login' | 'link'; oauthParams?: string },
  ): Promise<StartSocialRedirectResponseDTO> {
    const normalizedProvider = this.normalizeProvider(provider);
    const returnTo = dto.returnTo || '/auth/callback';
    const action: 'login' | 'link' = dto.action || 'login';

    const delivery = this.resolveEffectiveDelivery();
    const clientInfo = ContextStorage.get<{ deviceToken?: string }>('CLIENT_INFO');
    const deviceToken = clientInfo?.deviceToken;

    const csrfState = await this.socialStateStore.createCsrfState(normalizedProvider);
    await this.socialStateStore.setRedirectContext(csrfState, {
      returnTo,
      appState: dto.appState,
      action,
      delivery,
      deviceToken,
    });

    let oauthParams: Record<string, string> | undefined;
    if (dto.oauthParams && typeof dto.oauthParams === 'string') {
      try {
        oauthParams = JSON.parse(dto.oauthParams) as Record<string, string>;
      } catch {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid oauthParams format - must be valid JSON', {
          field: 'oauthParams',
        });
      }
    }

    const providerInstance = this.providerRegistry.getProvider(normalizedProvider);
    const url = await providerInstance.getAuthUrl(csrfState, oauthParams);

    return { url };
  }

  /**
   * Handle provider callback and produce a frontend redirect.
   *
   * In cookies mode, applies cookies directly to HTTP_RESPONSE from ContextStorage.
   *
   * @param provider - OAuth provider (e.g. 'google', 'apple', 'facebook')
   * @param dto - Callback params (GET query or POST form); may include error_description (underscore)
   * @returns Redirect URL for NestJS @Redirect() or equivalent
   * @throws {NAuthException} When required params are missing/invalid
   */
  async callback(
    provider: string,
    dto: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
      user?: string;
      profileData?: Record<string, unknown>;
    },
  ): Promise<SocialRedirectCallbackResponseDTO> {
    const normalizedProvider = this.normalizeProvider(provider);
    const state = typeof dto.state === 'string' ? dto.state.trim() : '';
    if (!state) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Missing state', { field: 'state' });
    }

    const errorDescription = dto.error_description ?? (dto as Record<string, unknown>).errorDescription;

    const ctx = await this.socialStateStore.consumeRedirectContext(state);
    // ============================================================================
    // Preserve device token across OAuth redirects
    // ============================================================================
    if (ctx?.deviceToken) {
      const existing = ContextStorage.get('CLIENT_INFO') as Record<string, unknown> | undefined;
      const existingToken = existing?.deviceToken;
      const hasValidToken = typeof existingToken === 'string' && existingToken.trim().length > 0;

      if (existing && !hasValidToken) {
        existing.deviceToken = ctx.deviceToken;
        ContextStorage.set('CLIENT_INFO', existing);
      }
    }
    const frontendBaseUrl = this.getFrontendBaseUrl();
    const frontendUrl = this.buildFrontendRedirectUrl(frontendBaseUrl, ctx?.returnTo || '/auth/callback');

    if (dto.error) {
      return {
        url: this.appendQuery(frontendUrl, {
          appState: ctx?.appState,
          error: dto.error,
          errorDescription: typeof errorDescription === 'string' ? errorDescription : undefined,
        }),
      };
    }

    const code = typeof dto.code === 'string' ? dto.code.trim() : '';
    if (!code) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Missing code', { field: 'code' });
    }

    let profileData = dto.profileData;
    if (!profileData && dto.user && typeof dto.user === 'string') {
      try {
        profileData = JSON.parse(dto.user) as Record<string, unknown>;
      } catch (error) {
        this.logger?.debug?.('[SocialRedirectHandler] Failed to parse user field from callback', { error });
      }
    }

    const providerInstance = this.providerRegistry.getProvider(normalizedProvider);
    const authResponse = await providerInstance.handleCallback({ code, state, profileData });

    const effective = ctx?.delivery || this.resolveEffectiveDelivery();

    if (effective === 'cookies' && typeof authResponse.accessToken === 'string' && authResponse.accessToken) {
      const cookies: SocialRedirectCookie[] = [];
      cookies.push(...this.buildAuthCookies(authResponse));
      cookies.push(this.buildCsrfCookie());
      this.applyCookiesToResponse(cookies);
      return {
        url: this.appendQuery(frontendUrl, { appState: ctx?.appState }),
      };
    }

    const exchangeToken = crypto.randomBytes(32).toString('hex');
    await this.storage.set(this.getExchangeKey(exchangeToken), JSON.stringify(authResponse), this.exchangeTtlSeconds);

    return {
      url: this.appendQuery(frontendUrl, { appState: ctx?.appState, exchangeToken }),
    };
  }

  /**
   * Apply cookie recipe to the HTTP response from ContextStorage.
   * Supports both Express (res.cookie) and Fastify (res.setCookie).
   */
  private applyCookiesToResponse(cookies: SocialRedirectCookie[]): void {
    const response = ContextStorage.get<Record<string, unknown>>('HTTP_RESPONSE');
    if (!response) return;
    for (const c of cookies) {
      if (typeof (response as { cookie?: (n: string, v: string, o?: unknown) => void }).cookie === 'function') {
        (response as { cookie: (n: string, v: string, o?: unknown) => void }).cookie(c.name, c.value, c.options);
      } else if (
        typeof (response as { setCookie?: (n: string, v: string, o?: unknown) => void }).setCookie === 'function'
      ) {
        (response as { setCookie: (n: string, v: string, o?: unknown) => void }).setCookie(c.name, c.value, c.options);
      }
    }
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

  private resolveEffectiveDelivery(): 'cookies' | 'json' {
    const method = this.config.tokenDelivery?.method || 'json';

    const routeOverride = ContextStorage.get<'cookies' | 'json'>('ROUTE_DELIVERY_OVERRIDE');
    const effectiveRouteMode = routeOverride;

    if (effectiveRouteMode === 'cookies' && method === 'json') {
      throw new NAuthException(
        AuthErrorCode.COOKIES_NOT_ALLOWED,
        "Cookie delivery requested, but tokenDelivery.method is 'json' (cookies disabled)",
      );
    }
    if (effectiveRouteMode === 'json' && method === 'cookies') {
      throw new NAuthException(
        AuthErrorCode.BEARER_NOT_ALLOWED,
        "JSON delivery requested, but tokenDelivery.method is 'cookies' (JSON/Bearer tokens disabled)",
      );
    }

    if (effectiveRouteMode) {
      return effectiveRouteMode;
    }
    if (method === 'hybrid') {
      const clientInfo = ContextStorage.get<{ origin?: string }>('CLIENT_INFO');
      const origin = clientInfo?.origin ?? '';
      return resolveDeliveryForRequest(
        { headers: { origin } } as { headers?: Record<string, unknown> },
        this.config.tokenDelivery?.hybridPolicy,
      );
    }
    return method === 'cookies' ? 'cookies' : 'json';
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

/** Internal cookie recipe type used when applying cookies to HTTP_RESPONSE. */
interface SocialRedirectCookie {
  name: string;
  value: string;
  options?: NAuthCookieOptions;
}
