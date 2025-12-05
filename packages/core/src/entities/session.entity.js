"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSession = void 0;
/**
 * Base Session Entity
 *
 * JWT session tracking with device information and security features.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
var BaseSession = /** @class */ (function () {
    function BaseSession() {
    }
    return BaseSession;
}());
exports.BaseSession = BaseSession;
