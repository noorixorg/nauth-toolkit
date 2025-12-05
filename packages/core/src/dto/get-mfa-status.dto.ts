/**
 * DTO for getting MFA status
 *
 * Used to retrieve comprehensive MFA status for a user including enabled status,
 * configured methods, available methods, backup codes, and exemption information.
 *
 * @example
 * ```typescript
 * const status = await mfaService.getMFAStatus({
 *   sub: 'user-uuid'
 * });
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFADeviceMethod } from '../enums/mfa-method.enum';

/**
 * DTO for getting MFA status
 */
export class GetMFAStatusDTO {
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
}

/**
 * Response DTO for MFA status
 */
export class GetMFAStatusResponseDTO {
  /**
   * Whether MFA is enabled for the user
   */
  enabled!: boolean;

  /**
   * Whether MFA is required (enabled and has configured devices)
   */
  required!: boolean;

  /**
   * Array of configured MFA device methods
   */
  configuredMethods!: Array<MFADeviceMethod>;

  /**
   * Array of available MFA methods that can be set up
   */
  availableMethods!: Array<string>;

  /**
   * Whether user has backup codes
   */
  hasBackupCodes!: boolean;

  /**
   * Preferred MFA method (if set)
   */
  preferredMethod?: MFADeviceMethod;

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
