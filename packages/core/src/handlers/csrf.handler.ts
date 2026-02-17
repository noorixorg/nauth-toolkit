/**
 * CSRF Handler
 *
 * Generates and validates CSRF tokens for cookie-based authentication.
 *
 * **Platform-Agnostic:**
 * This handler operates purely on NAuthRequest interface.
 * Context is managed by the adapter, not this handler.
 *
 * **Lazy Validation:**
 * CSRF errors are stored in request attributes instead of thrown immediately.
 * This allows public routes and requireAuth() to decide how to handle them.
 */

import { NAuthConfig, NAuthException, AuthErrorCode, NAuthLogger } from '../index';
import { CsrfService } from '../services/csrf.service';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

/** HTTP methods that don't require CSRF validation */
const SAFE_METHODS = ['GET', 'HEAD'];

/**
 * CsrfHandler
 *
 * Handles CSRF token generation and validation for cookie-based authentication.
 */
export class CsrfHandler {
  constructor(
    private readonly csrfService: CsrfService,
    private readonly config: NAuthConfig,
    private readonly logger?: NAuthLogger,
  ) {}

  /**
   * Handle request - generate or validate CSRF token
   *
   * Note: Context is managed by adapter. This handler assumes context is available.
   */
  public async handle(req: NAuthRequest, res: NAuthResponse, next: () => Promise<void> | void): Promise<void> {
    // Skip if token delivery is not cookies or hybrid
    const method = this.config.tokenDelivery?.method || 'json';
    if (method !== 'cookies' && method !== 'hybrid') {
      await next();
      return;
    }

    // ============================================================================
    // IMPORTANT: Never generate CSRF cookies on CORS preflight (OPTIONS)
    // ============================================================================
    // Browsers typically do NOT include cookies on preflight requests.
    // If we generated a CSRF cookie here, we'd rotate the token between the time
    // the client reads document.cookie (to set the header) and the actual request
    // is sent, causing intermittent CSRF mismatches.
    if (req.method === 'OPTIONS') {
      await next();
      return;
    }

    // Safe methods: Generate token if missing
    if (SAFE_METHODS.includes(req.method)) {
      await this.generateTokenIfMissing(req, res);
      await next();
      return;
    }

    // Skip public routes (CSRF not required)
    if (req.attributes.nauthPublic) {
      await next();
      return;
    }

    // Skip excluded paths
    const excludedPaths = this.config.security?.csrf?.excludedPaths || [];
    if (excludedPaths.some((p: string) => req.path.startsWith(p))) {
      await next();
      return;
    }

    // Validate CSRF token for unsafe methods (POST, PUT, DELETE, etc.)
    await this.validateToken(req);

    await next();
  }

  /**
   * Generate CSRF token if not present in cookies
   */
  private async generateTokenIfMissing(req: NAuthRequest, res: NAuthResponse): Promise<void> {
    const cookieName = this.csrfService.getCookieName();
    const existingToken = req.cookies[cookieName];

    if (existingToken) {
      // Token exists, clear any previous error state
      delete req.attributes.nauthCsrfError;
      return;
    }

    // Generate new token
    const token = this.csrfService.generateToken();

    // Allow per-app override, but default to readable cookie (NOT httpOnly)
    // so browser clients can send the value back in the CSRF header.
    const csrfCookieOptions = this.csrfService.getCookieOptions();

    // Build cookie options. CSRF cookie must be readable by the frontend (document.cookie) so it can
    // be sent in x-csrf-token header. Use same domain as tokenDelivery when security.csrf.domain is unset.
    const baseCookieOptions = {
      httpOnly: csrfCookieOptions.httpOnly ?? false,
      secure: this.config.tokenDelivery?.cookieOptions?.secure ?? true,
      sameSite: (this.config.tokenDelivery?.cookieOptions?.sameSite || 'strict') as 'strict' | 'lax' | 'none',
      path: '/',
      priority: (csrfCookieOptions.priority as 'low' | 'medium' | 'high') ?? 'high',
      ...csrfCookieOptions,
    };
    const domain =
      baseCookieOptions.domain !== undefined && baseCookieOptions.domain !== ''
        ? baseCookieOptions.domain
        : this.config.tokenDelivery?.cookieOptions?.domain;
    const cookieOptions = { ...baseCookieOptions, domain };

    // Set cookie
    res.setCookie(cookieName, token, cookieOptions);

    // Also expose token in response header (since cookie is httpOnly)
    res.header(this.csrfService.getHeaderName(), token);

    this.logger?.debug?.('CSRF token generated and set');
  }

  /**
   * Validate CSRF token from request
   *
   * Uses lazy validation - stores error in attributes instead of throwing.
   * requireAuth() helper will throw if error exists.
   */
  private async validateToken(req: NAuthRequest): Promise<void> {
    const headerName = this.csrfService.getHeaderName();
    const cookieName = this.csrfService.getCookieName();

    // Get token from header or body
    let tokenFromRequest = req.getHeader(headerName);
    if (!tokenFromRequest && req.body) {
      // Check common body fields
      const body = req.body as Record<string, unknown>;
      tokenFromRequest = (body[headerName] || body['_csrf'] || body['csrfToken']) as string | undefined;
    }

    // Get token from cookie
    const cookieToken = req.cookies[cookieName];

    // Validate - store errors lazily
    if (!tokenFromRequest) {
      req.attributes.nauthCsrfError = new NAuthException(
        AuthErrorCode.CSRF_TOKEN_MISSING,
        `CSRF token required. Include ${headerName} header or _csrf/csrfToken in body with the value from ${cookieName} cookie.`,
      );
      return;
    }

    if (!cookieToken) {
      req.attributes.nauthCsrfError = new NAuthException(
        AuthErrorCode.CSRF_TOKEN_MISSING,
        'CSRF cookie missing. Make a GET request first to obtain a token.',
      );
      return;
    }

    // Validate token matches
    const isValid = this.csrfService.validateToken(String(tokenFromRequest), cookieToken);

    if (!isValid) {
      req.attributes.nauthCsrfError = new NAuthException(AuthErrorCode.CSRF_TOKEN_INVALID, 'CSRF token mismatch.');
      return;
    }

    this.logger?.debug?.('CSRF token validated successfully');
  }
}
