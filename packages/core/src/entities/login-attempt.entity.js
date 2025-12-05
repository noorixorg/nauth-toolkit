"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLoginAttempt = void 0;
/**
 * Base Login Attempt Entity
 *
 * Failed login tracking for security auditing and rate limiting.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
var BaseLoginAttempt = /** @class */ (function () {
    function BaseLoginAttempt() {
    }
    return BaseLoginAttempt;
}());
exports.BaseLoginAttempt = BaseLoginAttempt;
