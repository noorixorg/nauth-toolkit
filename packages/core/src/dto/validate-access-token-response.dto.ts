/**
 * JWT Payload structure for validated tokens
 *
 * Contains all claims present in a valid access token.
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: string;

  /** User email */
  email: string;

  /** Token type - always 'access' for access tokens */
  type: 'access' | 'refresh';

  /** Session ID */
  sessionId: string;

  /** Token family ID (for rotation detection) */
  tokenFamily?: string;

  /** Issued at timestamp (Unix epoch) */
  iat: number;

  /** Expiration timestamp (Unix epoch) */
  exp: number;

  /** Issuer */
  iss?: string;

  /** Audience */
  aud?: string | string[];

  /** Device ID */
  deviceId?: string;
}

/**
 * Validate Access Token Response DTO
 *
 * Response DTO for token validation operations.
 *
 * @example
 * ```typescript
 * // Valid token
 * {
 *   valid: true,
 *   payload: {
 *     sub: "a21b654c-2746-4168-acee-c175083a65cd",
 *     email: "user@example.com",
 *     type: "access",
 *     sessionId: "session-uuid",
 *     iat: 1704067200,
 *     exp: 1704070800
 *   }
 * }
 *
 * // Invalid token
 * {
 *   valid: false,
 *   error: "Token expired",
 *   errorType: "expired"
 * }
 * ```
 */
export class ValidateAccessTokenResponseDTO {
  /**
   * Whether the token is valid
   *
   * If true, payload will be present.
   * If false, error and errorType will be present.
   */
  valid!: boolean;

  /**
   * Decoded JWT payload (only if valid is true)
   *
   * Contains all token claims including user information and session details.
   */
  payload?: JwtPayload;

  /**
   * Error message (only if valid is false)
   *
   * Human-readable description of why validation failed.
   *
   * @example "Token expired", "Invalid token signature", "Invalid token type"
   */
  error?: string;

  /**
   * Error type for specific handling (only if valid is false)
   *
   * Categorizes the validation error for programmatic handling.
   *
   * - `expired`: Token has expired (exp claim < current time)
   * - `invalid`: Token signature verification failed or invalid format
   * - `malformed`: Token structure is invalid (not a proper JWT)
   * - `blacklisted`: Token has been revoked or blacklisted
   */
  errorType?: 'expired' | 'invalid' | 'malformed' | 'blacklisted';
}


