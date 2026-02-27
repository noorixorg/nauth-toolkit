/**
 * MFA (Multi-Factor Authentication) DTOs
 *
 * Request and response types for MFA operations including:
 * - TOTP (Time-based One-Time Password) setup and verification
 * - SMS MFA setup and verification
 * - Passkey (WebAuthn) registration and authentication
 * - Backup codes generation and usage
 */

// ============================================================================
// MFA Challenge Response
// ============================================================================

/**
 * MFA Challenge Response DTO
 *
 * Returned when login requires MFA verification.
 * Client must complete MFA challenge to receive access tokens.
 *
 * @example
 * ```typescript
 * // Login response with MFA required
 * {
 *   challengeName: 'MFA_REQUIRED',
 *   session: 'challenge-session-token-here',
 *   challengeParameters: {
 *     availableMethods: ['totp', 'sms'],
 *     preferredMethod: 'totp'
 *   }
 * }
 * ```
 */
export interface MFAChallengeResponseDTO {
  /**
   * Challenge type (always 'MFA_REQUIRED')
   */
  challengeName: 'MFA_REQUIRED';

  /**
   * Temporary challenge session token
   * Must be submitted with MFA verification
   */
  session: string;

  /**
   * Challenge parameters with available MFA methods
   */
  challengeParameters: {
    /**
     * MFA methods available for this user
     */
    availableMethods: Array<'totp' | 'sms' | 'passkey' | 'backup'>;

    /**
     * User's preferred MFA method
     */
    preferredMethod?: 'totp' | 'sms' | 'passkey';

    /**
     * Masked phone number for SMS (if available)
     * @example '***-***-1234'
     */
    maskedPhone?: string;
  };
}

// ============================================================================
// MFA Verification
// ============================================================================

/**
 * Verify MFA Code DTO
 *
 * Submit MFA code to complete authentication challenge.
 *
 * @example
 * ```typescript
 * // Verify TOTP code
 * {
 *   session: 'challenge-session-token',
 *   method: 'totp',
 *   code: '123456'
 * }
 *
 * // Verify SMS code with device trust
 * {
 *   session: 'challenge-session-token',
 *   method: 'sms',
 *   code: '987654',
 *   trustDevice: true
 * }
 * ```
 */
export interface VerifyMFACodeDTO {
  /**
   * Challenge session token from MFA challenge
   */
  session: string;

  /**
   * MFA method being used
   */
  method: 'totp' | 'sms' | 'backup';

  /**
   * MFA code to verify
   */
  code: string;

  /**
   * Trust this device (skip MFA for configured period)
   * Only applicable if rememberDevice is enabled in config
   *
   * @default false
   */
  trustDevice?: boolean;

  /**
   * Device identifier for trusted device tracking
   * Should be persistent per device (e.g., UUID stored in localStorage)
   */
  deviceId?: string;
}

/**
 * Verify Passkey DTO
 *
 * Submit WebAuthn assertion to complete authentication challenge.
 *
 * @example
 * ```typescript
 * {
 *   session: 'challenge-session-token',
 *   credential: {
 *     id: 'credential-id-here',
 *     rawId: 'base64-raw-id',
 *     response: {
 *       clientDataJSON: 'base64-client-data',
 *       authenticatorData: 'base64-authenticator-data',
 *       signature: 'base64-signature',
 *       userHandle: 'base64-user-handle'
 *     },
 *     type: 'public-key'
 *   },
 *   trustDevice: true
 * }
 * ```
 */
export interface VerifyPasskeyDTO {
  /**
   * Challenge session token from MFA challenge
   */
  session: string;

  /**
   * WebAuthn credential (PublicKeyCredential from navigator.credentials.get())
   */
  credential: {
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle?: string;
    };
    type: 'public-key';
  };

  /**
   * Trust this device (skip MFA for configured period)
   * @default false
   */
  trustDevice?: boolean;
}

// ============================================================================
// TOTP Setup
// ============================================================================

/**
 * Setup TOTP Response DTO
 *
 * Returns QR code and secret for TOTP setup.
 * User must scan QR code with authenticator app and verify with a code.
 *
 * @example
 * ```typescript
 * {
 *   secret: 'base32-encoded-secret',
 *   qrCode: 'data:image/png;base64,...',
 *   manualEntryKey: 'ABCD EFGH IJKL MNOP',
 *   issuer: 'MyApp',
 *   accountName: 'user@example.com'
 * }
 * ```
 */
export interface SetupTOTPResponseDTO {
  /**
   * Base32-encoded TOTP secret
   * Used to generate QR code and for manual entry
   */
  secret: string;

  /**
   * QR code as data URL
   * User scans this with authenticator app
   */
  qrCode: string;

  /**
   * Formatted secret for manual entry
   * Displayed if QR scan fails
   * @example 'ABCD EFGH IJKL MNOP'
   */
  manualEntryKey: string;

