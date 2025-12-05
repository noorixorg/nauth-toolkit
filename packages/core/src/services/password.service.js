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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = void 0;
var argon2 = require("argon2");
var common_passwords_1 = require("../utils/common-passwords");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
/**
 * Default password hashing configuration
 * Based on OWASP recommendations for 2025
 */
var DEFAULT_ARGON2_CONFIG = {
    type: argon2.argon2id, // Hybrid mode (best security)
    memoryCost: 65536, // 64 MB memory usage
    timeCost: 3, // 3 iterations
    parallelism: 2, // 2 parallel threads
    hashLength: 32, // 256-bit hash output
};
/**
 * Password Service
 *
 * Handles all password-related operations including:
 * - Hashing passwords with Argon2id
 * - Verifying passwords against hashes
 * - Validating password policy compliance
 * - Checking password history to prevent reuse
 *
 * Security Features:
 * - Argon2id hashing (winner of Password Hashing Competition)
 * - Configurable password policy
 * - Common password detection (10,000+ passwords loaded from file)
 * - Password history tracking
 * - Protection against timing attacks
 *
 * ⚠️ SECURITY FIX #8: Now loads 10K+ common passwords from bundled file
 *
 * @example
 * ```typescript
 * const passwordService = new PasswordService(config);
 *
 * // Hash a password
 * const hash = await passwordService.hashPassword('SecurePass123!');
 *
 * // Verify a password
 * const isValid = await passwordService.verifyPassword('SecurePass123!', hash);
 *
 * // Validate password policy
 * const validation = await passwordService.validatePassword('weak');
 * if (!validation.valid) {
 *   logger.error('Password validation failed', { errors: validation.errors });
 * }
 * ```
 */
