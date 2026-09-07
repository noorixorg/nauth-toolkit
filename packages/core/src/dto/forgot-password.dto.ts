import { IsNotEmpty, IsString, MaxLength, MinLength, IsOptional, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Forgot Password DTO
 *
 * Request a password reset code for a user account.
 *
 * Security:
 * - This endpoint should not reveal whether an account exists.
 * - Identifier is sanitized (trimmed, email lowercased when detected).
 *
 * @example
 * ```typescript
 * await authService.forgotPassword({ identifier: 'user@example.com' });
 *
 * // With link support
 * await authService.forgotPassword({
 *   identifier: 'user@example.com',
 *   baseUrl: 'https://myapp.com/reset-password'
 * });
 * ```
 */
export class ForgotPasswordDTO {
  /**
   * User identifier used to locate the account.
   *
   * Accepts email, username, or phone depending on application login policy.
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased when email format detected (contains '@')
   */
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @MinLength(1, { message: 'Identifier is required' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.includes('@')) {
        return trimmed.toLowerCase();
      }
      return trimmed;
    }
    return value;
  })
  identifier!: string;

  /**
   * Base URL for building the reset link — **server-trusted, not for public request bodies.**
   *
   * SECURITY: The shipped `POST /forgot-password` route **ignores** this field and instead
   * derives the base URL from `config.password.passwordReset.baseUrl`. This prevents an
   * attacker from triggering a victim's reset and having the genuine email link to an
   * attacker host (which would carry the reset code). Do NOT re-expose this field on a public
   * route.
   *
   * It remains on the DTO for **trusted server-side callers**: a custom controller may compute
   * a base URL from its own config (optionally per-user, e.g. embedding the email) and pass it
   * to `AuthService.forgotPassword` directly. In that path the value is honoured because it
   * never came from the untrusted request body. The final link is `${baseUrl}?code=${code}`.
   *
   * Validation (when provided by a trusted caller):
   * - Must be a valid http/https URL (localhost allowed), max 2048 chars, trimmed.
   *
   * @example "https://myapp.com/reset-password"
   * @example "http://localhost:4200"
   */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'], require_tld: false },
    { message: 'Base URL must be valid URL with http:// or https://' },
  )
  @MaxLength(2048, { message: 'Base URL must not exceed 2048 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  baseUrl?: string;
}

/**
 * Forgot Password Response DTO
 *
 * Response for a password reset request.
 *
 * Security:
 * - `success` should be true even when the identifier does not map to any user,
 *   to prevent account enumeration.
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   destination: "j***@example.com",
 *   deliveryMedium: "email",
 *   expiresIn: 900
 * }
 * ```
 */
export class ForgotPasswordResponseDTO {
  /**
   * Always true when request accepted (regardless of account existence).
   */
  success!: boolean;

  /**
   * Masked delivery destination (email or phone) when available.
   *
   * Examples:
   * - `j***@example.com`
   * - `+1***1234`
   */
  destination?: string;

  /**
   * Delivery channel used.
   */
  deliveryMedium?: 'email' | 'sms';

  /**
   * Code expiry in seconds.
   */
  expiresIn?: number;
}
