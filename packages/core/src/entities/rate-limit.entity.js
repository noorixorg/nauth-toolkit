"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRateLimit = void 0;
/**
 * Base Rate Limit Entity
 *
 * Stores rate limiting counters for transient state management.
 * Used by DatabaseStorageAdapter to track rate limits across multiple servers.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
var BaseRateLimit = /** @class */ (function () {
    function BaseRateLimit() {
    }
    return BaseRateLimit;
}());
exports.BaseRateLimit = BaseRateLimit;
