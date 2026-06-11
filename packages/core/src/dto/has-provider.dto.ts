/**
 * DTO for checking if MFA provider is registered
 *
 * Used to check if a specific MFA provider is registered and available.
 *
 * @example
 * ```typescript
 * const hasTotp = await mfaService.hasProvider({
 *   methodName: 'totp'
 * });
 * ```
 */

import { IsEnum, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for checking if MFA provider is registered
 */
export class HasProviderDTO {
  /**
   * Provider method name
   *
   * Validation:
   * - Must be one of: totp, sms, email, passkey
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed and lowercased
   *
   * @example "totp"
   */
  @IsString({ message: 'Method name must be a string' })
  @IsEnum(MFAMethod, {
    message: 'Method name must be one of: totp, sms, email, passkey',
  })
  @MaxLength(50, { message: 'Method name must not exceed 50 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  methodName!: string;
}

/**
 * Response DTO for has provider check
 */
export class HasProviderResponseDTO {
  /**
   * Whether provider is registered
   */
  hasProvider!: boolean;
}
