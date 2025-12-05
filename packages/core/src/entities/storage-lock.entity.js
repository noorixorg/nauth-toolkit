"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStorageLock = void 0;
/**
 * Base Storage Lock Entity
 *
 * Stores distributed locks for transient state management.
 * Used by DatabaseStorageAdapter for token refresh locks and other distributed operations.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
var BaseStorageLock = /** @class */ (function () {
    function BaseStorageLock() {
    }
    return BaseStorageLock;
}());
exports.BaseStorageLock = BaseStorageLock;
