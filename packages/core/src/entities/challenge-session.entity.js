"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseChallengeSession = void 0;
/**
 * Base Challenge Session Entity
 *
 * Stores temporary authentication challenge sessions.
 * These are short-lived sessions used to track pending challenges
 * that must be completed before full authentication is granted.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * Similar to AWS Cognito's challenge sessions, these are NOT full JWT tokens.
 * They expire quickly (typically 15 minutes) and are deleted after completion.
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * @example
 * ```typescript
 * // Creating a challenge session after signup
 * const challengeSession = new ChallengeSession();
 * challengeSession.userId = user.id;
 * challengeSession.challengeName = 'VERIFY_EMAIL';
 * challengeSession.sessionToken = randomUUID();
 * challengeSession.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
 * challengeSession.metadata = { email: user.email };
 * ```
 */
var BaseChallengeSession = /** @class */ (function () {
    function BaseChallengeSession() {
    }
    return BaseChallengeSession;
}());
exports.BaseChallengeSession = BaseChallengeSession;