var PasswordService = /** @class */ (function () {
    function PasswordService(passwordConfig) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        // ============================================================================
        // MEDIUM SECURITY FIX #8: Load Comprehensive Password List (10K+ passwords)
        // ============================================================================
        this.commonPasswords = (0, common_passwords_1.loadCommonPasswords)();
        // Merge provided config with sensible defaults
        this.config = {
            minLength: (_a = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.minLength) !== null && _a !== void 0 ? _a : 8,
            maxLength: (_b = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.maxLength) !== null && _b !== void 0 ? _b : 128,
            requireUppercase: (_c = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.requireUppercase) !== null && _c !== void 0 ? _c : true,
            requireLowercase: (_d = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.requireLowercase) !== null && _d !== void 0 ? _d : true,
            requireNumbers: (_e = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.requireNumbers) !== null && _e !== void 0 ? _e : true,
            requireSpecialChars: (_f = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.requireSpecialChars) !== null && _f !== void 0 ? _f : true,
            specialChars: (_g = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.specialChars) !== null && _g !== void 0 ? _g : '!@#$%^&*()_+=[{}|;:,.<>?-]', // Move - to end to avoid range interpretation
            preventCommon: (_h = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.preventCommon) !== null && _h !== void 0 ? _h : true,
            preventUserInfo: (_j = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.preventUserInfo) !== null && _j !== void 0 ? _j : true,
            historyCount: (_k = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.historyCount) !== null && _k !== void 0 ? _k : 5,
            expiryDays: (_l = passwordConfig === null || passwordConfig === void 0 ? void 0 : passwordConfig.expiryDays) !== null && _l !== void 0 ? _l : 0, // 0 = disabled
        };
    }
    // ============================================================================
    // Password Hashing
    // ============================================================================
    /**
     * Hash a password using Argon2id algorithm
     *
     * Argon2id is the recommended password hashing algorithm as of 2025.
     * It combines Argon2i (resistant to side-channel attacks) and Argon2d
     * (resistant to GPU cracking attacks).
     *
     * @param password - Plain text password to hash
     * @returns Hashed password string (includes salt and algorithm parameters)
     *
     * @example
     * ```typescript
     * const hash = await passwordService.hashPassword('MySecurePassword123!');
     * // Returns: $argon2id$v=19$m=65536,t=3,p=4$...
     * ```
     */
    PasswordService.prototype.hashPassword = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, argon2.hash(password, DEFAULT_ARGON2_CONFIG)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Failed to hash password: ".concat(errorMessage));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify a password against its hash
     *
     * This method is resistant to timing attacks by using constant-time
     * comparison internally via Argon2's verify function.
     *
     * @param password - Plain text password to verify
     * @param hash - Hashed password to compare against
     * @returns True if password matches hash, false otherwise
     *
     * @example
     * ```typescript
     * const isValid = await passwordService.verifyPassword(
     *   'MyPassword123!',
     *   '$argon2id$v=19$m=65536,t=3,p=4$...'
     * );
     * ```
     */
    PasswordService.prototype.verifyPassword = function (password, hash) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, argon2.verify(hash, password)];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        _a = _b.sent();
                        // If verification fails due to invalid hash format, return false
                        // rather than throwing (could be malformed data)
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================================
    // Password Validation
    // ============================================================================
    /**
     * Validate a password against configured policy rules
     *
     * Checks multiple security criteria:
     * - Length requirements (min/max)
     * - Character complexity (uppercase, lowercase, numbers, special chars)
     * - Common password detection
     * - User information leakage (username/email in password)
     *
     * @param password - Password to validate
     * @param userInfo - Optional user information to check against (email, username)
     * @returns Validation result with any errors
     *
     * @example
     * ```typescript
     * const result = await passwordService.validatePassword('weak', {
     *   email: 'user@example.com',
     *   username: 'john'
     * });
     *
     * if (!result.valid) {
     *   logger.error('Password validation failed', { errors: result.errors });
     *   // ['Password must be at least 8 characters', ...]
     * }
     * ```
     */
    PasswordService.prototype.validatePassword = function (password, userInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, hasSpecialChar, passwordLower, emailUsername, usernameLower;
            return __generator(this, function (_a) {
                errors = [];
                // Check length requirements
                if (password.length < this.config.minLength) {
                    errors.push("Password must be at least ".concat(this.config.minLength, " characters long"));
                }
                if (password.length > this.config.maxLength) {
                    errors.push("Password must not exceed ".concat(this.config.maxLength, " characters"));
                }
                // Check character complexity requirements
                if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
                    errors.push('Password must contain at least one uppercase letter');
                }
                if (this.config.requireLowercase && !/[a-z]/.test(password)) {
                    errors.push('Password must contain at least one lowercase letter');
                }
                if (this.config.requireNumbers && !/\d/.test(password)) {
                    errors.push('Password must contain at least one number');
                }
                if (this.config.requireSpecialChars) {
                    hasSpecialChar = this.config.specialChars.split('').some(function (char) { return password.includes(char); });
                    if (!hasSpecialChar) {
                        errors.push("Password must contain at least one special character (".concat(this.config.specialChars, ")"));
                    }
                }
                // Check against common passwords (10K+ passwords loaded from file)
                // TODO: this is not truly functional, need to work on it later
                if (this.config.preventCommon) {
                    if (this.commonPasswords.has(password.toLowerCase())) {
                        errors.push('Password is too common and easy to guess');
                    }
                }
                // Check for user information in password
                if (this.config.preventUserInfo && userInfo) {
                    passwordLower = password.toLowerCase();
                    if (userInfo.email) {
                        emailUsername = userInfo.email.split('@')[0].toLowerCase();
                        if (passwordLower.includes(emailUsername)) {
                            errors.push('Password must not contain your email or username');
                        }
                    }
                    if (userInfo.username) {
                        usernameLower = userInfo.username.toLowerCase();
                        if (passwordLower.includes(usernameLower)) {
                            errors.push('Password must not contain your email or username');
                        }
                    }
                }
                return [2 /*return*/, {
                        valid: errors.length === 0,
                        errors: errors,
                    }];
            });
        });
    };
    /**
     * Check if a password has been used before (password history check)
     *
     * Prevents users from reusing recent passwords, which is a security
     * best practice to limit the impact of compromised passwords.
     *
     * @param password - Plain text password to check
     * @param passwordHistory - Array of previous password hashes
     * @returns True if password was used before, false otherwise
     *
     * @example
     * ```typescript
     * const isReused = await passwordService.isPasswordInHistory(
     *   'NewPassword123!',
     *   user.passwordHistory // Last 5 passwords
     * );
     *
     * if (isReused) {
     *   throw new Error('Cannot reuse recent passwords');
     * }
     * ```
     */
    PasswordService.prototype.isPasswordInHistory = function (password, passwordHistory) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, passwordHistory_1, oldHash, matches;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, passwordHistory_1 = passwordHistory;
                        _a.label = 1;
                    case 1:
                        if (!(_i < passwordHistory_1.length)) return [3 /*break*/, 4];
                        oldHash = passwordHistory_1[_i];
                        return [4 /*yield*/, this.verifyPassword(password, oldHash)];
                    case 2:
                        matches = _a.sent();
                        if (matches) {
                            return [2 /*return*/, true];
                        }
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, false];
                }
            });
        });
    };
    /**
     * Add a password hash to history, maintaining the configured limit
     *
     * @param currentHistory - Current password history array
     * @param newHash - New password hash to add
     * @returns Updated history array with new hash
     *
     * @example
     * ```typescript
     * user.passwordHistory = passwordService.addToHistory(
     *   user.passwordHistory,
     *   newPasswordHash
     * );
     * ```
     */
    PasswordService.prototype.addToHistory = function (currentHistory, newHash) {
        var history = __spreadArray(__spreadArray([], currentHistory, true), [newHash], false);
        // Keep only the most recent N passwords (configured limit)
        if (history.length > this.config.historyCount) {
            return history.slice(-this.config.historyCount);
        }
        return history;
    };
    return PasswordService;
}());
exports.PasswordService = PasswordService;
