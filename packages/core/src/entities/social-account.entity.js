"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSocialAccount = void 0;
/**
 * Base Social Account Entity
 *
 * Stores OAuth provider linkage (no token storage, one-time attribute import).
 * Each record represents a user's account linked to a specific social provider.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * @example
 * ```typescript
 * // User has Google and Apple accounts linked
 * const socialAccounts = [
 *   { provider: 'google', providerId: 'google_123', providerEmail: 'user@gmail.com' },
 *   { provider: 'apple', providerId: 'apple_456', providerEmail: 'user@icloud.com' }
 * ];
 * ```
 */
var BaseSocialAccount = /** @class */ (function () {
    function BaseSocialAccount() {
    }
    return BaseSocialAccount;
}());
exports.BaseSocialAccount = BaseSocialAccount;
