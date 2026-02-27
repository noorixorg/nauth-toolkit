import { MFADeviceMethod } from '../enums/mfa-method.enum';

/**
 * Response DTO for MFA status
 *
 * Returned by MFAService.getMfaStatus() (user self-service) and
 * MFAService.adminGetMfaStatus() (admin operation).
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
