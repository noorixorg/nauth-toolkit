/**
 * Challenge Response DTOs for Unified Challenge System
 *
 * Discriminated union types for responding to authentication challenges.
 * Each challenge type has specific required parameters.
 *
 * @module ChallengeResponseDTO
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base interface for all challenge responses
 */
export interface BaseChallengeResponse {
  /** Challenge session token */
  session: string;
}

// ============================================================================
// Email Verification Challenge
// ============================================================================

/**
 * Response for email verification challenge
 *
 * @example
 * ```typescript
 * const response: VerifyEmailResponse = {
 *   session: 'challenge-session-token',
 *   type: 'VERIFY_EMAIL',
 *   code: '123456'
 * };
 * ```
 */
export interface VerifyEmailResponse extends BaseChallengeResponse {
  type: 'VERIFY_EMAIL';
  /** 6-digit verification code sent to email */
  code: string;
}

// ============================================================================
// Phone Verification Challenge
// ============================================================================

/**
 * Response for collecting phone number (first step)
 *
 * @example
 * ```typescript
 * const response: CollectPhoneResponse = {
 *   session: 'challenge-session-token',
 *   type: 'VERIFY_PHONE',
 *   phone: '+1234567890'
 * };
 * ```
 */
export interface CollectPhoneResponse extends BaseChallengeResponse {
  type: 'VERIFY_PHONE';
  /** Phone number in E.164 format */
  phone: string;
}

/**
 * Response for verifying phone with code (second step)
 *
 * @example
 * ```typescript
 * const response: VerifyPhoneResponse = {
 *   session: 'challenge-session-token',
 *   type: 'VERIFY_PHONE',
 *   code: '123456'
 * };
 * ```
 */
export interface VerifyPhoneResponse extends BaseChallengeResponse {
  type: 'VERIFY_PHONE';
  /** 6-digit verification code sent to phone */
  code: string;
}

// ============================================================================
// MFA Verification Challenge
// ============================================================================

/**
 * Response for MFA verification with code (SMS/TOTP/Backup)
 *
 * @example
 * ```typescript
 * const response: VerifyMFACodeResponse = {
 *   session: 'challenge-session-token',
 *   type: 'MFA_REQUIRED',
 *   method: 'totp',
 *   code: '123456'
 * };
 * ```
 */
export interface VerifyMFACodeResponse extends BaseChallengeResponse {
  type: 'MFA_REQUIRED';
  /** MFA method being used */
  method: 'sms' | 'totp' | 'backup';
  /** Verification code */
  code: string;
}

/**
 * Response for MFA verification with passkey
 *
 * @example
 * ```typescript
 * const response: VerifyMFAPasskeyResponse = {
 *   session: 'challenge-session-token',
 *   type: 'MFA_REQUIRED',
 *   method: 'passkey',
 *   credential: { id: '...', rawId: '...', response: {...} }
 * };
 * ```
 */
export interface VerifyMFAPasskeyResponse extends BaseChallengeResponse {
  type: 'MFA_REQUIRED';
  /** Passkey method */
  method: 'passkey';
  /** WebAuthn credential from navigator.credentials.get() */
  credential: Record<string, unknown>;
}

// ============================================================================
// Force Password Change Challenge
// ============================================================================

/**
 * Response for forced password change challenge
 *
 * @example
 * ```typescript
 * const response: ForceChangePasswordResponse = {
 *   session: 'challenge-session-token',
 *   type: 'FORCE_CHANGE_PASSWORD',
 *   newPassword: 'NewSecurePassword123!'
 * };
 * ```
 */
export interface ForceChangePasswordResponse extends BaseChallengeResponse {
  type: 'FORCE_CHANGE_PASSWORD';
  /** New password meeting security requirements */
  newPassword: string;
}

// ============================================================================
// MFA Setup Challenge
// ============================================================================

/**
 * Response for MFA setup during challenge
 *
 * @example
 * ```typescript
 * // SMS setup
 * const smsResponse: MFASetupResponse = {
 *   session: 'challenge-session-token',
 *   type: 'MFA_SETUP_REQUIRED',
 *   method: 'sms',
 *   setupData: { phone: '+1234567890', code: '123456' }
 * };
 *
 * // TOTP setup
 * const totpResponse: MFASetupResponse = {
 *   session: 'challenge-session-token',
 *   type: 'MFA_SETUP_REQUIRED',
 *   method: 'totp',
 *   setupData: { code: '123456' }
 * };
 *
 * // Passkey setup
 * const passkeyResponse: MFASetupResponse = {
 *   session: 'challenge-session-token',
 *   type: 'MFA_SETUP_REQUIRED',
 *   method: 'passkey',
 *   setupData: { credential: {...} }
 * };
 * ```
 */
export interface MFASetupResponse extends BaseChallengeResponse {
  type: 'MFA_SETUP_REQUIRED';
  /** MFA method being set up */
  method: 'sms' | 'email' | 'totp' | 'passkey';
  /**
   * Method-specific setup data
   * - SMS: { phone: string, code: string }
   * - TOTP: { code: string }
   * - Passkey: { credential: Record<string, unknown> }
   */
  setupData: Record<string, unknown>;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Discriminated union of all challenge response types
 *
 * Use this type for the unified respondToChallenge() API.
 * TypeScript will narrow the type based on the 'type' discriminator.
 *
 * @example
 * ```typescript
 * async function handleChallenge(response: ChallengeResponseData) {
 *   switch (response.type) {
 *     case 'VERIFY_EMAIL':
 *       // TypeScript knows response.code is available
 *       break;
 *     case 'MFA_REQUIRED':
 *       if (response.method === 'passkey') {
 *         // TypeScript knows response.credential is available
 *       } else {
 *         // TypeScript knows response.code is available
 *       }
 *       break;
 *   }
 * }
 * ```
 */
export type ChallengeResponseData =
  | VerifyEmailResponse
  | CollectPhoneResponse
  | VerifyPhoneResponse
  | VerifyMFACodeResponse
  | VerifyMFAPasskeyResponse
  | ForceChangePasswordResponse
  | MFASetupResponse;
