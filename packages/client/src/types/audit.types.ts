/**
 * Audit event types.
 */
export enum AuthAuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_REVOKED = 'TOKEN_REVOKED',

  // Registration events
  SIGNUP_SUCCESS = 'SIGNUP_SUCCESS',
  SIGNUP_FAILED = 'SIGNUP_FAILED',

  // Verification events
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  PHONE_VERIFIED = 'PHONE_VERIFIED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',

  // MFA events
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFIED = 'MFA_VERIFIED',
  MFA_FAILED = 'MFA_FAILED',
  MFA_BACKUP_CODE_USED = 'MFA_BACKUP_CODE_USED',

  // Password events
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',

  // Security events
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ADAPTIVE_MFA_TRIGGERED = 'ADAPTIVE_MFA_TRIGGERED',

  // Social auth events
  SOCIAL_LINK_SUCCESS = 'SOCIAL_LINK_SUCCESS',
  SOCIAL_LINK_FAILED = 'SOCIAL_LINK_FAILED',
  SOCIAL_UNLINK = 'SOCIAL_UNLINK',
}

/**
 * Audit event status.
 */
export type AuthAuditEventStatus = 'SUCCESS' | 'FAILURE' | 'INFO' | 'SUSPICIOUS';

/**
 * Individual audit event record.
 */
export interface AuthAuditEvent {
  id: number;
  userId: number;
  eventType: AuthAuditEventType;
  eventStatus: AuthAuditEventStatus;
  riskFactor?: number | null;
  riskFactors?: string[] | null;
  adaptiveMfaTriggered?: boolean | null;
  ipAddress?: string | null;
  ipCountry?: string | null;
  ipCity?: string | null;
  ipLatitude?: number | null;
  ipLongitude?: number | null;
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
  createdAt: string | Date;
}

/**
 * Paginated audit history response.
 */
export interface AuditHistoryResponse {
  data: AuthAuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
