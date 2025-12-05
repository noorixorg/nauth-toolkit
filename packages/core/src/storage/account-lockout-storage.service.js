"use strict";
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
exports.AccountLockoutStorageService = void 0;
/**
 * Account lockout storage implementation using StorageAdapter (Platform-Agnostic)
 *
 * SECURITY: Uses IP addresses instead of user identifiers to prevent
 * attackers from locking out legitimate users by guessing their email/username.
 */
var AccountLockoutStorageService = /** @class */ (function () {
    function AccountLockoutStorageService(storageAdapter) {
        this.storageAdapter = storageAdapter;
        this.keyPrefix = 'nauth:lockout:ip:';
        this.lockKeyPrefix = 'nauth:locked:ip:';
    }
    /**
     * Record failed login attempt for an IP address
     * @param ipAddress - IP address that made the failed attempt
     * @returns Number of failed attempts for this IP
     */
    AccountLockoutStorageService.prototype.recordFailedAttempt = function (ipAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var key;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = this.getKey(ipAddress);
                        return [4 /*yield*/, this.storageAdapter.incr(key)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get failed attempts count for an IP address
     * @param ipAddress - IP address to check
     * @returns Number of failed attempts
     */
    AccountLockoutStorageService.prototype.getFailedAttempts = function (ipAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var key, value;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = this.getKey(ipAddress);
                        return [4 /*yield*/, this.storageAdapter.get(key)];
                    case 1:
                        value = _a.sent();
                        return [2 /*return*/, value ? parseInt(value, 10) : 0];
                }
            });
        });
    };
    /**
     * Check if an IP address is locked out
     * @param ipAddress - IP address to check
     * @returns True if IP is locked out
     */
    AccountLockoutStorageService.prototype.isAccountLocked = function (ipAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var lockKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockKey = this.getLockKey(ipAddress);
                        return [4 /*yield*/, this.storageAdapter.exists(lockKey)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Lock an IP address for a specified duration
     * @param ipAddress - IP address to lock
     * @param duration - Lock duration in seconds
     * @param reason - Reason for lockout
     */
    AccountLockoutStorageService.prototype.blockIpAdresss = function (ipAddress, duration, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var lockKey, lockData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockKey = this.getLockKey(ipAddress);
                        lockData = JSON.stringify({
                            reason: reason,
                            lockedAt: new Date().toISOString(),
                            lockedUntil: new Date(Date.now() + duration * 1000).toISOString(),
                        });
                        return [4 /*yield*/, this.storageAdapter.set(lockKey, lockData, duration)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Unlock an IP address and reset failed attempts
     * @param ipAddress - IP address to unlock
     */
    AccountLockoutStorageService.prototype.unblockIPAdress = function (ipAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var lockKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockKey = this.getLockKey(ipAddress);
                        return [4 /*yield*/, this.storageAdapter.del(lockKey)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.resetFailedAttempts(ipAddress)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reset failed attempts counter for an IP address
     * @param ipAddress - IP address to reset
     */
    AccountLockoutStorageService.prototype.resetFailedAttempts = function (ipAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var key;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = this.getKey(ipAddress);
                        return [4 /*yield*/, this.storageAdapter.del(key)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AccountLockoutStorageService.prototype.getKey = function (ipAddress) {
        return "".concat(this.keyPrefix).concat(ipAddress);
    };
    AccountLockoutStorageService.prototype.getLockKey = function (ipAddress) {
        return "".concat(this.lockKeyPrefix).concat(ipAddress);
    };
    return AccountLockoutStorageService;
}());
exports.AccountLockoutStorageService = AccountLockoutStorageService;
