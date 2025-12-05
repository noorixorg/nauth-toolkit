/**
 * Authentication Models
 *
 * Defines interfaces for authentication-related data structures
 */

export interface User {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isEmailVerified: boolean;
  isPhoneVerified?: boolean;
  socialProviders?: string[];
  hasPasswordHash: boolean;
  mfaExempt?: boolean;
  mfaExemptReason?: string | null;
  mfaExemptGrantedAt?: Date | null;
  mfaExemptGrantedBy?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Calculated dynamically - seconds until expiry
  expiresAt: number; // Actual expiry timestamp (stored in localStorage)
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  phone?: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple' | 'facebook';
  state?: string;
}

export interface SocialCallbackRequest {
  provider: 'google' | 'apple' | 'facebook';
  code: string;
  state: string;
  user?: string;
}

/**
 * Unified Authentication Response
 * Used for ALL authentication operations:
 * - Login, Signup
 * - Social auth (Google, Apple, Facebook)
 * - Token refresh
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // Unix timestamp in seconds
  refreshTokenExpiresAt: number; // Unix timestamp in seconds
  trusted?: boolean; // Whether the current device is already trusted
  deviceToken?: string; // Device token for trusted device feature (mobile apps only)
}

export interface SocialAccount {
  provider: string;
  providerEmail?: string;
  linkedAt: Date;
  lastUsedAt?: Date;
}

export interface SocialAccountsResponse {
  accounts: SocialAccount[];
}

export interface LinkSocialAccountRequest {
  provider: 'google' | 'apple' | 'facebook';
  code: string;
  state: string;
}

export interface UnlinkSocialAccountRequest {
  provider: 'google' | 'apple' | 'facebook';
}

export interface SetPasswordRequest {
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
}

export interface VerifyEmailRequest {
  code: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

// ============================================================================
// Authentication Challenge System
// ============================================================================

export enum AuthChallenge {
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  VERIFY_PHONE = 'VERIFY_PHONE',
  VERIFY_EMAIL_AND_PHONE = 'VERIFY_EMAIL_AND_PHONE',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_SETUP_REQUIRED = 'MFA_SETUP_REQUIRED',
  FORCE_CHANGE_PASSWORD = 'FORCE_CHANGE_PASSWORD',
}

export interface AuthChallengeResponse {
  challengeName: AuthChallenge;
  session: string;
  challengeParameters?: Record<string, any>;
  userSub: string;
}

/**
 * Unified Auth Response that can be either:
 * - Successful authentication with tokens
 * - Challenge required for verification
 */
export interface UnifiedAuthResponse {
  // Success fields
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
  trusted?: boolean; // Whether the current device is already trusted
  deviceToken?: string; // Device token for trusted device feature (mobile apps only)
  // Challenge fields
  challengeName?: AuthChallenge;
  session?: string;
  challengeParameters?: Record<string, any>;
  userSub?: string;
}

// ============================================================================
// Challenge Response Types (Unified API)
// ============================================================================

/**
 * Base challenge response
 */
interface BaseChallengeResponse {
  session: string;
}

/**
 * Email verification response
 */
export interface VerifyEmailResponse extends BaseChallengeResponse {
  type: 'VERIFY_EMAIL';
  code: string;
}

/**
 * Phone collection response (first step)
 */
export interface CollectPhoneResponse extends BaseChallengeResponse {
  type: 'VERIFY_PHONE';
  phone: string;
}

/**
 * Phone verification response (second step)
 */
export interface VerifyPhoneResponse extends BaseChallengeResponse {
  type: 'VERIFY_PHONE';
  code: string;
}

/**
 * MFA verification with code (SMS/Email/TOTP/Backup)
 */
export interface VerifyMFACodeResponse extends BaseChallengeResponse {
  type: 'MFA_REQUIRED';
  method: 'sms' | 'email' | 'totp' | 'backup';
  code: string;
}

/**
 * MFA verification with passkey
 */
export interface VerifyMFAPasskeyResponse extends BaseChallengeResponse {
  type: 'MFA_REQUIRED';
  method: 'passkey';
  credential: Record<string, unknown>;
}

/**
 * Force password change response
 */
export interface ForceChangePasswordResponse extends BaseChallengeResponse {
  type: 'FORCE_CHANGE_PASSWORD';
  newPassword: string;
}

/**
 * MFA setup response
 */
export interface MFASetupResponse extends BaseChallengeResponse {
  type: 'MFA_SETUP_REQUIRED';
  method: 'sms' | 'email' | 'totp' | 'passkey';
  setupData: Record<string, unknown>;
}

/**
 * Discriminated union of all challenge response types
 */
export type ChallengeResponseData =
  | VerifyEmailResponse
  | CollectPhoneResponse
  | VerifyPhoneResponse
  | VerifyMFACodeResponse
  | VerifyMFAPasskeyResponse
  | ForceChangePasswordResponse
  | MFASetupResponse;
