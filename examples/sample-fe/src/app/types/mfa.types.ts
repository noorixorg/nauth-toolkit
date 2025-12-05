/**
 * MFA Method Types
 *
 * Shared type definitions for Multi-Factor Authentication methods.
 * Use these types instead of inline union types throughout the frontend.
 *
 * @example
 * ```typescript
 * import { MFADeviceMethod, MFAVerificationMethod } from '../types/mfa.types';
 *
 * function setupMFA(method: MFADeviceMethod): void {
 *   // ...
 * }
 * ```
 */

/**
 * Device MFA methods (methods that require device setup)
 */
export type MFADeviceMethod = 'sms' | 'email' | 'totp' | 'passkey';

/**
 * Verification MFA methods (all methods available for verification)
 * Includes all device methods plus backup codes
 */
export type MFAVerificationMethod = MFADeviceMethod | 'backup';

/**
 * Array of all device methods
 */
export const MFADeviceMethods: readonly MFADeviceMethod[] = [
  'sms',
  'email',
  'totp',
  'passkey',
] as const;

/**
 * Array of all verification methods
 */
export const MFAVerificationMethods: readonly MFAVerificationMethod[] = [
  'sms',
  'email',
  'totp',
  'passkey',
  'backup',
] as const;
