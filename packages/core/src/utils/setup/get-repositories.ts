/**
 * Repository Discovery Helper
 *
 * Discovers TypeORM repositories from DataSource metadata.
 * Supports both explicit entity names and table name matching.
 */

import { DataSource, EntityMetadata, Repository, ObjectLiteral } from 'typeorm';
import { NAuthException, AuthErrorCode } from '../../index';
import {
  BaseUser,
  BaseSession,
  BaseLoginAttempt,
  BaseVerificationToken,
  BaseSocialAccount,
  BaseChallengeSession,
  BaseMFADevice,
  BaseAuthAudit,
  BaseTrustedDevice,
  BaseRateLimit,
  BaseStorageLock,
  BaseSocialProviderSecret,
  BaseApiKey,
} from '../../entities';

/**
 * Get all required repositories from DataSource
 *
 * Auto-discovers entities by table name from DataSource metadata.
 * Falls back to entity name if table not found.
 *
 * @param dataSource - TypeORM DataSource
 * @returns Object containing all required repositories
 * @throws {NAuthException} If required entity not found
 */
export function getRepositories(dataSource: DataSource): {
  userRepository: Repository<BaseUser>;
  sessionRepository: Repository<BaseSession>;
  loginAttemptRepository: Repository<BaseLoginAttempt>;
  verificationTokenRepository: Repository<BaseVerificationToken>;
  socialAccountRepository: Repository<BaseSocialAccount>;
  challengeSessionRepository: Repository<BaseChallengeSession>;
  mfaDeviceRepository: Repository<BaseMFADevice>;
  authAuditRepository: Repository<BaseAuthAudit>;
  trustedDeviceRepository: Repository<BaseTrustedDevice> | null;
  rateLimitRepository: Repository<BaseRateLimit> | null;
  storageLockRepository: Repository<BaseStorageLock> | null;
  socialProviderSecretRepository: Repository<BaseSocialProviderSecret>;
  apiKeyRepository: Repository<BaseApiKey> | null;
} {
  return {
    userRepository: getRepository<BaseUser>(dataSource, 'User', 'nauth_users', true),
    sessionRepository: getRepository<BaseSession>(dataSource, 'Session', 'nauth_sessions', true),
    loginAttemptRepository: getRepository<BaseLoginAttempt>(dataSource, 'LoginAttempt', 'nauth_login_attempts', true),
    verificationTokenRepository: getRepository<BaseVerificationToken>(
      dataSource,
      'VerificationToken',
      'nauth_verification_tokens',
      true,
    ),
    socialAccountRepository: getRepository<BaseSocialAccount>(
      dataSource,
      'SocialAccount',
      'nauth_social_accounts',
      true,
    ),
    challengeSessionRepository: getRepository<BaseChallengeSession>(
      dataSource,
      'ChallengeSession',
      'nauth_challenge_sessions',
      true,
    ),
    mfaDeviceRepository: getRepository<BaseMFADevice>(dataSource, 'MFADevice', 'nauth_mfa_devices', true),
    authAuditRepository: getRepository<BaseAuthAudit>(dataSource, 'AuthAudit', 'nauth_auth_audit', true),
    // Optional repositories (may not exist if features disabled)
    trustedDeviceRepository: getRepository<BaseTrustedDevice>(
      dataSource,
      'TrustedDevice',
      'nauth_trusted_devices',
      false,
    ),
    rateLimitRepository: getRepository<BaseRateLimit>(dataSource, 'RateLimit', 'nauth_rate_limits', false),
    storageLockRepository: getRepository<BaseStorageLock>(dataSource, 'StorageLock', 'nauth_storage_locks', false),
    // Optional - only present when the API keys feature is enabled and the entity is registered
    apiKeyRepository: getRepository<BaseApiKey>(dataSource, 'ApiKey', 'nauth_api_keys', false),
    socialProviderSecretRepository: (() => {
      try {
        return getRepository<BaseSocialProviderSecret>(
          dataSource,
          'SocialProviderSecret',
          'nauth_social_provider_secrets',
          true, // Required for Apple JWT rotation
        );
      } catch {
        // If entity not found, log detailed error and rethrow
        const availableTables = dataSource.entityMetadatas.map((m) => m.tableName).join(', ');
        const availableNames = dataSource.entityMetadatas
          .map((m) => (typeof m.target === 'function' ? m.target.name : String(m.target)))
          .join(', ');
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          `SocialProviderSecret entity not found in DataSource. ` +
            `Expected table name: nauth_social_provider_secrets. ` +
            `Available tables: ${availableTables || 'none'}. ` +
            `Available entity names: ${availableNames || 'none'}. ` +
            `Total entities: ${dataSource.entityMetadatas.length}. ` +
            `Make sure SocialProviderSecret is included in getNAuthEntities() and passed to TypeORM.`,
        );
      }
    })(),
  };
}

/**
 * Get a single repository by entity name or table name
 *
 * @param dataSource - TypeORM DataSource
 * @param entityName - Entity class name (e.g., 'User')
 * @param tableName - Table name (e.g., 'nauth_users')
 * @param required - Whether entity is required (throw if not found)
 * @returns Repository or null if not found and not required
 * @throws {NAuthException} If required entity not found
 */
/* eslint-disable no-redeclare */
function getRepository<T extends ObjectLiteral>(
  dataSource: DataSource,
  entityName: string,
  tableName: string,
  required: true,
): Repository<T>;
function getRepository<T extends ObjectLiteral>(
  dataSource: DataSource,
  entityName: string,
  tableName: string,
  required: false,
): Repository<T> | null;
function getRepository<T extends ObjectLiteral>(
  dataSource: DataSource,
  entityName: string,
  tableName: string,
  required: boolean,
): Repository<T> | null {
  // Try to find by table name first (more reliable)
  const metadataByTable = dataSource.entityMetadatas.find((m: EntityMetadata) => m.tableName === tableName);

  if (metadataByTable) {
    return dataSource.getRepository<T>(metadataByTable.target);
  }

  // Fallback: Try to find by entity class name
  const metadataByName = dataSource.entityMetadatas.find(
    (m: EntityMetadata) => typeof m.target === 'function' && m.target.name === entityName,
  );

  if (metadataByName && typeof metadataByName.target === 'function') {
    return dataSource.getRepository<T>(metadataByName.target);
  }

  // Not found
  if (required) {
    // Debug: log available entities to help diagnose the issue
    const availableTables = dataSource.entityMetadatas.map((m) => m.tableName).join(', ');
    const availableNames = dataSource.entityMetadatas
      .map((m) => (typeof m.target === 'function' ? m.target.name : String(m.target)))
      .join(', ');
    throw new NAuthException(
      AuthErrorCode.VALIDATION_FAILED,
      `${entityName} entity not found in DataSource. ` +
        `Make sure entities are registered in DataSource configuration. ` +
        `Expected table name: ${tableName}. ` +
        `Available tables: ${availableTables || 'none'}. ` +
        `Available entity names: ${availableNames || 'none'}. ` +
        `Total entities registered: ${dataSource.entityMetadatas.length}.`,
    );
  }

  return null;
}
/* eslint-enable no-redeclare */
