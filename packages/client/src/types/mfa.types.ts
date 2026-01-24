/**
 * MFA device method type (methods that require device setup).
 * Excludes 'backup' as it's not a device method.
 */
export type MFADeviceMethod = 'sms' | 'email' | 'totp' | 'passkey';

/**
 * All MFA methods including backup codes (for verification).
 */
export type MFAMethod = MFADeviceMethod | 'backup';

/**
 * MFA challenge method subset (for challenge-data retrieval).
 */
export type MFAChallengeMethod = 'passkey' | 'sms' | 'email' | 'totp' | 'backup';

/**
 * MFA status for authenticated user.
 */
export interface MFAStatus {
  enabled: boolean;
  required: boolean;
  methods: MFADeviceMethod[]; // Configured device methods (excludes 'backup')
  availableMethods: MFAMethod[]; // Available methods including 'backup' if enabled
  hasBackupCodes: boolean;
  preferredMethod?: MFADeviceMethod; // Preferred method (device methods only, excludes 'backup')
  mfaExempt: boolean;
  mfaExemptReason: string | null;
  mfaExemptGrantedAt: string | Date | null;
}

/**
 * MFA device information.
 */
export interface MFADevice {
  id: number;
  type: MFADeviceMethod; // Device methods only (excludes 'backup')
  name: string;
  isPreferred: boolean; // Whether this is the preferred device for this method
  isActive: boolean;
  createdAt: string | Date;
}

/**
 * Response from removing a single MFA device by ID.
 */
export interface RemoveMFADeviceResponse {
  removedDeviceId: number;
  removedMethod: MFADeviceMethod;
  mfaDisabled: boolean;
}

/**
 * Response from getting user MFA devices.
 */
export interface GetMFADevicesResponse {
  devices: MFADevice[];
}

/**
 * MFA setup data returned by providers.
 */
export interface MFASetupData {
  secret?: string;
  qrCode?: string;
  manualEntryKey?: string;
  phone?: string;
  challenge?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Response from getSetupData API call.
 * Contains provider-specific MFA setup information.
 */
export interface GetSetupDataResponse {
  setupData: Record<string, unknown>;
}

/**
 * Response from getChallengeData API call.
 * Contains challenge-specific data (e.g., passkey options).
 */
export interface GetChallengeDataResponse {
  challengeData: Record<string, unknown>;
}

/**
 * Backup codes response.
 */
export interface BackupCodesResponse {
  codes: string[];
}
