import { IsString, MinLength, MaxLength, IsOptional, ValidateIf } from 'class-validator';

/**
 * Refresh Token DTO
 *
 * Used for refreshing access tokens with a valid refresh token.
 *
 * Supports both JSON and cookies token delivery modes:
 * - JSON mode: refreshToken must be provided in request body
 * - Cookies mode: refreshToken is optional in body (read from cookie by controller)
 *
 * Security:
 * - Token length validated (prevents DoS)
 * - JWT tokens can be long, but we validate input length
 * - Token is validated in service layer for format and signature
 *
 * @example
 * ```typescript
 * // JSON mode
 * POST /auth/refresh
 * { "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 *
 * // Cookies mode
 * POST /auth/refresh
 * {} // refreshToken read from cookie by controller
 * ```
 */
export class RefreshTokenDTO {
  /**
   * JWT refresh token
   *
   * Optional to support cookies mode where token is read from cookie.
   * If provided, must be a valid string with min 10 characters.
   *
   * Validation:
   * - Optional (allows cookies mode with empty body)
   * - If provided, must be a string
   * - If provided, min 10 characters (minimum valid JWT length)
   * - If provided, max 2048 characters (prevents DoS, typical JWT is 200-500 chars)
   *
   * Note: Token format and signature validated in service layer
   * Note: Controller fills this from cookies if empty in cookies mode
   */
  @ValidateIf((o) => o.refreshToken !== undefined && o.refreshToken !== null && o.refreshToken !== '')
  @IsString({ message: 'Refresh token must be a string' })
  @MinLength(10, { message: 'Refresh token is required' })
  @MaxLength(2048, { message: 'Refresh token must not exceed 2048 characters' })
  @IsOptional()
  refreshToken?: string;
}
