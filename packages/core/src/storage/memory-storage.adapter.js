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
exports.MemoryStorageAdapter = void 0;
/**
 * In-memory storage adapter for development and single-server deployments
 *
 * ⚠️ CRITICAL LIMITATIONS FOR PRODUCTION:
 * - Data is lost on server restart
 * - Data is NOT shared across multiple server instances/containers
 * - Rate limiting may be bypassed in ECS/multi-container deployments
 * - NOT suitable for production clusters with multiple containers
 *
 * RECOMMENDATIONS:
 * - Single ECS task: Acceptable (data lost on restart)
 * - Multi-task/container ECS: Use Redis adapter (coming soon)
 * - Production: Plan to implement Redis-backed storage adapter
 *
 * CURRENT BEHAVIOR:
 * Rate limiting works per-container, not globally across containers
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorageAdapter();
 * await storage.initialize();
 * await storage.set('key', 'value', 60); // Set with 60 second TTL
 * const value = await storage.get('key');
 * ```
 */
var MemoryStorageAdapter = /** @class */ (function () {
    function MemoryStorageAdapter() {
        // Main key-value store with expiration support
        this.store = new Map();
        // Hash storage for complex data structures (similar to Redis hashes)
        this.hashes = new Map();
        // List storage for ordered collections (similar to Redis lists)
        this.lists = new Map();
        // Interval timer for automatic cleanup of expired keys
        this.cleanupInterval = null;
    }
    /**
     * Initialize the storage adapter
     * Starts a background cleanup job to remove expired keys
     */
    MemoryStorageAdapter.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                // Start cleanup interval to remove expired keys every minute
                this.cleanupInterval = setInterval(function () {
                    _this.cleanupExpired();
                }, 60000); // 60,000ms = 1 minute
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if the storage adapter is healthy and operational
     * @returns Always returns true for in-memory storage
     */
    MemoryStorageAdapter.prototype.isHealthy = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, true];
            });
        });
    };
    // ============================================================================
    // Basic Key-Value Operations
    // ============================================================================
    /**
     * Get a value by key
     * Automatically removes and returns null if the key has expired
     *
     * @param key - The key to retrieve
     * @returns The stored value or null if not found/expired
     */
    MemoryStorageAdapter.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var stored;
            return __generator(this, function (_a) {
                stored = this.store.get(key);
                // Key doesn't exist
                if (!stored)
                    return [2 /*return*/, null];
                // Check if key has expired
                if (stored.expiresAt && stored.expiresAt < Date.now()) {
                    this.store.delete(key); // Clean up expired key
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, stored.value];
            });
        });
    };
    /**
     * Set a key-value pair with optional TTL (time to live)
     *
     * @param key - The key to store
     * @param value - The value to store
     * @param ttl - Time to live in seconds (optional)
     */
    MemoryStorageAdapter.prototype.set = function (key, value, ttlSeconds, options) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, stored;
            return __generator(this, function (_a) {
                // For NX option, check if key exists and is not expired
                if (options === null || options === void 0 ? void 0 : options.nx) {
                    existing = this.store.get(key);
                    if (existing) {
                        // Check if existing key is expired
                        if (existing.expiresAt && existing.expiresAt < Date.now()) {
                            // Key exists but is expired - treat as non-existent and allow set
                            this.store.delete(key);
                        }
                        else {
                            // Key exists and is not expired - NX failed
                            return [2 /*return*/, null];
                        }
                    }
                }
                stored = { value: value };
                // If TTL is provided, calculate expiration timestamp
                if (ttlSeconds) {
                    stored.expiresAt = Date.now() + ttlSeconds * 1000; // Convert seconds to milliseconds
                }
                this.store.set(key, stored);
                return [2 /*return*/, value];
            });
        });
    };
    /**
     * Delete a key from storage
     * @param key - The key to delete
     */
    MemoryStorageAdapter.prototype.del = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.store.delete(key);
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if a key exists and is not expired
     * @param key - The key to check
     * @returns True if key exists and is valid, false otherwise
     */
    MemoryStorageAdapter.prototype.exists = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var value;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.get(key)];
                    case 1:
                        value = _a.sent();
                        return [2 /*return*/, value !== null];
                }
            });
        });
    };
    // ============================================================================
    // Atomic Operations (for counters and rate limiting)
    // ============================================================================
    /**
     * Increment a counter stored at key
     * If the key doesn't exist, it's initialized to 0 before incrementing
     * Preserves TTL if the key already exists with an expiration
     *
     * @param key - The key to increment
     * @param ttlSeconds - Optional TTL in seconds to set when creating a new key (only applied if key doesn't exist)
     * @returns The new value after incrementing
     */
    MemoryStorageAdapter.prototype.incr = function (key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function () {
            var stored, currentValue, existingExpiry, wasNewKey, newValue, newStored;
            return __generator(this, function (_a) {
                stored = this.store.get(key);
                currentValue = '0';
                wasNewKey = !stored || (stored.expiresAt && stored.expiresAt < Date.now());
                if (stored) {
                    if (stored.expiresAt && stored.expiresAt < Date.now()) {
                        // Key expired - treat as non-existent
                        this.store.delete(key);
                    }
                    else {
                        // Key exists and is valid - preserve expiry
                        currentValue = stored.value;
                        existingExpiry = stored.expiresAt;
                    }
                }
                newValue = (parseInt(currentValue || '0', 10) + 1).toString();
                newStored = { value: newValue };
                // Use provided TTL for new keys, otherwise preserve existing expiry
                if (wasNewKey && ttlSeconds !== undefined) {
                    newStored.expiresAt = Date.now() + ttlSeconds * 1000;
                }
                else if (existingExpiry) {
                    newStored.expiresAt = existingExpiry;
                }
                this.store.set(key, newStored);
                return [2 /*return*/, parseInt(newValue, 10)];
            });
        });
    };
    /**
     * Decrement a counter stored at key
     * If the key doesn't exist, it's initialized to 0 before decrementing
     *
     * @param key - The key to decrement
     * @returns The new value after decrementing
     */
    MemoryStorageAdapter.prototype.decr = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var current, newValue;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.get(key)];
                    case 1:
                        current = _a.sent();
                        newValue = (parseInt(current || '0', 10) - 1).toString();
                        return [4 /*yield*/, this.set(key, newValue)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, parseInt(newValue, 10)];
                }
            });
        });
    };
    /**
     * Set expiration time on an existing key
     * @param key - The key to set expiration on
     * @param ttl - Time to live in seconds
     */
    MemoryStorageAdapter.prototype.expire = function (key, ttl) {
        return __awaiter(this, void 0, void 0, function () {
            var stored;
            return __generator(this, function (_a) {
                stored = this.store.get(key);
                if (stored) {
                    stored.expiresAt = Date.now() + ttl * 1000; // Convert to milliseconds
                    this.store.set(key, stored);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get the time to live (TTL) for a key
     * @param key - The key to check
     * @returns Seconds until expiration, -1 if no expiration, -2 if key doesn't exist
     */
    MemoryStorageAdapter.prototype.ttl = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var stored, remaining;
            return __generator(this, function (_a) {
                stored = this.store.get(key);
                // Key doesn't exist
                if (!stored)
                    return [2 /*return*/, -2];
                // Key exists but has no expiration
                if (!stored.expiresAt)
                    return [2 /*return*/, -1];
                remaining = Math.floor((stored.expiresAt - Date.now()) / 1000);
                return [2 /*return*/, remaining > 0 ? remaining : -2]; // Return -2 if already expired
            });
        });
    };
    // ============================================================================
    // Hash Operations (for complex data structures)
    // ============================================================================
    /**
     * Get a field value from a hash
     * @param key - Hash key
     * @param field - Field name
     * @returns Field value or null if not found
     */
    MemoryStorageAdapter.prototype.hget = function (key, field) {
        return __awaiter(this, void 0, void 0, function () {
            var hash;
            var _a;
            return __generator(this, function (_b) {
                hash = this.hashes.get(key);
                return [2 /*return*/, (_a = hash === null || hash === void 0 ? void 0 : hash.get(field)) !== null && _a !== void 0 ? _a : null];
            });
        });
    };
    /**
     * Set a field value in a hash
     * @param key - Hash key
     * @param field - Field name
     * @param value - Field value
     */
    MemoryStorageAdapter.prototype.hset = function (key, field, value) {
        return __awaiter(this, void 0, void 0, function () {
            var hash;
            return __generator(this, function (_a) {
                hash = this.hashes.get(key);
                if (!hash) {
                    hash = new Map();
                    this.hashes.set(key, hash);
                }
                hash.set(field, value);
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get all fields and values from a hash
     * @param key - Hash key
     * @returns Object with all field-value pairs
     */
    MemoryStorageAdapter.prototype.hgetall = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var hash;
            return __generator(this, function (_a) {
                hash = this.hashes.get(key);
                if (!hash)
                    return [2 /*return*/, {}];
                return [2 /*return*/, Object.fromEntries(hash.entries())];
            });
        });
    };
    /**
     * Delete one or more fields from a hash
     * @param key - Hash key
     * @param fields - Field names to delete
     * @returns Number of fields deleted
     */
    MemoryStorageAdapter.prototype.hdel = function (key) {
        var fields = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            fields[_i - 1] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var hash, deleted, _a, fields_1, field;
            return __generator(this, function (_b) {
                hash = this.hashes.get(key);
                if (!hash)
                    return [2 /*return*/, 0];
                deleted = 0;
                for (_a = 0, fields_1 = fields; _a < fields_1.length; _a++) {
                    field = fields_1[_a];
                    if (hash.delete(field)) {
                        deleted++;
                    }
                }
                // Clean up empty hash
                if (hash.size === 0) {
                    this.hashes.delete(key);
                }
                return [2 /*return*/, deleted];
            });
        });
    };
    // ============================================================================
    // List Operations (for ordered collections)
    // ============================================================================
    /**
     * Push value to the left (beginning) of a list
     * @param key - List key
     * @param value - Value to push
     */
    MemoryStorageAdapter.prototype.lpush = function (key, value) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                list = this.lists.get(key);
                if (!list) {
                    list = [];
                    this.lists.set(key, list);
                }
                list.unshift(value); // Add to beginning
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get a range of elements from a list
     * @param key - List key
     * @param start - Start index (0-based)
     * @param stop - Stop index (-1 for end of list)
     * @returns Array of values in range
     */
    MemoryStorageAdapter.prototype.lrange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function () {
            var list, end;
            return __generator(this, function (_a) {
                list = this.lists.get(key);
                if (!list)
                    return [2 /*return*/, []];
                end = stop === -1 ? list.length : stop + 1;
                return [2 /*return*/, list.slice(start, end)];
            });
        });
    };
    /**
     * Get the length of a list
     * @param key - List key
     * @returns List length
     */
    MemoryStorageAdapter.prototype.llen = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            var _a;
            return __generator(this, function (_b) {
                list = this.lists.get(key);
                return [2 /*return*/, (_a = list === null || list === void 0 ? void 0 : list.length) !== null && _a !== void 0 ? _a : 0];
            });
        });
    };
    // ============================================================================
    // Pattern Operations (for bulk operations)
    // ============================================================================
    /**
     * Find all keys matching a pattern
     * @param pattern - Glob pattern (* and ? wildcards supported)
     * @returns Array of matching keys
     */
    MemoryStorageAdapter.prototype.keys = function (pattern) {
        return __awaiter(this, void 0, void 0, function () {
            var regex;
            return __generator(this, function (_a) {
                regex = this.patternToRegex(pattern);
                return [2 /*return*/, Array.from(this.store.keys()).filter(function (key) { return regex.test(key); })];
            });
        });
    };
    /**
     * Iterate over keys matching a pattern (cursor-based)
     * @param cursor - Cursor position (0 to start)
     * @param pattern - Glob pattern
     * @param count - Number of keys to return
     * @returns Tuple of [new cursor, keys array]
     */
    MemoryStorageAdapter.prototype.scan = function (cursor, pattern, count) {
        return __awaiter(this, void 0, void 0, function () {
            var allKeys, start, end, keys, newCursor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.keys(pattern)];
                    case 1:
                        allKeys = _a.sent();
                        start = cursor;
                        end = Math.min(cursor + count, allKeys.length);
                        keys = allKeys.slice(start, end);
                        newCursor = end >= allKeys.length ? 0 : end;
                        return [2 /*return*/, [newCursor, keys]];
                }
            });
        });
    };
    // ============================================================================
    // Cleanup & Lifecycle
    // ============================================================================
    /**
     * Run cleanup of expired keys
     */
    MemoryStorageAdapter.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.cleanupExpired();
                return [2 /*return*/];
            });
        });
    };
    /**
     * Disconnect and cleanup all resources
     */
    MemoryStorageAdapter.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Stop cleanup interval
                if (this.cleanupInterval) {
                    clearInterval(this.cleanupInterval);
                    this.cleanupInterval = null;
                }
                // Clear all storage
                this.store.clear();
                this.hashes.clear();
                this.lists.clear();
                return [2 /*return*/];
            });
        });
    };
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Remove all expired keys from storage
     */
    MemoryStorageAdapter.prototype.cleanupExpired = function () {
        var now = Date.now();
        var keysToDelete = [];
        // Find all expired keys
        for (var _i = 0, _a = this.store.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], stored = _b[1];
            if (stored.expiresAt && stored.expiresAt < now) {
                keysToDelete.push(key);
            }
        }
        // Delete expired keys
        for (var _c = 0, keysToDelete_1 = keysToDelete; _c < keysToDelete_1.length; _c++) {
            var key = keysToDelete_1[_c];
            this.store.delete(key);
        }
    };
    /**
     * Convert a glob pattern to a regular expression
     * @param pattern - Glob pattern (* and ? wildcards)
     * @returns RegExp for pattern matching
     */
    MemoryStorageAdapter.prototype.patternToRegex = function (pattern) {
        // Escape regex special characters except * and ?
        var escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        // Convert glob wildcards to regex
        var regex = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp("^".concat(regex, "$"));
    };
    return MemoryStorageAdapter;
}());
exports.MemoryStorageAdapter = MemoryStorageAdapter;
