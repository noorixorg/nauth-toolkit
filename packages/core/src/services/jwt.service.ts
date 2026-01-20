import { JwtConfig } from '../interfaces/config.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import * as crypto from 'crypto';

/**
 * jose module type (ESM-only dependency).
 *
 * IMPORTANT: `jose@6` is ESM-only. This monorepo currently compiles core to CommonJS, so
 * a static `import ... from 'jose'` emits `require('jose')` and fails at runtime with
 * `ERR_REQUIRE_ESM`. We therefore load jose via dynamic import.
 */
type JoseModule = typeof import('jose');

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  /** User ID */
  sub: string;

  /** User email */
  email: string;

  /** Token type (access or refresh) */
  type: 'access' | 'refresh';

  /** Session ID */
  sessionId: string;

  /** Token family ID (for rotation detection) */
  tokenFamily?: string;

  /** Issued at timestamp */
  iat: number;

  /** Expiration timestamp */
  exp: number;

  /** Issuer */
  iss?: string;

  /** Audience */
  aud?: string | string[];

  /** Device ID */
  deviceId?: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  /** Whether token is valid */
  valid: boolean;

  /** Decoded payload if valid */
  payload?: JwtPayload;

  /** Error message if invalid */
  error?: string;

  /** Error type for specific handling */
  errorType?: 'expired' | 'invalid' | 'malformed' | 'blacklisted';
}

/**
 * Token pair (access + refresh)
 */
export interface TokenPair {
  /** Short-lived access token */
  accessToken: string;

  /** Long-lived refresh token */
  refreshToken: string;

  /** Access token expiration in seconds */
  expiresIn: number;
}

/**
 * JWT Service (Platform-Agnostic)
 *
 * Handles all JWT token operations using jose library for platform independence.
 *
 * **Features:**
 * - Platform-agnostic (no framework dependencies)
 * - Support for multiple algorithms (HS256, HS384, HS512, RS256, RS384, RS512)
 * - Token rotation with family tracking
 * - Token reuse detection
 * - Symmetric and asymmetric key support
 *
 * **Security Features:**
 * - HS256 as default algorithm (symmetric key)
 * - HS256/HS384/HS512 for symmetric keys
 * - RS256/RS384/RS512 for asymmetric keys
 * - Token rotation on refresh
 * - Token family tracking for reuse detection
 * - Configurable expiration times
 * - Standard JWT claims (iss, aud, sub, exp, iat)
 *
 * @example
 * ```typescript
 * const jwtService = new JwtService(config);
 *
 * // Generate token pair
 * const tokens = await jwtService.generateTokenPair({
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   sessionId: 'session-456',
 * });
 *
 * // Validate token
 * const result = await jwtService.validateAccessToken(tokens.accessToken);
 * if (result.valid) {
 *   console.log('User ID:', result.payload.sub);
 * }
 * ```
 */
export class JwtService {
  /** JWT configuration */
  private readonly config: JwtConfig;

  /** Cached access token key (for performance) */
  private accessTokenKey: Uint8Array | crypto.KeyObject | null = null;

  /** Cached refresh token key (for performance) */
  private refreshTokenKey: Uint8Array | crypto.KeyObject | null = null;

  /**
   * Cached jose module load.
   * Kept as a promise so concurrent calls share the same module load.
   */
  private joseModulePromise: Promise<JoseModule> | null = null;

  constructor(jwtConfig: JwtConfig) {
    this.config = jwtConfig;
    this.prepareKeys();
  }

  // ============================================================================
  // jose loader
  // ============================================================================

  /**
   * Load jose in a way that works for both ESM and CommonJS consumers.
   *
   * "Proper" usage per jose docs:
   * - ESM: `import * as jose from 'jose'`
   * - CJS: `const jose = require('jose')` (when `require(esm)` is supported/enabled)
   *
   * In some production setups, `require()` is wrapped/intercepted (e.g. PM2), which can
   * break `require(esm)` and surface `ERR_REQUIRE_ESM`. In that case we fall back to a
   * native dynamic import so Node's ESM loader can resolve jose.
   *
   * @private
   */
  private async getJose(): Promise<JoseModule> {
    if (!this.joseModulePromise) {
      this.joseModulePromise = (async () => {
        try {
          return require('jose') as JoseModule;
        } catch {
          // Native dynamic import fallback (avoids TypeScript rewriting to require()).

          const nativeImport = new Function('modulePath', 'return import(modulePath)') as (
            modulePath: string,
          ) => Promise<unknown>;
          return (await nativeImport('jose')) as JoseModule;
        }
      })();
    }
    return await this.joseModulePromise;
  }

