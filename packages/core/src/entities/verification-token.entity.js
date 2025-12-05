"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseVerificationToken = void 0;
/**
 * Base Verification Token Entity
 *
 * Stores email/phone verification codes and password reset tokens.
 * Supports multiple verification types with expiry and attempt tracking.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
var BaseVerificationToken = /** @class */ (function () {
    function BaseVerificationToken() {
    }
    /**
     * Check if token is expired
     *
     * @returns true if token is expired
     *
     * @example
     * ```typescript
     * if (token.isExpired()) {
     *   throw new Error('Verification code has expired');
     * }
     * ```
     */
    BaseVerificationToken.prototype.isExpired = function () {
        return new Date() > this.expiresAt;
    };
    /**
     * Check if token has been used
     *
     * @returns true if token has been used
     *
     * @example
     * ```typescript
     * if (token.isUsed()) {
     *   throw new Error('Verification code has already been used');
     * }
     * ```
     */
    BaseVerificationToken.prototype.isUsed = function () {
        return this.usedAt !== null && this.usedAt !== undefined;
    };
    /**
     * Check if max attempts exceeded
     *
     * @param maxAttempts - Maximum allowed attempts
     * @returns true if max attempts exceeded
     *
     * @example
     * ```typescript
     * if (token.maxAttemptsExceeded(3)) {
     *   throw new Error('Too many failed attempts');
     * }
     * ```
     */
    BaseVerificationToken.prototype.maxAttemptsExceeded = function (maxAttempts) {
        return this.attempts >= maxAttempts;
    };
    return BaseVerificationToken;
}());
exports.BaseVerificationToken = BaseVerificationToken;
