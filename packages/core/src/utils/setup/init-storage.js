"use strict";
/**
 * Storage Adapter Initialization Helper
 *
 * Initializes storage adapter with repository injection and proper error handling.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initStorage = initStorage;
var index_1 = require("../../index");
/**
 * Initialize storage adapter
 *
 * Handles:
 * - Logger injection (if adapter supports it)
 * - Repository injection (for DatabaseStorageAdapter)
 * - Adapter initialization
 * - Fallback to DatabaseStorageAdapter if no adapter provided and repositories available
 * - Error if no adapter and no repositories (prevents unsafe defaults)
 *
 * @param config - NAuth configuration
 * @param rateLimitRepo - RateLimit repository (nullable)
 * @param storageLockRepo - StorageLock repository (nullable)
 * @param logger - Logger instance
 * @returns Initialized StorageAdapter
 * @throws {NAuthException} If no adapter provided and DatabaseStorageAdapter cannot be created
 */
function initStorage(config, rateLimitRepo, storageLockRepo, logger) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter, DatabaseStorageAdapter, adapter, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!config.storageAdapter) return [3 /*break*/, 2];
                    adapter = config.storageAdapter;
                    // Inject logger if adapter supports it
                    if (adapter && typeof adapter.setLogger === 'function') {
                        adapter.setLogger(logger);
                    }
                    // Inject repositories into DatabaseStorageAdapter if it supports it
                    if (adapter && typeof adapter.setRepositories === 'function') {
                        if (rateLimitRepo && storageLockRepo) {
                            adapter.setRepositories(rateLimitRepo, storageLockRepo);
                        }
                    }
                    return [4 /*yield*/, adapter.initialize()];
                case 1:
                    _c.sent();
                    return [2 /*return*/, adapter];
                case 2:
                    if (!(rateLimitRepo && storageLockRepo)) return [3 /*break*/, 7];
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 6, , 7]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/storage-database'); })];
                case 4:
                    DatabaseStorageAdapter = (_c.sent()).DatabaseStorageAdapter;
                    adapter = new DatabaseStorageAdapter(null, null, logger);
                    adapter.setRepositories(rateLimitRepo, storageLockRepo);
                    return [4 /*yield*/, adapter.initialize()];
                case 5:
                    _c.sent();
                    (_a = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _a === void 0 ? void 0 : _a.call(logger, 'WARNING: Storage adapter not provided. Using DatabaseStorageAdapter as default. ' +
                        'For production, explicitly configure storageAdapter in your config.');
                    return [2 /*return*/, adapter];
                case 6:
                    error_1 = _c.sent();
                    // If DatabaseStorageAdapter import fails, fall through to error
                    (_b = logger === null || logger === void 0 ? void 0 : logger.error) === null || _b === void 0 ? void 0 : _b.call(logger, 'Failed to create DatabaseStorageAdapter. Please explicitly configure storageAdapter in your config.', { error: error_1 });
                    return [3 /*break*/, 7];
                case 7: 
                // No storage adapter provided and no repositories available - REQUIRE explicit configuration
                throw new index_1.NAuthException(index_1.AuthErrorCode.VALIDATION_FAILED, 'Storage adapter is REQUIRED for production deployments. ' +
                    'MemoryStorageAdapter is NOT safe for production (data lost on restart, not shared across instances). ' +
                    'Please configure storageAdapter in your NAuthConfig:\n\n' +
                    'Option 1: DatabaseStorageAdapter (recommended if you have a database)\n' +
                    '  import { createDatabaseStorageAdapter } from "@nauth-toolkit/express";\n' +
                    '  storageAdapter: createDatabaseStorageAdapter()\n\n' +
                    'Option 2: RedisStorageAdapter (for high-performance multi-server deployments)\n' +
                    '  import { createRedisStorageAdapter } from "@nauth-toolkit/express";\n' +
                    '  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL)\n\n' +
                    'Make sure to include storage entities in your DataSource configuration:\n' +
                    '  import { getNAuthStorageEntities } from "@nauth-toolkit/database-typeorm-postgres";\n' +
                    '  entities: [...getNAuthEntities(), ...getNAuthStorageEntities()]');
            }
        });
    });
}