  /**
   * Issuer name (from config)
   */
  issuer: string;

  /**
   * Account name (typically user's email)
   */
  accountName: string;
}

/**
 * Verify TOTP Setup DTO
 *
 * Submit code to complete TOTP setup.
 * Verifies the user can generate valid codes.
 *
 * @example
 * ```typescript
 * {
 *   secret: 'base32-secret-from-setup',
 *   code: '123456',
 *   deviceName: 'Google Authenticator'
 * }
 * ```
 */
export interface VerifyTOTPSetupDTO {
  /**
   * TOTP secret from setup response
   */
  secret: string;

  /**
   * TOTP code from authenticator app
   */
  code: string;

  /**
   * User-friendly device name
   * @example 'Google Authenticator', 'Authy', '1Password'
   */
  deviceName?: string;
}

// ============================================================================
// SMS MFA Setup
// ============================================================================

/**
 * Setup SMS MFA DTO
 *
 * Configure SMS as MFA method.
 * Sends verification code to phone number.
 *
 * @example
 * ```typescript
 * {
 *   phoneNumber: '+1234567890',
 *   deviceName: 'My Phone'
 * }
 * ```
 */
export interface SetupSMSMFADTO {
  /**
   * Phone number in E.164 format
   * @example '+1234567890'
   */
  phoneNumber: string;

  /**
   * User-friendly device name
   * @example 'My iPhone', 'Work Phone'
   */
  deviceName?: string;
}

/**
 * Verify SMS MFA Setup DTO
 *
 * Submit code to complete SMS MFA setup.
 *
 * @example
 * ```typescript
 * {
 *   phoneNumber: '+1234567890',
 *   code: '123456'
 * }
 * ```
 */
export interface VerifySMSMFASetupDTO {
  /**
   * Phone number receiving the code
   */
  phoneNumber: string;

  /**
   * SMS verification code
   */
  code: string;
}

/**
 * Send SMS MFA Code DTO
 *
 * Request SMS code during MFA challenge.
 *
 * @example
 * ```typescript
 * {
 *   session: 'challenge-session-token'
 * }
 * ```
 */
export interface SendSMSMFACodeDTO {
  /**
   * Challenge session token
   */
  session: string;
}

// ============================================================================
// Passkey Setup
// ============================================================================

/**
 * Setup Passkey Response DTO
 *
 * Returns WebAuthn registration options.
 * Client passes these to navigator.credentials.create().
 *
 * @example
 * ```typescript
 * {
 *   challenge: 'base64-challenge',
 *   rp: { name: 'MyApp', id: 'myapp.com' },
 *   user: {
 *     id: 'base64-user-id',
 *     name: 'user@example.com',
 *     displayName: 'John Doe'
 *   },
 *   pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
 *   timeout: 60000,
 *   attestation: 'none'
 * }
 * ```
 */
export interface SetupPasskeyResponseDTO {
  /**
   * WebAuthn registration options
   * Pass to navigator.credentials.create({ publicKey: options })
   */
  options: {
    challenge: string;
    rp: {
      name: string;
      id: string;
    };
    user: {
      id: string;
      name: string;
      displayName: string;
    };
    pubKeyCredParams: Array<{
      type: 'public-key';
      alg: number;
    }>;
    timeout: number;
    attestation: 'none' | 'indirect' | 'direct';
    authenticatorSelection?: {
      authenticatorAttachment?: 'platform' | 'cross-platform';
      requireResidentKey?: boolean;
      userVerification?: 'required' | 'preferred' | 'discouraged';
    };
    excludeCredentials?: Array<{
      id: string;
      type: 'public-key';
      transports?: string[];
    }>;
  };
}

/**
 * Verify Passkey Setup DTO
 *
 * Submit WebAuthn credential to complete passkey setup.
 *
 * @example
 * ```typescript
 * {
 *   credential: {
 *     id: 'credential-id',
 *     rawId: 'base64-raw-id',
 *     response: {
 *       clientDataJSON: 'base64-client-data',
 *       attestationObject: 'base64-attestation'
 *     },
 *     type: 'public-key'
 *   },
 *   deviceName: 'iPhone 15 Pro'
 * }
 * ```
 */
export interface VerifyPasskeySetupDTO {
  /**
   * WebAuthn credential from navigator.credentials.create()
   */
  credential: {
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      attestationObject: string;
    };
    type: 'public-key';
  };

  /**
   * User-friendly device name
   * @example 'iPhone 17 Pro', 'YubiKey 5C'
   */
  deviceName?: string;
}

/**
 * Get Passkey Challenge Response DTO
 *
 * Returns WebAuthn authentication options for MFA challenge.
 *
 * @example
 * ```typescript
 * {
 *   challenge: 'base64-challenge',
 *   timeout: 60000,
 *   rpId: 'myapp.com',
 *   allowCredentials: [
 *     { id: 'credential-id-1', type: 'public-key', transports: ['usb', 'nfc'] }
 *   ],
 *   userVerification: 'preferred'
 * }
 * ```
 */
