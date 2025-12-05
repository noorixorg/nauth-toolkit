"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStorageLock = exports.BaseRateLimit = exports.BaseAuthAudit = exports.BaseMFADevice = exports.BaseChallengeSession = exports.BaseSocialAccount = exports.BaseVerificationToken = exports.BaseLoginAttempt = exports.BaseTrustedDevice = exports.BaseSession = exports.BaseUser = void 0;
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
var user_entity_1 = require("./user.entity");
Object.defineProperty(exports, "BaseUser", { enumerable: true, get: function () { return user_entity_1.BaseUser; } });
var session_entity_1 = require("./session.entity");
Object.defineProperty(exports, "BaseSession", { enumerable: true, get: function () { return session_entity_1.BaseSession; } });
var trusted_device_entity_1 = require("./trusted-device.entity");
Object.defineProperty(exports, "BaseTrustedDevice", { enumerable: true, get: function () { return trusted_device_entity_1.BaseTrustedDevice; } });
var login_attempt_entity_1 = require("./login-attempt.entity");
Object.defineProperty(exports, "BaseLoginAttempt", { enumerable: true, get: function () { return login_attempt_entity_1.BaseLoginAttempt; } });
var verification_token_entity_1 = require("./verification-token.entity");
Object.defineProperty(exports, "BaseVerificationToken", { enumerable: true, get: function () { return verification_token_entity_1.BaseVerificationToken; } });
var social_account_entity_1 = require("./social-account.entity");
Object.defineProperty(exports, "BaseSocialAccount", { enumerable: true, get: function () { return social_account_entity_1.BaseSocialAccount; } });
var challenge_session_entity_1 = require("./challenge-session.entity");
Object.defineProperty(exports, "BaseChallengeSession", { enumerable: true, get: function () { return challenge_session_entity_1.BaseChallengeSession; } });
var mfa_device_entity_1 = require("./mfa-device.entity");
Object.defineProperty(exports, "BaseMFADevice", { enumerable: true, get: function () { return mfa_device_entity_1.BaseMFADevice; } });
var auth_audit_entity_1 = require("./auth-audit.entity");
Object.defineProperty(exports, "BaseAuthAudit", { enumerable: true, get: function () { return auth_audit_entity_1.BaseAuthAudit; } });
var rate_limit_entity_1 = require("./rate-limit.entity");
Object.defineProperty(exports, "BaseRateLimit", { enumerable: true, get: function () { return rate_limit_entity_1.BaseRateLimit; } });
var storage_lock_entity_1 = require("./storage-lock.entity");
Object.defineProperty(exports, "BaseStorageLock", { enumerable: true, get: function () { return storage_lock_entity_1.BaseStorageLock; } });
