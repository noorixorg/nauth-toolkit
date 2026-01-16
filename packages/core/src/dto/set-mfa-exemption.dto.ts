/**
 * DTO for setting MFA exemption
 *
 * Used to grant or revoke a user's exemption from multi-factor authentication requirements.
 * Admin-only operation.
 *
 * @example
 * ```typescript
 * const result = await mfaService.setMFAExemption({
 *   identifier: 'user@example.com', // email, username, phone, or user sub (UUID)
 *   exempt: true,
 *   reason: 'Business partner requires MFA bypass',
 *   grantedBy: 'admin@example.com'
 * });
 * ```
 */

import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for setting MFA exemption
 *
 * SECURITY: This DTO targets an arbitrary user; it must only be accepted by admin-protected APIs.
 */
export class SetMFAExemptionDTO {
  /**
   * Target user identifier
   *
   * Can be any supported identifier:
   * - user sub (UUID)
   * - email
   * - username
   * - phone (E.164)
   *
   * Sanitization:
   * - Trimmed
   *
   * @example "user@example.com"
   */
  @IsString({ message: 'Identifier must be a string' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  identifier!: string;

  /**
   * Whether to grant exemption (true) or revoke exemption (false)
   */
  @IsBoolean({ message: 'Exempt must be a boolean' })
  exempt!: boolean;

  /**
   * Optional reason for the exemption status change
   *
   * Validation:
   * - Max 500 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  reason?: string | null;

  /**
   * Optional identifier of the admin performing this action
   *
   * Validation:
   * - Max 255 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'Granted by must be a string' })
  @MaxLength(255, { message: 'Granted by must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  grantedBy?: string | null;
}

/**
 * Response DTO for setting MFA exemption
 */
export class SetMFAExemptionResponseDTO {
  /**
   * Whether user is exempt from MFA requirements
   */
  mfaExempt!: boolean;

  /**
   * Reason for MFA exemption (if exempt)
   */
  mfaExemptReason!: string | null;

  /**
   * Date when MFA exemption was granted (if exempt)
   */
  mfaExemptGrantedAt!: Date | null;
}