export interface GetPasskeyChallengeResponseDTO {
  /**
   * WebAuthn authentication options
   * Pass to navigator.credentials.get({ publicKey: options })
   */
  options: {
    challenge: string;
    timeout: number;
    rpId: string;
    allowCredentials: Array<{
      id: string;
      type: 'public-key';
      transports?: string[];
    }>;
    userVerification: 'required' | 'preferred' | 'discouraged';
  };
}

// ============================================================================
// Backup Codes
// ============================================================================

/**
 * Generate Backup Codes Response DTO
 *
 * Returns newly generated backup codes.
 * Codes are only shown once - user must save them securely.
 *
 * @example
 * ```typescript
 * {
 *   codes: [
 *     'ABCD1234',
 *     'EFGH5678',
 *     // ... 8 more codes
 *   ],
 *   generated: '2024-01-15T10:30:00Z'
 * }
 * ```
 */
export interface GenerateBackupCodesResponseDTO {
  /**
   * Array of backup codes
   * Each code can only be used once
   */
  codes: string[];

  /**
   * Generation timestamp
   */
  generated: string;
}

// ============================================================================
// MFA Device Management
// ============================================================================

/**
 * MFA Device DTO
 *
 * Information about a registered MFA device.
 *
 * @example
 * ```typescript
 * {
 *   id: 123,
 *   type: 'totp',
 *   name: 'Google Authenticator',
 *   isActive: true,
 *   isPreferred: true,
 *   lastUsedAt: '2024-01-15T10:30:00Z',
 *   createdAt: '2024-01-01T00:00:00Z'
 * }
 * ```
 */
export interface MFADeviceDTO {
  /**
   * Device ID
   */
  id: number;

  /**
   * MFA method type
   */
  type: 'totp' | 'sms' | 'passkey';

  /**
   * User-friendly device name
   */
  name: string;

  /**
   * Whether device is active
   */
  isActive: boolean;

  /**
   * Whether this is the preferred device for this method
   */
  isPreferred: boolean;

  /**
   * Last usage timestamp
   */
  lastUsedAt?: string;

  /**
   * Registration timestamp
   */
  createdAt: string;

  /**
   * Masked phone number (SMS only)
   */
  maskedPhone?: string;
}

/**
 * List MFA Devices Response DTO
 *
 * Returns all MFA devices for a user.
 *
 * @example
 * ```typescript
 * {
 *   devices: [
 *     { id: 1, type: 'totp', name: 'Google Authenticator', ... },
 *     { id: 2, type: 'sms', name: 'My Phone', ... }
 *   ],
 *   hasBackupCodes: true
 * }
 * ```
 */
export interface ListMFADevicesResponseDTO {
  /**
   * Array of MFA devices
   */
  devices: MFADeviceDTO[];

  /**
   * Whether user has backup codes generated
   */
  hasBackupCodes: boolean;
}

/**
 * Update MFA Device DTO
 *
 * Update device name or preferred status.
 *
 * @example
 * ```typescript
 * {
 *   name: 'My New Authenticator',
 *   isPreferred: true
 * }
 * ```
 */
export interface UpdateMFADeviceDTO {
  /**
   * New device name
   */
  name?: string;

  /**
   * Set as preferred device
   */
  isPreferred?: boolean;
}

/**
 * Disable MFA Device DTO
 *
 * Disable an MFA device (requires password confirmation).
 *
 * @example
 * ```typescript
 * {
 *   password: 'user-password-here'
 * }
 * ```
 */
export interface DisableMFADeviceDTO {
  /**
   * User's password (for security confirmation)
   */
  password: string;
}

// ============================================================================
// MFA Status
// ============================================================================

/**
 * MFA Status Response DTO
 *
 * Returns MFA configuration status for a user.
 *
 * @example
 * ```typescript
 * {
 *   enabled: true,
 *   required: false,
 *   gracePeriodEnds: '2024-01-22T00:00:00Z',
 *   configuredMethods: ['totp', 'sms'],
 *   preferredMethod: 'totp',
 *   hasBackupCodes: true
 * }
 * ```
 */
export interface MFAStatusResponseDTO {
  /**
   * Whether MFA is enabled for this user
   */
  enabled: boolean;

  /**
   * Whether MFA is required (based on enforcement policy)
   */
  required: boolean;

  /**
   * Grace period expiration (if MFA is required)
   * After this date, user must enable MFA to login
   */
  gracePeriodEnds?: string;

  /**
   * MFA methods configured by user
   */
  configuredMethods: Array<'totp' | 'sms' | 'passkey'>;

  /**
   * User's preferred MFA method
   */
  preferredMethod?: 'totp' | 'sms' | 'passkey';

  /**
   * Whether user has generated backup codes
   */
  hasBackupCodes: boolean;
}
