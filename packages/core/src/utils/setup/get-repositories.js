"use strict";
/**
 * Repository Discovery Helper
 *
 * Discovers TypeORM repositories from DataSource metadata.
 * Supports both explicit entity names and table name matching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepositories = getRepositories;
var index_1 = require("../../index");
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
function getRepositories(dataSource) {
    return {
        userRepository: getRepository(dataSource, 'User', 'nauth_users', true),
        sessionRepository: getRepository(dataSource, 'Session', 'nauth_sessions', true),
        loginAttemptRepository: getRepository(dataSource, 'LoginAttempt', 'nauth_login_attempts', true),
        verificationTokenRepository: getRepository(dataSource, 'VerificationToken', 'nauth_verification_tokens', true),
        socialAccountRepository: getRepository(dataSource, 'SocialAccount', 'nauth_social_accounts', true),
        challengeSessionRepository: getRepository(dataSource, 'ChallengeSession', 'nauth_challenge_sessions', true),
        mfaDeviceRepository: getRepository(dataSource, 'MFADevice', 'nauth_mfa_devices', true),
        authAuditRepository: getRepository(dataSource, 'AuthAudit', 'nauth_auth_audit', true),
        // Optional repositories (may not exist if features disabled)
        trustedDeviceRepository: getRepository(dataSource, 'TrustedDevice', 'nauth_trusted_devices', false),
        rateLimitRepository: getRepository(dataSource, 'RateLimit', 'nauth_rate_limits', false),
        storageLockRepository: getRepository(dataSource, 'StorageLock', 'nauth_storage_locks', false),
    };
}
function getRepository(dataSource, entityName, tableName, required) {
    // Try to find by table name first (more reliable)
    var metadataByTable = dataSource.entityMetadatas.find(function (m) { return m.tableName === tableName; });
    if (metadataByTable) {
        return dataSource.getRepository(metadataByTable.target);
    }
    // Fallback: Try to find by entity class name
    var metadataByName = dataSource.entityMetadatas.find(function (m) { return typeof m.target === 'function' && m.target.name === entityName; });
    if (metadataByName && typeof metadataByName.target === 'function') {
        return dataSource.getRepository(metadataByName.target);
    }
    // Not found
    if (required) {
        throw new index_1.NAuthException(index_1.AuthErrorCode.VALIDATION_FAILED, "".concat(entityName, " entity not found in DataSource. ") +
            "Make sure entities are registered in DataSource configuration. " +
            "Expected table name: ".concat(tableName));
    }
    return null;
}
