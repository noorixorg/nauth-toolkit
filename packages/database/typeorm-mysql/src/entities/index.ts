export * from './user.entity';
export * from './session.entity';
export * from './login-attempt.entity';
export * from './verification-token.entity';
export * from './social-account.entity';
export * from './challenge-session.entity';
export * from './mfa-device.entity';
export * from './auth-audit.entity';
export * from './trusted-device.entity';
export * from './rate-limit.entity';
export * from './storage-lock.entity';
export * from './social-provider-secret.entity';

// Import all entities for the helper function
import { User } from './user.entity';
import { Session } from './session.entity';
import { LoginAttempt } from './login-attempt.entity';
import { VerificationToken } from './verification-token.entity';
import { SocialAccount } from './social-account.entity';
import { ChallengeSession } from './challenge-session.entity';
import { MFADevice } from './mfa-device.entity';
import { AuthAudit } from './auth-audit.entity';
import { TrustedDevice } from './trusted-device.entity';
import { RateLimit } from './rate-limit.entity';
import { StorageLock } from './storage-lock.entity';
import { SocialProviderSecret } from './social-provider-secret.entity';

/**
 * Get all nauth-toolkit entities for TypeORM configuration (MySQL)
 *
 * Consumer apps should use this helper function instead of importing entities directly.
 * This ensures entities remain encapsulated and prevents direct database access.
 *
 * @returns Array of all nauth-toolkit entity classes
 *
 * @example
 * ```typescript
 * import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';
 *
 * TypeOrmModule.forRoot({
 *   type: 'mysql',
 *   entities: getNAuthEntities(),
 *   // ... other config
 * })
 * ```
 */
/**
 * Get all nauth-toolkit entities for TypeORM configuration (excluding storage entities)
 *
 * **Storage Entities:** Storage entities (RateLimit, StorageLock) are NOT included here.
 * Only include them if using DatabaseStorageAdapter. Use `getNAuthTransientStorageEntities()` to add them.
 *
 * @returns Array of nauth-toolkit entity classes (excluding storage entities)
 *
 * @example
 * ```typescript
 * import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-mysql';
 *
 * // Using Memory or Redis adapter - no storage entities needed
 * TypeOrmModule.forRoot({
 *   entities: getNAuthEntities(),
 * });
 *
 * // Using DatabaseStorageAdapter - include storage entities
 * TypeOrmModule.forRoot({
 *   entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
 * });
 * ```
 */
export function getNAuthEntities(): Function[] {
  return [
    User,
    Session,
    LoginAttempt,
    VerificationToken,
    SocialAccount,
    ChallengeSession,
    MFADevice,
    AuthAudit,
    TrustedDevice,
    SocialProviderSecret,
  ];
}

/**
 * Get storage entities for DatabaseStorageAdapter
 *
 * Only include these entities when using DatabaseStorageAdapter.
 * If using Memory or Redis adapters, these entities are not needed.
 *
 * @returns Array of storage entity classes (RateLimit, StorageLock)
 *
 * @example
 * ```typescript
 * import { getNAuthEntities, getNAuthTransientStorageEntities } from '@nauth-toolkit/database-typeorm-mysql';
 * import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
 *
 * TypeOrmModule.forRoot({
 *   entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()],
 * });
 *
 * AuthModule.forRoot({
 *   storageAdapter: new DatabaseStorageAdapter(),
 * });
 * ```
 */
export function getNAuthTransientStorageEntities(): Function[] {
  return [RateLimit, StorageLock];
}
