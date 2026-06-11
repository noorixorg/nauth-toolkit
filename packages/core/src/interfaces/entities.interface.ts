/**
 * Entity Interface Contracts
 *
 * These interfaces define the shape of entities without importing concrete implementations.
 * Database packages must implement these interfaces to ensure type safety across the modular architecture.
 *
 * This allows core to maintain strict typing while entities live in separate packages.
 */

/**
 * User Entity Interface
 *
 * Core user authentication record
 */
export interface IUser {
  id: number;
  sub: string;
  email: string;
  username: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  passwordHistory: string[] | null;
  /**
   * Whether this user has a password set
   * Computed field - derived from passwordHash at runtime
   * Never expose passwordHash directly; use this boolean flag instead
   */
  hasPasswordHash?: boolean;
  /**
   * Authentication method used to create the CURRENT session.
   *
   * This is session-scoped state (how the user authenticated this time), not an account capability.
   * For account capabilities, use:
   * - `hasPasswordHash`
   * - `socialProviders`
   *
   * Common values:
   * - `password`
   * - `google`
   * - `apple`
   * - `facebook`
   */
  sessionAuthMethod?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  lockReason: string | null;
  lockedAt: Date | null;
  lockedUntil: Date | null;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  hasSocialAuth: boolean;
  socialProviders: string[] | null;
  mfaEnabled: boolean;
  mfaMethods: string[] | null;
  preferredMfaMethod: string | null;
  mfaExempt?: boolean;
  mfaExemptReason?: string | null;
  mfaExemptGrantedAt?: Date | null;
  mfaExemptGrantedBy?: string | null;
  backupCodes: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Session Entity Interface
 *
 * JWT session tracking
 */
export interface ISession {
  id: number;
  userId: number;
  accessTokenHash: string;
  refreshTokenHash: string;
  tokenFamily: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  ipCountry: string | null;
  ipCity: string | null;
  ipIsp: string | null;
  userAgent: string | null;
  platform: string | null;
  browser: string | null;
  authMethod: string | null;
  isTrustedDevice: boolean;
  expiresAt: Date;
  lastActivityAt: Date | null;
  isRevoked: boolean;
  revokedAt: Date | null;
  revokeReason: string | null;
  version: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Login Attempt Entity Interface
 *
 * Failed login tracking
 */
export interface ILoginAttempt {
  id: number;
  email: string | null;
  userId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  mfaRequired: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Verification Token Entity Interface
 *
 * Email/phone/password reset tokens
 */
export interface IVerificationToken {
  id: number;
  userId: number;
  challengeSessionId?: number | null;
  type: 'email' | 'phone' | 'password_reset';
  token: string;
  code: string | null;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  // Helper methods (if entity implements them)
  isExpired?: () => boolean;
  maxAttemptsExceeded?: (max: number) => boolean;
}

/**
 * Social Account Entity Interface
 *
 * OAuth provider linkage
 */
export interface ISocialAccount {
  id: number;
  userId: number;
  provider: string;
  providerId: string;
  providerEmail: string | null;
  linkedAt: Date;
  lastUsedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Challenge Session Entity Interface
 *
 * Temporary sessions for challenge-response flows
 */
export interface IChallengeSession {
  id: number;
  userId: number;
  user?: IUser; // Optional relation
  sessionToken: string;
  challengeName: string;
  challengeParameters: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  isCompleted?: boolean;
  completedAt?: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * MFA Device Entity Interface
 *
 * Multi-factor authentication device registrations
 */
import { MFADeviceMethod } from '../enums/mfa-method.enum';

export interface IMFADevice {
  id: number;
  userId: number;
  type: MFADeviceMethod;
  name: string;
  secret: string | null;
  credentialId: string | null;
  publicKey: string | null;
  counter: number | null;
  transports: string[] | null;
  phoneNumber?: string | null; // For SMS MFA
  email?: string | null; // For Email MFA
  isPrimary?: boolean; // Primary device flag
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * Authentication Audit Entity Interface
 *
 * Audit trail record for authentication and security events
 */
export interface IAuthAudit {
  id: number;
  userId: number;
  eventType: string;
  eventStatus: 'SUCCESS' | 'FAILURE' | 'INFO' | 'SUSPICIOUS';
  riskFactor?: number | null;
  riskFactors?: string[] | null; // Stored as string[] in DB, but should use RiskFactor enum values
  adaptiveMfaTriggered?: boolean | null;
  ipAddress?: string | null;
  ipCountry?: string | null;
  ipCity?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  browser?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  sessionId?: number | null;
  challengeSessionId?: number | null;
  authMethod?: string | null;
  performedBy?: string | null;
  reason?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}
