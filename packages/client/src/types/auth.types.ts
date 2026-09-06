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
  /**
   * Optional reCAPTCHA token for bot protection.
   * - v2: Token from visible checkbox challenge
   * - v3: Token from invisible/automatic challenge
   * - If required by server but not provided, request will fail with RECAPTCHA_REQUIRED error
   */
  recaptchaToken?: string;
}

/**
 * Login request payload.
 */
export interface LoginRequest {
  identifier: string;
  password: string;
  /**
   * Optional reCAPTCHA token for bot protection.
   * - v2: Token from visible checkbox challenge
   * - v3: Token from invisible/automatic challenge
   * - If required by server but not provided, request will fail with RECAPTCHA_REQUIRED error
   */
  recaptchaToken?: string;
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
  deviceId?: number;
}

export interface MFAPasskeyResponse extends BaseChallengeResponse {
  type: AuthChallenge.MFA_REQUIRED;
  method: 'passkey';
  credential: Record<string, unknown>;
  deviceId?: number;
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

/**
 * Response from revoking a single session.
 */
export interface LogoutSessionResponse {
  /** Whether the session was revoked */
  success: boolean;
  /**
   * Whether the revoked session was the one making the request.
   *
   * When true the caller has just signed itself out, so the local auth state should be
   * cleared rather than left pointing at a session the server no longer honours.
   */
  wasCurrentSession: boolean;
}

/**
 * Response from checking whether the current user may set a first password.
 */
export interface CanSetPasswordResponse {
  /** True for a social-only account that has no password yet */
  canSetPassword: boolean;
}

/**
 * Response from setting a first password on a social-only account.
 */
export interface SetPasswordResponse {
  /** Human-readable confirmation message */
  message: string;
}

/**
 * Response listing the MFA methods this deployment permits.
 */
export interface AvailableMfaMethodsResponse {
  /**
   * Method names that are registered and allowed by configuration, whether or not the
   * caller has enrolled them.
   */
  availableMethods: string[];
}

/**
 * A trusted device that may skip MFA, without any token material.
 */
export interface TrustedDeviceInfo {
  /** Record id. Identifies the device when revoking it. */
  id: number;
  /** Client-supplied device identifier, when the client sends one. */
  deviceId?: string | null;
  /** Human-readable device label. */
  deviceName?: string | null;
  /** Device form factor (e.g. `mobile`, `desktop`). */
  deviceType?: string | null;
  /** IP address the device was trusted from. */
  ipAddress?: string | null;
  /** Operating system reported by the device. */
  platform?: string | null;
  /** Browser reported by the device. */
  browser?: string | null;
  /** ISO timestamp at which the trust expires. */
  trustedUntil: string | Date;
  /** ISO timestamp of last use, or null if unused since being trusted. */
  lastUsedAt?: string | Date | null;
  /** ISO timestamp at which the device was trusted. */
  createdAt: string | Date;
}

/**
 * Response listing trusted devices.
 */
export interface ListTrustedDevicesResponse {
  /** Unexpired trusted devices, most recently used first. */
  trustedDevices: TrustedDeviceInfo[];
}

/**
 * Response from revoking a single trusted device.
 */
export interface RevokeTrustedDeviceResponse {
  /** Whether a matching device was found and revoked. */
  success: boolean;
}

/**
 * Response from revoking every trusted device.
 */
export interface RevokeAllTrustedDevicesResponse {
  /** How many devices were revoked. */
  revokedCount: number;
}
