"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAuthAudit = void 0;
/**
 * Base Authentication Audit Entity
 *
 * Core audit record with all fields and business logic.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * **Design Notes:**
 * - Only stores `userId` (integer internal ID) - no `userSub` duplication
 * - Risk tracking fields are infrastructure for future adaptive MFA (no business logic)
 * - All audit integrations are non-blocking (errors logged, don't throw)
 */
var BaseAuthAudit = /** @class */ (function () {
    function BaseAuthAudit() {
    }
    return BaseAuthAudit;
}());
exports.BaseAuthAudit = BaseAuthAudit;