  // ============================================================================
  // Key Preparation
  // ============================================================================

  /**
   * Prepare and cache signing keys for better performance
   * @private
   */
  private prepareKeys(): void {
    // Access token key
    if (this.config.accessToken.privateKey) {
      // Use private key (for RS256, RS384, RS512)
      this.accessTokenKey = crypto.createPrivateKey(this.config.accessToken.privateKey);
    } else if (this.config.accessToken.secret) {
      // For symmetric algorithms (HS256, HS384, HS512), use secret as Uint8Array
      this.accessTokenKey = new TextEncoder().encode(this.config.accessToken.secret);
    }

    // Refresh token key (always uses secret for symmetric algorithms)
    if (this.config.refreshToken.secret) {
      this.refreshTokenKey = new TextEncoder().encode(this.config.refreshToken.secret);
    }
  }

  /**
   * Get algorithm for signing access tokens
   *
   * Automatically selects appropriate algorithm based on key material:
   * - If privateKey is provided → uses configured algorithm (RS256, RS384, RS512)
   * - If only secret is provided → uses configured algorithm or defaults to HS256
   *
   * @private
   */
  private getAlgorithm(): string {
    // Default to HS256 if no algorithm is configured
    return this.config.algorithm || 'HS256';
  }

  /**
   * Get algorithm for signing refresh tokens
   *
   * Refresh tokens only support symmetric algorithms (HS256/HS384/HS512)
   * because RefreshTokenConfig only provides a secret, not a privateKey.
   *
   * Automatically selects appropriate symmetric algorithm:
   * - If configured algorithm is symmetric (HS256/HS384/HS512) → uses it
   * - If configured algorithm is asymmetric (RS256, RS384, RS512) → falls back to HS256
   * - Defaults to HS256 if no algorithm is configured
   *
   * @private
   */
  private getRefreshTokenAlgorithm(): string {
    const configuredAlgorithm = this.config.algorithm || 'HS256';

    // Refresh tokens only support symmetric algorithms (HS256, HS384, HS512)
    // because RefreshTokenConfig only has a secret, not a privateKey
    if (configuredAlgorithm === 'HS256' || configuredAlgorithm === 'HS384' || configuredAlgorithm === 'HS512') {
      return configuredAlgorithm;
    }

    // For asymmetric algorithms (RS256, RS384, RS512), fall back to HS256
    // This ensures compatibility with the symmetric refreshTokenKey
    return 'HS256';
  }

  // ============================================================================
  // Token Generation
  // ============================================================================

  /**
   * Generate both access and refresh tokens
   *
   * Creates a pair of tokens with the same token family for rotation tracking.
   * The token family allows detection of token reuse attacks.
   *
   * @param data - User and session information
   * @returns Token pair with access and refresh tokens
   *
   * @example
   * ```typescript
   * const tokens = await jwtService.generateTokenPair({
   *   userId: 'user-123',
   *   email: 'user@example.com',
   *   sessionId: 'session-456',
   * });
   *
   * // Store tokens and send to client
   * res.json({
   *   accessToken: tokens.accessToken,
   *   refreshToken: tokens.refreshToken,
   *   expiresIn: tokens.expiresIn,
   * });
   * ```
   */
  async generateTokenPair(data: {
    userId: string;
    email: string;
    sessionId: string;
    tokenFamily?: string;
  }): Promise<TokenPair> {
    // Generate or reuse token family ID for rotation tracking
    const tokenFamily = data.tokenFamily || this.generateTokenFamily();

    // Generate access token (short-lived)
    const accessToken = await this.generateAccessToken({
      ...data,
      tokenFamily,
    });

    // Generate refresh token (long-lived)
    const refreshToken = await this.generateRefreshToken({
      ...data,
      tokenFamily,
    });

    // Calculate expiration time in seconds
    const expiresIn = this.parseExpiresIn(this.config.accessToken.expiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Generate an access token
   *
   * Access tokens are short-lived (typically 15 minutes) and used for API authentication.
   * They contain user identity and authorization information.
   *
   * @param data - Token payload data
   * @returns Signed JWT access token
   */
  async generateAccessToken(data: {
    userId: string;
    email: string;
    sessionId: string;
    tokenFamily: string;
  }): Promise<string> {
    if (!this.accessTokenKey) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        'Access token key not configured. Provide secret or privateKey.',
      );
    }

    const jose = await this.getJose();
    const algorithm = this.getAlgorithm();
    let jwt = new jose.SignJWT({
      sub: data.userId,
      email: data.email,
      type: 'access',
      sessionId: data.sessionId,
      tokenFamily: data.tokenFamily,
    })
      .setProtectedHeader({ alg: algorithm })
      .setIssuedAt()
      .setExpirationTime(this.config.accessToken.expiresIn);

    // Add issuer if configured
    if (this.config.issuer) {
      jwt = jwt.setIssuer(this.config.issuer);
    }

    // Add audience if configured
    if (this.config.audience) {
      if (Array.isArray(this.config.audience)) {
        jwt = jwt.setAudience(this.config.audience);
      } else {
        jwt = jwt.setAudience(this.config.audience);
      }
    }

    return await jwt.sign(this.accessTokenKey);
  }

