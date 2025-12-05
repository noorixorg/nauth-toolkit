"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseUser = void 0;
/**
 * Base User Entity
 *
 * Core user authentication record with all fields and business logic.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
var BaseUser = /** @class */ (function () {
    function BaseUser() {
    }
    return BaseUser;
}());
exports.BaseUser = BaseUser;
