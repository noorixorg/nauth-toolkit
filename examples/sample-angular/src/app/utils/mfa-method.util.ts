import { MFAMethod } from '@nauth-toolkit/client';

/**
 * MFA Method Utility Functions
 *
 * Provides consistent method name, icon, and description across components.
 * Centralizes MFA method display logic to avoid duplication.
 */

/**
 * Get display name for MFA method
 *
 * @param method - MFA method type
 * @returns Human-readable method name
 *
 * @example
 * ```typescript
 * const name = getMfaMethodName('totp'); // Returns 'Authenticator App'
 * ```
 */
export function getMfaMethodName(method: MFAMethod): string {
  switch (method) {
    case 'sms':
      return 'SMS';
    case 'email':
      return 'Email';
    case 'totp':
      return 'Authenticator App';
    case 'passkey':
      return 'Passkey';
    default:
      return method.toUpperCase();
  }
}

/**
 * Get PrimeNG icon class for MFA method
 *
 * @param method - MFA method type
 * @returns PrimeNG icon class name
 *
 * @example
 * ```typescript
 * const icon = getMfaMethodIcon('sms'); // Returns 'pi-mobile'
 * ```
 */
export function getMfaMethodIcon(method: MFAMethod): string {
  switch (method) {
    case 'sms':
      return 'pi-mobile';
    case 'email':
      return 'pi-envelope';
    case 'totp':
      return 'pi-qrcode';
    case 'passkey':
      return 'pi-key';
    default:
      return 'pi-shield';
  }
}

/**
 * Get description for MFA method
 *
 * @param method - MFA method type
 * @returns Human-readable method description
 *
 * @example
 * ```typescript
 * const desc = getMfaMethodDescription('sms'); // Returns 'Receive a code via SMS'
 * ```
 */
export function getMfaMethodDescription(method: MFAMethod): string {
  switch (method) {
    case 'sms':
      return 'Receive a code via SMS';
    case 'email':
      return 'Receive a code via email';
    case 'totp':
      return 'Use your authenticator app';
    case 'passkey':
      return 'Use biometric or security key';
    default:
      return '';
  }
}








