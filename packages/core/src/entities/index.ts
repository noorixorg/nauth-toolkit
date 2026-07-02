/**
 * Base Entity Classes
 *
 * Database-agnostic entity classes containing all fields and business logic.
 * Database adapters (TypeORM, Prisma, etc.) extend these classes and add ORM-specific decorators.
 *
 * @remarks
 * These base classes provide:
 * - Field definitions
 * - Business logic methods
 * - JSDoc documentation
 * - Type safety
 *
 * Database packages add:
 * - ORM decorators (@Entity, @Column, etc.)
 * - Database-specific configuration
 * - Indexes and constraints
 */
export { BaseUser } from './user.entity';
export { BaseSession } from './session.entity';
export { BaseTrustedDevice } from './trusted-device.entity';
export { BaseLoginAttempt } from './login-attempt.entity';
export { BaseVerificationToken } from './verification-token.entity';
export { BaseSocialAccount } from './social-account.entity';
export { BaseChallengeSession } from './challenge-session.entity';
export { BaseMFADevice } from './mfa-device.entity';
export { BaseAuthAudit, type AuthAuditEventStatus } from './auth-audit.entity';
export { BaseRateLimit } from './rate-limit.entity';
export { BaseStorageLock } from './storage-lock.entity';
export { BaseSocialProviderSecret } from './social-provider-secret.entity';
export { BaseApiKey } from './api-key.entity';
