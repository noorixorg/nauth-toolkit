import { AuthResponse, AuthChallenge } from '../types/auth.types';
import { MFAMethod } from '../types/mfa.types';

/**
 * Helper utilities for working with authentication challenges.
 *
 * These utilities reduce boilerplate in consumer applications by providing
 * type-safe access to challenge parameters and state detection.
 */

/**
 * Check if a challenge requires phone collection (user has no phone number).
 *
 * @param challenge - Auth response with challenge
 * @returns True if phone collection is required
 *
 * @example
 * ```typescript
 * const challenge = auth.getCurrentChallenge();
 * if (challenge && requiresPhoneCollection(challenge)) {
 *   // Show phone input form
 * }
 * ```
 */
export function requiresPhoneCollection(challenge: AuthResponse): boolean {
  if (challenge.challengeName !== AuthChallenge.VERIFY_PHONE) {
    return false;
  }

  const params = challenge.challengeParameters;
  return (params?.['requiresPhoneCollection'] as string) === 'true';
}

/**
 * Get masked destination (email or phone) from challenge parameters.
 *
 * For VERIFY_EMAIL/VERIFY_PHONE challenges, returns `codeDeliveryDestination`.
 * For MFA_REQUIRED challenges, returns `maskedEmail` or `maskedPhone` based on method.
 *
 * @param challenge - Auth response with challenge
 * @returns Masked destination string or null if not available
 *
 * @example
 * ```typescript
 * const destination = getMaskedDestination(challenge);
 * if (destination) {
 *   console.log(`Code sent to ${destination}`);
 * }
 * ```
 */
export function getMaskedDestination(challenge: AuthResponse): string | null {
  const params = challenge.challengeParameters;
  if (!params) {
    return null;
  }

  const challengeName = challenge.challengeName;

  if (challengeName === AuthChallenge.MFA_REQUIRED) {
    // MFA_REQUIRED uses maskedEmail or maskedPhone based on preferredMethod
    const method = (params?.['preferredMethod'] || params?.['method']) as MFAMethod | undefined;
    if (method === 'sms') {
      return (params['maskedPhone'] as string) || null;
    }
    if (method === 'email') {
      return (params['maskedEmail'] as string) || null;
    }
    // Fallback: try both if method is not specified
    return (params['maskedPhone'] as string) || (params['maskedEmail'] as string) || null;
  }

  // VERIFY_EMAIL and VERIFY_PHONE use codeDeliveryDestination
  return (params['codeDeliveryDestination'] as string) || null;
}

/**
 * Get preferred MFA method from challenge parameters.
 *
 * @param challenge - Auth response with MFA_REQUIRED challenge
 * @returns MFA method or undefined if not available
 *
 * @example
 * ```typescript
 * const method = getMFAMethod(challenge);
 * if (method === 'totp') {
 *   // Show TOTP input
 * }
 * ```
 */
export function getMFAMethod(challenge: AuthResponse): MFAMethod | undefined {
  if (challenge.challengeName !== AuthChallenge.MFA_REQUIRED) {
    return undefined;
  }

  const params = challenge.challengeParameters;
  return (params?.['preferredMethod'] || params?.['method']) as MFAMethod | undefined;
}

/**
 * Get challenge instructions from challenge parameters.
 *
 * @param challenge - Auth response with challenge
 * @returns Instructions string or undefined if not available
 *
 * @example
 * ```typescript
 * const instructions = getChallengeInstructions(challenge);
 * if (instructions) {
 *   console.log(instructions);
 * }
 * ```
 */
export function getChallengeInstructions(challenge: AuthResponse): string | undefined {
  const params = challenge.challengeParameters;
  return params?.['instructions'] as string | undefined;
}

/**
 * Check if challenge is OTP-based (requires code input).
 *
 * @param challenge - Auth response with challenge
 * @returns True if challenge requires OTP code
 *
 * @example
 * ```typescript
 * if (isOTPChallenge(challenge)) {
 *   // Show OTP input component
 * }
 * ```
 */
export function isOTPChallenge(challenge: AuthResponse): boolean {
  const challengeName = challenge.challengeName;
  return (
    challengeName === AuthChallenge.VERIFY_EMAIL ||
    challengeName === AuthChallenge.VERIFY_PHONE ||
    challengeName === AuthChallenge.MFA_REQUIRED
  );
}
