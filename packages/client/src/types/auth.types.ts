/**
 * Authentication challenge types returned by the backend.
 */
export enum AuthChallenge {
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  VERIFY_PHONE = 'VERIFY_PHONE',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_SETUP_REQUIRED = 'MFA_SETUP_REQUIRED',
  FORCE_CHANGE_PASSWORD = 'FORCE_CHANGE_PASSWORD',
}

/**
 * Auth response returned by backend for all auth operations.
 * Either contains tokens/user or a challenge to complete.
 */
import { MFAMethod, MFAChallengeMethod } from './mfa.types';

export interface AuthResponse {
  user?: AuthUserSummary;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
  /**
   * Authentication method used to create the current session.
   *
   * Examples:
   * - `password`
   * - `google`
   * - `apple`
   * - `facebook`
   */
  authMethod?: string;
  trusted?: boolean;
  deviceToken?: string;
  challengeName?: AuthChallenge;
  session?: string;
  challengeParameters?: Record<string, unknown>;
  sub?: string;
}

/**
 * Minimal user information returned inside auth responses.
 */
export interface AuthUserSummary {
  sub: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified?: boolean;
  socialProviders?: string[] | null;
  hasPasswordHash?: boolean;
}

/**
 * Token response returned by refresh endpoint.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

/**
 * Signup request payload.
 */
export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Login request payload.
 */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/**
 * Logout request payload.
 */
export interface LogoutRequest {
  forgetMe?: boolean;
}

/**
 * Logout all sessions request payload.
 */
export interface LogoutAllRequest {
  /**
   * Whether to also revoke all trusted devices
   * Default: false (devices remain trusted)
   */
  forgetDevices?: boolean;
}

/**
 * Resend code request payload.
 */
export interface ResendCodeRequest {
  session: string;
}

/**
 * MFA setup data request payload during challenge flows.
 */
export interface GetSetupDataRequest {
  session: string;
  method: MFAMethod;
}

/**
 * Challenge data request payload (e.g., passkey options).
 */
export interface GetChallengeDataRequest {
  session: string;
  method: MFAChallengeMethod;
}

/**
 * Unified challenge response discriminated union.
 */
export type ChallengeResponse =
  | VerifyEmailResponse
  | VerifyPhoneCollectResponse
  | VerifyPhoneCodeResponse
  | MFACodeResponse
  | MFAPasskeyResponse
  | MFASetupResponse
  | ForceChangePasswordResponse;

/**
 * Base challenge response shape.
 */
export interface BaseChallengeResponse {
  session: string;
}

export interface VerifyEmailResponse extends BaseChallengeResponse {
  type: AuthChallenge.VERIFY_EMAIL;
  code: string;
}

export interface VerifyPhoneCollectResponse extends BaseChallengeResponse {
  type: AuthChallenge.VERIFY_PHONE;
  phone: string;
}

export interface VerifyPhoneCodeResponse extends BaseChallengeResponse {
  type: AuthChallenge.VERIFY_PHONE;
  code: string;
}

export interface MFACodeResponse extends BaseChallengeResponse {
  type: AuthChallenge.MFA_REQUIRED;
  method: MFAMethod;
  code: string;
}

export interface MFAPasskeyResponse extends BaseChallengeResponse {
  type: AuthChallenge.MFA_REQUIRED;
  method: 'passkey';
  credential: Record<string, unknown>;
}

export interface MFASetupResponse extends BaseChallengeResponse {
  type: AuthChallenge.MFA_SETUP_REQUIRED;
  method: MFAMethod;
  setupData: Record<string, unknown>;
}

export interface ForceChangePasswordResponse extends BaseChallengeResponse {
  type: AuthChallenge.FORCE_CHANGE_PASSWORD;
  newPassword: string;
}

// MFAMethod and MFAChallengeMethod are imported from mfa.types
