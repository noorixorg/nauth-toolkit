"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.BaseMFAProviderService = void 0;
var crypto_1 = require("crypto");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * Base MFA Provider Service
 *
 * Abstract base class that provides common functionality for all MFA providers.
 * Provider-specific services (TOTP, SMS, Passkey, etc.) should extend this class
 * and implement the IMFAProviderService interface methods.
 *
 * This base class handles:
 * - Device repository access
 * - User repository access
 * - Common device management operations
 * - Backup codes generation and verification
 * - MFA enforcement checks
 * - Helper methods
 *
 * **Key Design:**
 * - No hardcoded method names - works with any provider
 * - Provider config accessed dynamically via `methodName`
 * - Future developers can add new providers without modifying this class
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class TOTPMFAProviderService extends BaseMFAProviderService implements IMFAProviderService {
 *   readonly methodName = 'totp';
 *
 *   constructor(
 *     // ... base dependencies injected via super()
 *     private readonly totpService: TOTPService,
 *   ) {
 *     super(/* ... base dependencies *\/);
 *   }
 *
 *   async setup(user: IUser): Promise<unknown> {
 *     // TOTP-specific setup logic
 *   }
 *
 *   async verify(user: IUser, code: unknown): Promise<boolean> {
 *     // TOTP verification logic
 *   }
 * }
 * ```
 */
var BaseMFAProviderService = /** @class */ (function () {
    function BaseMFAProviderService(mfaDeviceRepository, userRepository, config, logger, passwordService, // Optional - from @nauth-toolkit/core
    challengeService, auditService, clientInfoService) {
        this.mfaDeviceRepository = mfaDeviceRepository;
        this.userRepository = userRepository;
        this.config = config;
        this.logger = logger;
        this.passwordService = passwordService;
        this.challengeService = challengeService;
        this.auditService = auditService;
        this.clientInfoService = clientInfoService;
    }
    /**
     * Check if this MFA method is allowed by configuration
     *
     * @returns True if method is allowed
     */
    BaseMFAProviderService.prototype.isMethodAllowed = function () {
        var _a;
        var allowedMethods = ((_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.allowedMethods) || __spreadArray([], mfa_method_enum_1.MFADeviceMethods, true);
        return allowedMethods.includes(this.methodName);
    };
    // sendChallenge is optional - only providers like SMS need it
    // TOTP doesn't need it (user generates code locally)
    // ============================================================================
    // Device Management (Common Logic)
    // ============================================================================
    /**
     * Get user's MFA devices
     *
     * @param userId - Internal user ID
     * @returns Array of MFA devices
     *
     * @protected
     */
    BaseMFAProviderService.prototype.getUserDevices = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var devices;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.mfaDeviceRepository.find({
                            where: { userId: userId },
                            order: { isPrimary: 'DESC', createdAt: 'DESC' },
                        })];
                    case 1:
                        devices = _a.sent();
                        return [2 /*return*/, devices];
                }
            });
        });
    };
    /**
     * Create MFA device for user
     *
     * @param userId - Internal user ID
     * @param deviceData - Device data to create
     * @returns Created device
     * @protected
     */
    BaseMFAProviderService.prototype.createDevice = function (userId, deviceData) {
        return __awaiter(this, void 0, void 0, function () {
            var device, saved;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        device = this.mfaDeviceRepository.create(__assign({ userId: userId, type: this.methodName }, deviceData));
                        return [4 /*yield*/, this.mfaDeviceRepository.save(device)];
                    case 1:
                        saved = _a.sent();
                        return [2 /*return*/, saved];
                }
            });
        });
    };
    /**
     * Find active device for user by method
     *
     * @param userId - Internal user ID
     * @param deviceId - Optional device ID
     * @returns Device if found, null otherwise
     * @protected
     */
    BaseMFAProviderService.prototype.findDevice = function (userId, deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var where, device;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        where = {
                            userId: userId,
                            type: this.methodName,
                            isActive: true,
                        };
                        if (deviceId) {
                            where.id = deviceId;
                        }
                        return [4 /*yield*/, this.mfaDeviceRepository.findOne({
                                where: where,
                                order: { isPrimary: 'DESC', lastUsedAt: 'DESC' },
                            })];
                    case 1:
                        device = _a.sent();
                        return [2 /*return*/, device ? device : null];
                }
            });
        });
    };
    /**
     * Update device usage statistics
     *
     * @param deviceId - Device ID
     * @protected
     */
    BaseMFAProviderService.prototype.updateDeviceUsage = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var device;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.mfaDeviceRepository.findOne({ where: { id: deviceId } })];
                    case 1:
                        device = _a.sent();
                        if (!device) return [3 /*break*/, 3];
                        device.lastUsedAt = new Date();
                        device.usageCount = (device.usageCount || 0) + 1;
                        return [4 /*yield*/, this.mfaDeviceRepository.save(device)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Enable MFA for user
     *
     * Sets mfaEnabled flag and updates mfaMethods array.
     * Called automatically when first device is registered.
     * Automatically clears MFA_SETUP_REQUIRED challenges if they exist.
     *
     * @param user - User to enable MFA for
     * @protected
     */
    BaseMFAProviderService.prototype.enableMFAForUser = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, userEntity, userEntityRecord, isFirstDevice, devices, methods, primaryDevice, auditError_1, errorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        userId = user.id;
                        return [4 /*yield*/, this.userRepository.findOne({ where: { id: userId } })];
                    case 1:
                        userEntity = _d.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found when enabling MFA');
                        }
                        userEntityRecord = userEntity;
                        isFirstDevice = !userEntityRecord.mfaEnabled;
                        if (!userEntityRecord.mfaEnabled) {
                            userEntityRecord.mfaEnabled = true;
                            userEntityRecord.mfaEnforcedAt = new Date();
                        }
                        return [4 /*yield*/, this.getUserDevices(userId)];
                    case 2:
                        devices = _d.sent();
                        methods = __spreadArray([], new Set(devices.filter(function (d) { return d.isActive; }).map(function (d) { return d.type; })), true);
                        userEntityRecord.mfaMethods = methods;
                        // Set preferred method if not set
                        if (!userEntityRecord.preferredMfaMethod && methods.length > 0) {
                            primaryDevice = devices.find(function (d) { return d.isPrimary && d.isActive; });
                            userEntityRecord.preferredMfaMethod = (primaryDevice === null || primaryDevice === void 0 ? void 0 : primaryDevice.type) || methods[0];
                        }
                        return [4 /*yield*/, this.userRepository.save(userEntity)];
                    case 3:
                        _d.sent();
                        if (!(isFirstDevice && this.auditService && this.clientInfoService)) return [3 /*break*/, 7];
                        _d.label = 4;
                    case 4:
                        _d.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_ENABLED,
                                eventStatus: 'SUCCESS',
                                metadata: {
                                    // Client info automatically included from context
                                    mfaMethod: this.methodName,
                                    mfaMethods: methods,
                                },
                            }))];
                    case 5:
                        _d.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        auditError_1 = _d.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record MFA_ENABLED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                            methodName: this.methodName,
                        });
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================================
    // Backup Codes (Common Logic)
    // ============================================================================
    /**
     * Generate backup codes for user
     *
     * Creates single-use recovery codes that can be used when MFA devices are unavailable.
     * Exposed as optional method in IMFAProviderService interface.
     *
     * @param user - User to generate codes for
     * @returns Generated backup codes (plain text - shown only once)
     */
    BaseMFAProviderService.prototype.generateBackupCodes = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, config, codeCount, codeLength, codes, i, code, passwordService, hashedCodes, auditError_2, errorMessage;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        userEntity = user;
                        config = (_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.backup;
                        codeCount = (config === null || config === void 0 ? void 0 : config.codeCount) || 10;
                        codeLength = (config === null || config === void 0 ? void 0 : config.codeLength) || 8;
                        codes = [];
                        for (i = 0; i < codeCount; i++) {
                            code = this.generateRandomCode(codeLength);
                            codes.push(code);
                        }
                        // Check if password service is available
                        if (!this.passwordService || typeof this.passwordService.hashPassword !== 'function') {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Password service is not available');
                        }
                        passwordService = this.passwordService;
                        return [4 /*yield*/, Promise.all(codes.map(function (code) { return passwordService.hashPassword(code); }))];
                    case 1:
                        hashedCodes = _g.sent();
                        // Store hashed codes
                        userEntity.backupCodes = hashedCodes;
                        return [4 /*yield*/, this.userRepository.save(userEntity)];
                    case 2:
                        _g.sent();
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.log) === null || _c === void 0 ? void 0 : _c.call(_b, "Generated ".concat(codeCount, " backup codes for user: ").concat(user.sub));
                        if (!(this.auditService && this.clientInfoService)) return [3 /*break*/, 6];
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, ((_d = this.auditService) === null || _d === void 0 ? void 0 : _d.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_BACKUP_CODES_GENERATED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    codeCount: codeCount,
                                    codeLength: codeLength,
                                },
                            }))];
                    case 4:
                        _g.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_2 = _g.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.call(_e, "Failed to record MFA_BACKUP_CODES_GENERATED audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: user.id,
                        });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, codes];
                }
            });
        });
    };
    /**
     * Verify backup code
     *
     * Validates backup code and removes it after use (single-use).
     *
     * @param user - User being authenticated
     * @param code - Backup code to verify
     * @returns True if code is valid
     * @protected
     */
    BaseMFAProviderService.prototype.verifyBackupCode = function (user, code) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, backupCodes, passwordService, i, isValid, auditError_3, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        userEntity = user;
                        backupCodes = userEntity.backupCodes;
                        if (!backupCodes || backupCodes.length === 0) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, 'No backup codes available');
                            return [2 /*return*/, false];
                        }
                        // Check if password service is available
                        if (!this.passwordService ||
                            typeof this.passwordService.verifyPassword !== 'function') {
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, 'Backup code verification attempted but password service is not available');
                            return [2 /*return*/, false];
                        }
                        passwordService = this.passwordService;
                        i = 0;
                        _m.label = 1;
                    case 1:
                        if (!(i < backupCodes.length)) return [3 /*break*/, 9];
                        return [4 /*yield*/, passwordService.verifyPassword(code, backupCodes[i])];
                    case 2:
                        isValid = _m.sent();
                        if (!isValid) return [3 /*break*/, 8];
                        // Remove used code
                        backupCodes.splice(i, 1);
                        userEntity.backupCodes = backupCodes;
                        return [4 /*yield*/, this.userRepository.save(userEntity)];
                    case 3:
                        _m.sent();
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "Backup code verified and removed for user: ".concat(user.sub));
                        if (!(this.auditService && this.clientInfoService)) return [3 /*break*/, 7];
                        _m.label = 4;
                    case 4:
                        _m.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, ((_g = this.auditService) === null || _g === void 0 ? void 0 : _g.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_BACKUP_CODE_USED,
                                eventStatus: 'SUCCESS',
                                authMethod: 'backup',
                                metadata: {
                                    // Client info automatically included from context
                                    remainingCodes: backupCodes.length,
                                },
                            }))];
                    case 5:
                        _m.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        auditError_3 = _m.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.error) === null || _j === void 0 ? void 0 : _j.call(_h, "Failed to record MFA_BACKUP_CODE_USED audit event: ".concat(errorMessage), {
                            error: auditError_3,
                            userId: user.id,
                        });
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/, true];
                    case 8:
                        i++;
                        return [3 /*break*/, 1];
                    case 9:
                        (_l = (_k = this.logger) === null || _k === void 0 ? void 0 : _k.warn) === null || _l === void 0 ? void 0 : _l.call(_k, 'Backup code verification failed');
                        return [2 /*return*/, false];
                }
            });
        });
    };
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Generate random alphanumeric code
     *
     * @param length - Code length
     * @returns Random code
     * @protected
     */
    BaseMFAProviderService.prototype.generateRandomCode = function (length) {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
        var code = '';
        var bytes = (0, crypto_1.randomBytes)(length);
        for (var i = 0; i < length; i++) {
            code += chars[bytes[i] % chars.length];
        }
        return code;
    };
    /**
     * Mask phone number for display
     *
     * @param phone - Phone number
     * @returns Masked phone number
     * @protected
     */
    BaseMFAProviderService.prototype.maskPhone = function (phone) {
        var digits = phone.replace(/\D/g, '');
        if (digits.length < 4)
            return phone;
        return "***-***-".concat(digits.slice(-4));
    };
    /**
     * Mask email address for display
     *
     * Masks the local part of the email while showing the domain.
     * Example: user@example.com → u***r@example.com
     *
     * @param email - Email address
     * @returns Masked email address
     * @protected
     *
     * @example
     * ```typescript
     * const masked = this.maskEmail('user@example.com');
     * // Returns: 'u***r@example.com'
     * ```
     */
    BaseMFAProviderService.prototype.maskEmail = function (email) {
        var _a = email.split('@'), localPart = _a[0], domain = _a[1];
        if (!localPart || !domain)
            return email;
        if (localPart.length <= 2) {
            return "".concat(localPart[0], "***@").concat(domain);
        }
        return "".concat(localPart[0], "***").concat(localPart[localPart.length - 1], "@").concat(domain);
    };
    /**
     * Check if MFA is required for a user
     *
     * Determines MFA requirement based on:
     * - User-level MFA exemption (admin override)
     * - Global enforcement policy (OPTIONAL, REQUIRED, ADAPTIVE)
     * - Grace period for REQUIRED enforcement
     * - User's MFA enrollment date
     *
     * ⚠️ ADAPTIVE enforcement currently behaves like REQUIRED (placeholder for future risk-based logic)
     *
     * @param user - User to check
     * @returns True if MFA is required
     * @protected
     */
    BaseMFAProviderService.prototype.isMFARequired = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var mfaExempt, mfaConfig, enforcement, gracePeriod, gracePeriodEnd, userWithDates;
            return __generator(this, function (_a) {
                mfaExempt = user.mfaExempt;
                // Check for boolean true (handle numeric 1 case at runtime if needed)
                if (mfaExempt === true || mfaExempt === 1) {
                    return [2 /*return*/, false];
                }
                mfaConfig = this.config.mfa;
                if (!(mfaConfig === null || mfaConfig === void 0 ? void 0 : mfaConfig.enabled)) {
                    return [2 /*return*/, false];
                }
                enforcement = mfaConfig.enforcement || 'OPTIONAL';
                if (enforcement === 'OPTIONAL') {
                    return [2 /*return*/, false];
                }
                if (enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE') {
                    gracePeriod = mfaConfig.gracePeriod || 7;
                    gracePeriodEnd = new Date();
                    gracePeriodEnd.setDate(gracePeriodEnd.getDate() - gracePeriod);
                    userWithDates = user;
                    if (userWithDates.mfaEnforcedAt) {
                        return [2 /*return*/, userWithDates.mfaEnforcedAt <= gracePeriodEnd];
                    }
                    // User hasn't enrolled - check account creation date
                    if (userWithDates.createdAt) {
                        return [2 /*return*/, userWithDates.createdAt <= gracePeriodEnd];
                    }
                    // No dates available - require MFA immediately
                    return [2 /*return*/, true];
                }
                return [2 /*return*/, false];
            });
        });
    };
    return BaseMFAProviderService;
}());
exports.BaseMFAProviderService = BaseMFAProviderService;
