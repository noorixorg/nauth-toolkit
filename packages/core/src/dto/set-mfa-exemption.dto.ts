/**
 * DTO for setting MFA exemption
 *
 * Used to grant or revoke a user's exemption from multi-factor authentication requirements.
 * Admin-only operation.
 *
 * @example
 * ```typescript
 * const result = await mfaService.setMFAExemption({
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd', // User sub (UUID v4)
 *   exempt: true,
 *   reason: 'Business partner requires MFA bypass',
 *   grantedBy: 'admin@example.com'
 * });
 * ```
 */

import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for setting MFA exemption
 *
 * SECURITY: This DTO targets an arbitrary user; it must only be accepted by admin-protected APIs.
 */
export class SetMFAExemptionDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;

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