  /**
   * Generate a refresh token
   *
   * Refresh tokens are long-lived (typically 30 days) and used to obtain new access tokens.
   * They should be stored securely and rotated on each use.
   *
   * NOTE: Refresh tokens always use a symmetric algorithm (HS256/HS384/HS512)
   * because RefreshTokenConfig only provides a secret, not a privateKey.
   * This ensures compatibility between the algorithm and key type.
   *
   * @param data - Token payload data
   * @returns Signed JWT refresh token
   */
  async generateRefreshToken(data: {
    userId: string;
    email: string;
    sessionId: string;
    tokenFamily: string;
  }): Promise<string> {
    if (!this.refreshTokenKey) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Refresh token secret not configured.');
    }

    const jose = await this.getJose();
    // Use refresh token-specific algorithm (always symmetric)
    const algorithm = this.getRefreshTokenAlgorithm();
    const jwt = new jose.SignJWT({
      sub: data.userId,
      email: data.email,
      type: 'refresh',
      sessionId: data.sessionId,
      tokenFamily: data.tokenFamily,
    })
      .setProtectedHeader({ alg: algorithm })
      .setIssuedAt()
      .setExpirationTime(this.config.refreshToken.expiresIn);

    return await jwt.sign(this.refreshTokenKey);
  }

  // ============================================================================
  // Token Validation
  // ============================================================================

  /**
   * Validate an access token
   *
   * Verifies:
   * - Token signature is valid
   * - Token hasn't expired
   * - Token type is 'access'
   * - Token structure is correct
   *
   * @param token - JWT access token to validate
   * @returns Validation result with payload or error
   *
   * @example
   * ```typescript
   * const result = await jwtService.validateAccessToken(token);
   *
   * if (!result.valid) {
   *   if (result.errorType === 'expired') {
   *     // Attempt to refresh token
   *   } else {
   *     // Invalid token, reject request
   *   }
   * }
   * ```
   */
  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      const jose = await this.getJose();
      // Determine key for verification
      let verificationKey: Uint8Array | crypto.KeyObject;

      if (this.config.accessToken.publicKey) {
        // Use public key for asymmetric verification (RS256, RS384, RS512)
        verificationKey = crypto.createPublicKey(this.config.accessToken.publicKey);
      } else if (this.accessTokenKey) {
        // Use secret for symmetric verification (HS256, HS512)
        verificationKey = this.accessTokenKey;
      } else {
        throw new Error('No verification key available');
      }

      // Verify and decode token
      const { payload } = await jose.jwtVerify(token, verificationKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      // Cast payload to JwtPayload
      const jwtPayload = payload as unknown as JwtPayload;

      // Ensure token type is correct
      if (jwtPayload.type !== 'access') {
        return {
          valid: false,
          error: 'Invalid token type',
          errorType: 'invalid',
        };
      }

      return {
        valid: true,
        payload: jwtPayload,
      };
    } catch (error) {
      return this.handleValidationError(error);
    }
  }

  /**
   * Validate a refresh token
   *
   * Similar to access token validation but checks for 'refresh' type.
   * Also verifies token hasn't been used before (if rotation is enabled).
   *
   * @param token - JWT refresh token to validate
   * @returns Validation result with payload or error
   */
  async validateRefreshToken(token: string): Promise<TokenValidationResult> {
    try {
      if (!this.refreshTokenKey) {
        throw new Error('Refresh token key not configured');
      }

      const jose = await this.getJose();
      // Verify and decode token
      const { payload } = await jose.jwtVerify(token, this.refreshTokenKey);

      // Cast payload to JwtPayload
      const jwtPayload = payload as unknown as JwtPayload;

      // Ensure token type is correct
      if (jwtPayload.type !== 'refresh') {
        return {
          valid: false,
          error: 'Invalid token type',
          errorType: 'invalid',
        };
      }

      return {
        valid: true,
        payload: jwtPayload,
      };
    } catch (error) {
      return this.handleValidationError(error);
    }
  }

  /**
   * Decode a token without verification
   *
   * WARNING: This method does NOT validate the token signature or expiration.
   * Only use for non-security-critical operations like logging or analytics.
   *
   * @param token - JWT token to decode
   * @returns Decoded payload or null if malformed
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      // This is intentionally NOT signature-validated.
      // Avoid jose here to keep this method synchronous and safe in CJS builds.
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const payloadJson = Buffer.from(this.base64UrlToBase64(parts[1]), 'base64').toString('utf8');
      const parsed = JSON.parse(payloadJson) as unknown;
      return parsed as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Convert base64url-encoded strings to standard base64 for decoding.
   * @private
   */
  private base64UrlToBase64(input: string): string {
    // Replace URL-safe chars, then pad to a multiple of 4.
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    return `${base64}${'='.repeat(padLength)}`;
  }

  // ============================================================================
  // Token Utilities
  // ============================================================================

  /**
   * Generate a unique token family identifier
   *
   * Token families are used to track token rotation and detect reuse attacks.
   * All tokens in the same "family" (original + rotated versions) share this ID.
   *
   * SECURITY FIX #10: Increased from 16 bytes (128 bits) to 32 bytes (256 bits)
   *
   * @returns Random token family ID (256 bits)
   */
  generateTokenFamily(): string {
    return crypto.randomBytes(32).toString('hex'); // 256 bits
  }

  /**
   * Hash a token for storage
   *
   * Tokens should be hashed before storing in the database for security.
   * This prevents token exposure if the database is compromised.
   *
   * @param token - Token to hash
   * @returns SHA-256 hash of the token
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get access token expiry time in seconds
   *
   * @returns Access token expiry time in seconds
   *
   * @example
   * ```typescript
   * const expiry = jwtService.getAccessTokenExpiry();
   * console.log(expiry); // 900 (15 minutes)
   * ```
   */
  getAccessTokenExpiry(): number {
    return this.parseExpiresIn(this.config.accessToken.expiresIn);
  }

  /**
   * Get refresh token TTL in seconds
   *
   * Used for setting expiration on used-token tracking in storage.
   *
   * @returns TTL in seconds
   */
  getRefreshTokenTTL(): number {
    return this.parseExpiresIn(this.config.refreshToken.expiresIn);
  }

  /**
   * Extract token from Authorization header
   *
   * Supports standard "Bearer <token>" format
   *
   * @param authHeader - Authorization header value
   * @returns Extracted token or null
   *
   * @example
   * ```typescript
   * const token = jwtService.extractTokenFromHeader('Bearer eyJhbGc...');
   * // Returns: 'eyJhbGc...'
   * ```
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');

    // Verify Bearer scheme
    if (type !== 'Bearer') return null;

    return token || null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Parse expiration time from string or number
   * @param expiresIn - Expiration time (e.g., '15m', 900, '1h')
   * @returns Expiration time in seconds
   */
  private parseExpiresIn(expiresIn: string | number): number {
    if (typeof expiresIn === 'number') {
      return expiresIn;
    }

    // Parse time strings (e.g., '15m', '1h', '30d')
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, `Invalid expiresIn format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit];
  }

  /**
   * Handle JWT validation errors and convert to standardized result
   * @param error - Error from JWT verification
   * @returns Standardized validation result
   */
  private handleValidationError(error: unknown): TokenValidationResult {
    if (error instanceof Error) {
      // jose errors have a 'code' property
      const errorWithCode = error as Error & { code?: string };
      const errorCode = errorWithCode.code;

      // Token expired (jose errors)
      if (error.message.includes('expired') || errorCode === 'ERR_JWT_EXPIRED') {
        return {
          valid: false,
          error: 'Token has expired',
          errorType: 'expired',
        };
      }

      // Invalid signature or malformed token
      if (error.message.includes('signature') || error.message.includes('invalid') || errorCode === 'ERR_JWT_INVALID') {
        return {
          valid: false,
          error: 'Invalid token',
          errorType: 'invalid',
        };
      }
    }

    // Unknown error
    return {
      valid: false,
      error: 'Token validation failed',
      errorType: 'malformed',
    };
  }
}
