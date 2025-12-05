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
exports.MFAService = void 0;
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
var auth_challenge_dto_1 = require("../dto/auth-challenge.dto");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
/**
 * MFA Service Registry
 *
 * Central registry for managing MFA provider services.
 * Routes requests to the appropriate provider based on method name.
 *
 * Provider services (TOTP, SMS, Passkey) automatically register themselves
 * when their modules are imported via OnModuleInit.
 *
 * **Key Features:**
 * - Provider registration and lookup
 * - Unified interface for MFA operations
 * - Routing verification requests to correct provider
 * - Device management operations
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   constructor(private readonly mfaService: MFAService) {}
 *
 *   @Post('mfa/verify')
 *   async verifyMFA(@Body() dto: { method: string; code: string }) {
 *     const provider = this.mfaService.getProvider(dto.method);
 *     return await provider.verify(user, dto.code);
 *   }
 * }
 * ```
 */
var MFAService = /** @class */ (function () {
    function MFAService(mfaDeviceRepository, userRepository, challengeService, config, logger, auditService, clientInfoService) {
        this.mfaDeviceRepository = mfaDeviceRepository;
        this.userRepository = userRepository;
        this.challengeService = challengeService;
        this.config = config;
        this.logger = logger;
        this.auditService = auditService;
        this.clientInfoService = clientInfoService;
        this.providers = new Map();
    }
    /**
     * Register an MFA provider
     *
     * Called automatically by provider modules during initialization.
     * Provider method names must be unique.
     *
     * @param provider - Provider service instance (must have methodName property)
     * @throws {NAuthException} If provider is already registered
     *
     * @example
     * ```typescript
     * // In provider module's OnModuleInit
     * this.mfaService.registerProvider(this.totpProvider);
     * ```
     */
    MFAService.prototype.registerProvider = function (provider) {
        var name = provider.methodName;
        if (this.providers.has(name)) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "MFA provider '".concat(name, "' is already registered"));
        }
        this.providers.set(name, provider);
    };
    /**
     * Get a provider by method name
     *
     * @param methodName - Method name (e.g., 'totp', 'sms', 'passkey')
     * @returns Provider service instance
     * @throws {NAuthException} If provider is not registered
     *
     * @example
     * ```typescript
     * const totpProvider = this.mfaService.getProvider('totp');
     * const setupData = await totpProvider.setup(user);
     * ```
     */
    MFAService.prototype.getProvider = function (methodName) {
        var provider = this.providers.get(methodName);
        if (!provider) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "MFA provider '".concat(methodName, "' is not registered. Import the provider module (e.g., TOTPMFAModule) and ensure it's properly configured."));
        }
        return provider;
    };
    /**
     * Check if a provider is registered
     *
     * @param dto - Request DTO with method name
     * @returns Response DTO with hasProvider flag
     *
     * @example
     * ```typescript
     * const result = await this.mfaService.hasProvider({ methodName: 'totp' });
     * if (result.hasProvider) {
     *   // TOTP is available
     * }
     * ```
     */
    MFAService.prototype.hasProvider = function (dto) {
        return {
            hasProvider: this.providers.has(dto.methodName),
        };
    };
    /**
     * Get all registered provider method names
     *
     * @returns Response DTO with array of method names
     *
     * @example
     * ```typescript
     * const result = this.mfaService.listProviders(); // { providers: ['totp', 'sms', 'passkey'] }
     * ```
     */
    MFAService.prototype.listProviders = function () {
        return {
            providers: Array.from(this.providers.keys()),
        };
    };
    /**
     * Get available MFA methods for a user
     *
     * Returns list of methods that are:
     * - Registered as providers
     * - Allowed by configuration
     *
     * This returns ALL methods that can be set up, not just ones the user has configured.
     * Use getUserDevices() to check which methods the user has actually set up.
     *
     * @param dto - Request DTO with user sub
     * @returns Response DTO with array of available method names
     *
     * @example
     * ```typescript
     * const result = await this.mfaService.getAvailableMethods({ sub: user.sub });
     * // Returns: { availableMethods: ['totp', 'sms', 'passkey'] }
     * ```
     */
    MFAService.prototype.getAvailableMethods = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, available, _i, _a, _b, methodName, provider;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        userEntity = _c.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        available = [];
                        for (_i = 0, _a = this.providers.entries(); _i < _a.length; _i++) {
                            _b = _a[_i], methodName = _b[0], provider = _b[1];
                            // Check if method is allowed by configuration
                            if (!provider.isMethodAllowed()) {
                                continue;
                            }
                            // Return all allowed methods (whether user has set them up or not)
                            available.push(methodName);
                        }
                        return [2 /*return*/, {
                                availableMethods: available,
                            }];
                }
            });
        });
    };
    /**
     * Verify MFA code using appropriate provider
     *
     * Routes the verification request to the correct provider based on method name.
     *
     * @param dto - Request DTO with user sub, method name, code, and optional device ID
     * @returns Response DTO with verification result
     * @throws {NAuthException} If method is not available or verification fails
     *
     * @example
     * ```typescript
     * // Verify TOTP code
     * const result = await this.mfaService.verifyCode({
     *   sub: user.sub,
     *   methodName: 'totp',
     *   code: '123456'
     * });
     *
     * // Verify backup code
     * const result = await this.mfaService.verifyCode({
     *   sub: user.sub,
     *   methodName: 'backup',
     *   code: 'ABC12345'
     * });
     * ```
     */
    MFAService.prototype.verifyCode = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, user, firstProvider, providerWithBackup, isValid_1, provider, isValid;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        userEntity = _a.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        user = userEntity;
                        if (!(dto.methodName === mfa_method_enum_1.MFAMethod.BACKUP)) return [3 /*break*/, 4];
                        firstProvider = Array.from(this.providers.values())[0];
                        if (!(firstProvider && 'verifyBackupCode' in firstProvider)) return [3 /*break*/, 3];
                        providerWithBackup = firstProvider;
                        return [4 /*yield*/, providerWithBackup.verifyBackupCode(user, dto.code)];
                    case 2:
                        isValid_1 = _a.sent();
                        return [2 /*return*/, { valid: isValid_1 }];
                    case 3: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Backup code verification not available');
                    case 4:
                        provider = this.getProvider(dto.methodName);
                        return [4 /*yield*/, provider.verify(user, dto.code, dto.deviceId)];
                    case 5:
                        isValid = _a.sent();
                        return [2 /*return*/, { valid: isValid }];
                }
            });
        });
    };
    /**
     * Setup MFA device using appropriate provider
     *
     * @param dto - Request DTO with user sub, method name, and optional setup data
     * @returns Response DTO with provider-specific setup data
     *
     * @example
     * ```typescript
     * const result = await this.mfaService.setup({
     *   sub: user.sub,
     *   methodName: 'totp'
     * });
     * // Returns: { setupData: { secret, qrCode, manualEntryKey } }
     * ```
     */
    MFAService.prototype.setup = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, user, provider, setupData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        userEntity = _a.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        user = userEntity;
                        provider = this.getProvider(dto.methodName);
                        return [4 /*yield*/, provider.setup(user, dto.setupData)];
                    case 2:
                        setupData = _a.sent();
                        return [2 /*return*/, {
                                setupData: setupData,
                            }];
                }
            });
        });
    };
    /**
     * Get user's MFA devices
     *
     * @param dto - Request DTO with user sub
     * @returns Response DTO with array of MFA devices
     *
     * @example
     * ```typescript
     * const result = await this.mfaService.getUserDevices({ sub: user.sub });
     * // Returns: { devices: [...] }
     * ```
     */
    MFAService.prototype.getUserDevices = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, devices;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        userEntity = _a.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.mfaDeviceRepository.find({
                                where: { userId: userEntity.id },
                                order: { isPrimary: 'DESC', createdAt: 'DESC' },
                            })];
                    case 2:
                        devices = _a.sent();
                        return [2 /*return*/, {
                                devices: devices,
                            }];
                }
            });
        });
    };
    /**
     * Get comprehensive MFA status for a user
     *
     * Returns complete MFA configuration status including:
     * - Whether MFA is enabled/required
     * - Configured and available methods
     * - Preferred method
     * - Backup codes status
     * - MFA exemption information
     *
     * This method encapsulates all business logic for MFA status,
     * ensuring consumer apps don't need to query databases or build responses manually.
     *
     * @param dto - Request DTO with user sub
     * @returns Response DTO with complete MFA status
     *
     * @example
     * ```typescript
     * @Get('mfa/status')
     * async getMFAStatus(@CurrentUser() user: IUser) {
     *   return await this.mfaService.getMFAStatus({ sub: user.sub });
     * }
     * ```
     */
    MFAService.prototype.getMFAStatus = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, enabled, availableMethodsResult, finalAvailableMethods, devicesResult, configuredMethods, required, hasBackupCodes;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({
                            select: [
                                'id',
                                'mfaEnabled',
                                'backupCodes',
                                'preferredMfaMethod',
                                'mfaExempt',
                                'mfaExemptReason',
                                'mfaExemptGrantedAt',
                            ],
                            where: { sub: dto.sub },
                        })];
                    case 1:
                        userEntity = _d.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        enabled = userEntity.mfaEnabled || false;
                        return [4 /*yield*/, this.getAvailableMethods({ sub: dto.sub })];
                    case 2:
                        availableMethodsResult = _d.sent();
                        finalAvailableMethods = __spreadArray([], availableMethodsResult.availableMethods, true);
                        if ((_c = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.mfa) === null || _b === void 0 ? void 0 : _b.backup) === null || _c === void 0 ? void 0 : _c.enabled) {
                            if (!finalAvailableMethods.includes(mfa_method_enum_1.MFAMethod.BACKUP)) {
                                finalAvailableMethods.push(mfa_method_enum_1.MFAMethod.BACKUP);
                            }
                        }
                        return [4 /*yield*/, this.getUserDevices({ sub: dto.sub })];
                    case 3:
                        devicesResult = _d.sent();
                        configuredMethods = __spreadArray([], new Set(devicesResult.devices.filter(function (d) { return d.isActive; }).map(function (d) { return d.type; })), true);
                        required = enabled && configuredMethods.length > 0;
                        hasBackupCodes = !!userEntity.backupCodes && userEntity.backupCodes.length > 0;
                        return [2 /*return*/, {
                                enabled: enabled,
                                required: required,
                                configuredMethods: configuredMethods,
                                availableMethods: finalAvailableMethods,
                                hasBackupCodes: hasBackupCodes,
                                preferredMethod: userEntity.preferredMfaMethod,
                                mfaExempt: userEntity.mfaExempt || false,
                                mfaExemptReason: userEntity.mfaExemptReason || null,
                                mfaExemptGrantedAt: userEntity.mfaExemptGrantedAt || null,
                            }];
                }
            });
        });
    };
    /**
     * Remove MFA devices by method type
     *
     * Comprehensive method that handles all aspects of MFA device removal:
     * - Looks up user by sub (consumer apps should pass user.sub from @CurrentUser())
     * - Validates method type
     * - Removes all active devices of the specified method type
     * - Updates user's preferred method if the removed method was preferred
     * - Updates device primary flags
     * - Disables MFA if this was the last device
     * - Creates MFA_SETUP_REQUIRED challenge if MFA enforcement requires it
     *
     * This method encapsulates all database operations related to MFA device removal,
     * ensuring the consumer app doesn't need to directly manipulate nauth_* tables.
     *
     * @param dto - Request DTO with user sub and method type
     * @returns Response DTO with deletedCount and whether MFA was disabled
     * @throws {NAuthException} If user not found, invalid method type, or no devices found
     *
     * @example
     * ```typescript
     * // Consumer app controller
     * @Delete('mfa/devices/:method')
     * async removeMFAMethod(@CurrentUser() user: IUser, @Param('method') method: string) {
     *   const result = await this.mfaService.removeDevices({ userSub: user.sub, methodType: method });
     *   return { message: 'MFA method removed successfully', ...result };
     * }
     * ```
     */
    MFAService.prototype.removeDevices = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var validMethods, normalizedMethod, userEntity, userId, user, preferredMethod, isPreferredMethod, devicesResult, activeDevices, devicesToRemove, deletedCount, _i, devicesToRemove_1, device, result, remainingDevicesResult, remainingActiveDevices, mfaDisabled, auditError_1, errorMessage, enforcement, user_1, error_1, remainingMethods, newPreferredMethod, i, user_2, auditError_2, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0:
                        validMethods = [mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.PASSKEY];
                        normalizedMethod = dto.methodType.toLowerCase();
                        if (!validMethods.includes(normalizedMethod)) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Invalid MFA method: ".concat(dto.methodType, ". Valid methods are: ").concat(validMethods.join(', ')));
                        }
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.userSub } })];
                    case 1:
                        userEntity = _q.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User entity not found');
                        }
                        userId = userEntity.id;
                        if (!userId) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'User entity missing internal ID');
                        }
                        user = userEntity;
                        preferredMethod = userEntity.preferredMfaMethod;
                        isPreferredMethod = preferredMethod === normalizedMethod;
                        return [4 /*yield*/, this.getUserDevices({ sub: dto.userSub })];
                    case 2:
                        devicesResult = _q.sent();
                        activeDevices = devicesResult.devices.filter(function (d) { return d.isActive; });
                        devicesToRemove = activeDevices.filter(function (d) { return d.type === normalizedMethod; });
                        if (devicesToRemove.length === 0) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "No active ".concat(normalizedMethod, " MFA devices found for this user"));
                        }
                        deletedCount = 0;
                        _i = 0, devicesToRemove_1 = devicesToRemove;
                        _q.label = 3;
                    case 3:
                        if (!(_i < devicesToRemove_1.length)) return [3 /*break*/, 6];
                        device = devicesToRemove_1[_i];
                        return [4 /*yield*/, this.mfaDeviceRepository.delete(device.id)];
                    case 4:
                        result = _q.sent();
                        deletedCount += result.affected || 0;
                        _q.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [4 /*yield*/, this.getUserDevices({ sub: dto.userSub })];
                    case 7:
                        remainingDevicesResult = _q.sent();
                        remainingActiveDevices = remainingDevicesResult.devices.filter(function (d) { return d.isActive; });
                        mfaDisabled = false;
                        if (!(remainingActiveDevices.length === 0)) return [3 /*break*/, 17];
                        userEntity.mfaEnabled = false;
                        userEntity.mfaMethods = [];
                        userEntity.preferredMfaMethod = null;
                        return [4 /*yield*/, this.userRepository.save(userEntity)];
                    case 8:
                        _q.sent();
                        mfaDisabled = true;
                        if (!(this.auditService && this.clientInfoService)) return [3 /*break*/, 12];
                        _q.label = 9;
                    case 9:
                        _q.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_DISABLED,
                                eventStatus: 'INFO',
                                reason: 'all_devices_removed',
                                description: 'MFA disabled - all devices removed',
                                // Client info automatically included from context
                                metadata: {
                                    removedMethod: normalizedMethod,
                                    deletedCount: deletedCount,
                                },
                            }))];
                    case 10:
                        _q.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        auditError_1 = _q.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record MFA_DISABLED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                        });
                        return [3 /*break*/, 12];
                    case 12:
                        if (!(this.challengeService && ((_e = (_d = this.config) === null || _d === void 0 ? void 0 : _d.mfa) === null || _e === void 0 ? void 0 : _e.enabled))) return [3 /*break*/, 16];
                        enforcement = this.config.mfa.enforcement || 'OPTIONAL';
                        if (!(enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE')) return [3 /*break*/, 16];
                        user_1 = userEntity;
                        _q.label = 13;
                    case 13:
                        _q.trys.push([13, 15, , 16]);
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        return [4 /*yield*/, this.challengeService.createChallengeSession(user_1, auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED, {
                                allowedMethods: this.config.mfa.allowedMethods || [],
                                requiresSetup: true,
                            })];
                    case 14:
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        _q.sent();
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.log) === null || _g === void 0 ? void 0 : _g.call(_f, "Created MFA_SETUP_REQUIRED challenge for user ".concat(user_1.sub, " after MFA removal"));
                        return [3 /*break*/, 16];
                    case 15:
                        error_1 = _q.sent();
                        // Log but don't fail the removal if challenge creation fails
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.warn) === null || _j === void 0 ? void 0 : _j.call(_h, "Failed to create MFA_SETUP_REQUIRED challenge after MFA removal: ".concat(error_1));
                        return [3 /*break*/, 16];
                    case 16: return [3 /*break*/, 27];
                    case 17:
                        remainingMethods = __spreadArray([], new Set(remainingActiveDevices.map(function (d) { return d.type; })), true);
                        userEntity.mfaMethods = remainingMethods;
                        if (!isPreferredMethod) return [3 /*break*/, 25];
                        newPreferredMethod = remainingActiveDevices[0].type;
                        userEntity.preferredMfaMethod = newPreferredMethod;
                        return [4 /*yield*/, this.userRepository.save(userEntity)];
                    case 18:
                        _q.sent();
                        if (!remainingActiveDevices[0].id) return [3 /*break*/, 20];
                        return [4 /*yield*/, this.mfaDeviceRepository.update({ id: remainingActiveDevices[0].id }, { isPrimary: true })];
                    case 19:
                        _q.sent();
                        _q.label = 20;
                    case 20:
                        i = 1;
                        _q.label = 21;
                    case 21:
                        if (!(i < remainingActiveDevices.length)) return [3 /*break*/, 24];
                        if (!remainingActiveDevices[i].id) return [3 /*break*/, 23];
                        return [4 /*yield*/, this.mfaDeviceRepository.update({ id: remainingActiveDevices[i].id }, { isPrimary: false })];
                    case 22:
                        _q.sent();
                        _q.label = 23;
                    case 23:
                        i++;
                        return [3 /*break*/, 21];
                    case 24:
                        (_l = (_k = this.logger) === null || _k === void 0 ? void 0 : _k.log) === null || _l === void 0 ? void 0 : _l.call(_k, "Updated preferred MFA method to ".concat(newPreferredMethod, " after removing ").concat(normalizedMethod));
                        return [3 /*break*/, 27];
                    case 25: 
                    // No preferred method change needed, just update mfaMethods
                    return [4 /*yield*/, this.userRepository.save(userEntity)];
                    case 26:
                        // No preferred method change needed, just update mfaMethods
                        _q.sent();
                        _q.label = 27;
                    case 27:
                        if (!(deletedCount > 0 && this.auditService && this.clientInfoService)) return [3 /*break*/, 31];
                        _q.label = 28;
                    case 28:
                        _q.trys.push([28, 30, , 31]);
                        user_2 = userEntity;
                        return [4 /*yield*/, ((_m = this.auditService) === null || _m === void 0 ? void 0 : _m.recordEvent({
                                userId: user_2.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_DEVICE_REMOVED,
                                eventStatus: 'INFO',
                                metadata: {
                                    method: normalizedMethod,
                                    deletedCount: deletedCount,
                                    remainingDevices: remainingActiveDevices.length,
                                    mfaDisabled: mfaDisabled,
                                },
                                // Client info automatically included from context
                            }))];
                    case 29:
                        _q.sent();
                        return [3 /*break*/, 31];
                    case 30:
                        auditError_2 = _q.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_p = (_o = this.logger) === null || _o === void 0 ? void 0 : _o.error) === null || _p === void 0 ? void 0 : _p.call(_o, "Failed to record MFA_DEVICE_REMOVED audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: user.id,
                            method: normalizedMethod,
                        });
                        return [3 /*break*/, 31];
                    case 31: return [2 /*return*/, { deletedCount: deletedCount, mfaDisabled: mfaDisabled }];
                }
            });
        });
    };
    /**
     * Set preferred MFA method for a user
     *
     * Updates the user's preferred MFA method and device primary flags.
     * Validates that the method is configured for the user before setting it as preferred.
     *
     * This method encapsulates all database operations related to preferred method updates,
     * ensuring the consumer app doesn't need to directly manipulate nauth_* tables.
     *
     * @param dto - Request DTO with user sub and method type
     * @returns Response DTO with success message
     * @throws {NAuthException} If user not found, invalid method type, or method not configured
     *
     * @example
     * ```typescript
     * // Consumer app controller
     * @Put('mfa/preferred')
     * async setPreferredMFAMethod(@CurrentUser() user: IUser, @Body() body: { method: string }) {
     *   return await this.mfaService.setPreferredMethod({ userSub: user.sub, methodType: body.method });
     * }
     * ```
     */
    MFAService.prototype.setPreferredMethod = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var validMethods, normalizedMethod, userEntity, userId, user, devicesResult, preferredDevice, activeDevices, _i, activeDevices_1, device, previousMethod, auditError_3, errorMessage;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        validMethods = [mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.PASSKEY];
                        normalizedMethod = dto.methodType.toLowerCase();
                        if (!validMethods.includes(normalizedMethod)) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Invalid MFA method: ".concat(dto.methodType, ". Valid methods are: ").concat(validMethods.join(', ')));
                        }
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.userSub } })];
                    case 1:
                        userEntity = _f.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        userId = userEntity.id;
                        if (!userId) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'User entity missing internal ID');
                        }
                        user = userEntity;
                        return [4 /*yield*/, this.getUserDevices({ sub: dto.userSub })];
                    case 2:
                        devicesResult = _f.sent();
                        preferredDevice = devicesResult.devices.find(function (d) { return d.type === normalizedMethod && d.isActive; });
                        if (!preferredDevice) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "MFA method '".concat(normalizedMethod, "' is not configured for this user"));
                        }
                        // Update user's preferred method directly via repository
                        return [4 /*yield*/, this.userRepository.update({ id: userId }, {
                                preferredMfaMethod: normalizedMethod,
                            })];
                    case 3:
                        // Update user's preferred method directly via repository
                        _f.sent();
                        activeDevices = devicesResult.devices.filter(function (d) { return d.isActive; });
                        _i = 0, activeDevices_1 = activeDevices;
                        _f.label = 4;
                    case 4:
                        if (!(_i < activeDevices_1.length)) return [3 /*break*/, 7];
                        device = activeDevices_1[_i];
                        return [4 /*yield*/, this.mfaDeviceRepository.update({ id: device.id }, { isPrimary: device.id === preferredDevice.id })];
                    case 5:
                        _f.sent();
                        _f.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Device ".concat(preferredDevice.id, " set as primary for user ").concat(dto.userSub));
                        if (!(this.auditService && this.clientInfoService)) return [3 /*break*/, 11];
                        _f.label = 8;
                    case 8:
                        _f.trys.push([8, 10, , 11]);
                        previousMethod = userEntity.preferredMfaMethod;
                        return [4 /*yield*/, ((_c = this.auditService) === null || _c === void 0 ? void 0 : _c.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_PREFERRED_METHOD_UPDATED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    previousMethod: previousMethod || null,
                                    newMethod: normalizedMethod,
                                    deviceId: preferredDevice.id,
                                },
                            }))];
                    case 9:
                        _f.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        auditError_3 = _f.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.call(_d, "Failed to record MFA_PREFERRED_METHOD_UPDATED audit event: ".concat(errorMessage), {
                            error: auditError_3,
                            userId: user.id,
                            method: normalizedMethod,
                        });
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/, {
                            message: 'Preferred method updated',
                        }];
                }
            });
        });
    };
    /**
     * Grant or revoke a user's exemption from multi-factor authentication (MFA) requirements.
     *
     * SECURITY: This admin-only operation updates the user's MFA exemption status, logs the action,
     * and records an audit event. MFA exemption bypasses MFA at login, but all other security controls remain enforced.
     *
     * @param dto - Request DTO with user sub, exempt flag, reason, and grantedBy
     * @returns Response DTO with updated exemption fields
     * @throws {NAuthException} If the user is not found
     *
     * @example
     * ```typescript
     * // Grant MFA exemption
     * await mfaService.setMFAExemption({
     *   userSub: 'user-uuid',
     *   exempt: true,
     *   reason: 'Business partner requires MFA bypass',
     *   grantedBy: 'admin@example.com'
     * });
     *
     * // Revoke MFA exemption
     * await mfaService.setMFAExemption({
     *   userSub: 'user-uuid',
     *   exempt: false,
     *   reason: 'MFA now mandatory for this user',
     *   grantedBy: 'admin@example.com'
     * });
     * ```
     */
    MFAService.prototype.setMFAExemption = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userEntity, user, updateFields, auditError_4, errorMessage, exemptionData;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.userSub } })];
                    case 1:
                        userEntity = _g.sent();
                        if (!userEntity) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        user = userEntity;
                        updateFields = {
                            mfaExempt: dto.exempt,
                            mfaExemptReason: dto.reason || null,
                            mfaExemptGrantedAt: dto.exempt ? new Date() : null,
                            mfaExemptGrantedBy: dto.exempt ? dto.grantedBy || null : null,
                        };
                        // If revoking exemption and MFA is required, check if user needs to set up MFA
                        // Note: This is just for logging - actual MFA setup requirement is checked by state machine on next login
                        if (!dto.exempt && userEntity.mfaExempt === true && !userEntity.mfaEnabled) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "MFA exemption revoked for user ".concat(dto.userSub, " - MFA setup will be required on next login"));
                        }
                        // Update user in database
                        return [4 /*yield*/, this.userRepository.update(userEntity.id, updateFields)];
                    case 2:
                        // Update user in database
                        _g.sent();
                        // Log the exemption change for audit trail
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "MFA exemption ".concat(dto.exempt ? 'granted' : 'revoked', " for user ").concat(dto.userSub), {
                            userSub: dto.userSub,
                            exempt: dto.exempt,
                            reason: dto.reason || 'No reason provided',
                            grantedBy: dto.grantedBy || 'System',
                            timestamp: new Date().toISOString(),
                        });
                        if (!(this.auditService && this.clientInfoService)) return [3 /*break*/, 6];
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.auditService.recordEvent({
                                userId: user.id,
                                eventType: dto.exempt ? auth_audit_event_type_enum_1.AuthAuditEventType.MFA_EXEMPTION_GRANTED : auth_audit_event_type_enum_1.AuthAuditEventType.MFA_EXEMPTION_REVOKED,
                                eventStatus: 'INFO',
                                performedBy: dto.grantedBy || null,
                                // Client info automatically included from context
                                reason: dto.reason || null,
                                metadata: {
                                    previousExemptStatus: userEntity.mfaExempt,
                                    newExemptStatus: dto.exempt,
                                },
                            })];
                    case 4:
                        _g.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_4 = _g.sent();
                        errorMessage = auditError_4 instanceof Error ? auditError_4.message : 'Unknown error';
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.call(_e, "Failed to record MFA exemption audit event: ".concat(errorMessage), {
                            error: auditError_4,
                            userId: user.id,
                        });
                        return [3 /*break*/, 6];
                    case 6: return [4 /*yield*/, this.userRepository.findOne({
                            where: { id: userEntity.id },
                            select: ['mfaExempt', 'mfaExemptReason', 'mfaExemptGrantedAt'],
                        })];
                    case 7:
                        exemptionData = _g.sent();
                        if (!exemptionData) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found after update');
                        }
                        return [2 /*return*/, {
                                mfaExempt: exemptionData.mfaExempt || false,
                                mfaExemptReason: exemptionData.mfaExemptReason || null,
                                mfaExemptGrantedAt: exemptionData.mfaExemptGrantedAt || null,
                            }];
                }
            });
        });
    };
    /**
     * Get MFA setup data during MFA_SETUP_REQUIRED challenge
     *
     * Returns provider-specific setup data:
     * - TOTP: { secret, qrCode, manualEntryKey }
     * - SMS: { maskedPhone } or error if phone required
     * - Passkey: WebAuthn registration options
     *
     * @param dto - Request DTO with session token, method, and optional setup data
     * @returns Response DTO with provider-specific setup data
     * @throws {NAuthException} INVALID_CHALLENGE_SESSION | VALIDATION_FAILED | PHONE_REQUIRED
     *
     * @example
     * ```typescript
     * const result = await mfaService.getSetupData({
     *   session: 'session-token',
     *   method: 'totp'
     * });
     * // Returns: { setupData: { secret: '...', qrCode: '...', manualEntryKey: '...' } }
     *
     * const result = await mfaService.getSetupData({
     *   session: 'session-token',
     *   method: 'sms',
     *   setupData: { phoneNumber: '+1234567890' }
     * });
     * // Returns: { setupData: { maskedPhone: '***-***-7890' } }
     * ```
     */
    MFAService.prototype.getSetupData = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var challengeSession, user, provider, result;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!this.challengeService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Challenge service is not available');
                        }
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "Getting MFA setup data: session=".concat(dto.session, ", method=").concat(dto.method));
                        return [4 /*yield*/, this.challengeService.validateSession(dto.session)];
                    case 1:
                        challengeSession = _e.sent();
                        if (challengeSession.challengeName !== auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Cannot get setup data: expected MFA_SETUP_REQUIRED challenge, got ".concat(challengeSession.challengeName));
                        }
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Challenge session has no associated user');
                        }
                        provider = this.getProvider(dto.method);
                        return [4 /*yield*/, provider.setup(user, dto.setupData)];
                    case 2:
                        result = _e.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "MFA setup data generated: method=".concat(dto.method, ", user=").concat(user.sub));
                        return [2 /*return*/, {
                                setupData: result,
                            }];
                }
            });
        });
    };
    /**
     * Get MFA challenge data during MFA_REQUIRED challenge
     *
     * Currently only used for passkey authentication to get WebAuthn options.
     * SMS/TOTP codes are sent automatically when the challenge is created.
     *
     * @param dto - Request DTO with session token and method
     * @returns Response DTO with provider-specific challenge data
     * @throws {NAuthException} INVALID_CHALLENGE_SESSION | VALIDATION_FAILED
     *
     * @example
     * ```typescript
     * const result = await mfaService.getChallengeData({
     *   session: 'session-token',
     *   method: 'passkey'
     * });
     * // Returns: { challengeData: { challenge: '...', allowCredentials: [...], ... } }
     * ```
     */
    MFAService.prototype.getChallengeData = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var challengeSession, user, provider, challengeData, passkeyOptions, passkeyChallenge;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        if (!this.challengeService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Challenge service is not available');
                        }
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "Getting MFA challenge data: session=".concat(dto.session, ", method=").concat(dto.method));
                        return [4 /*yield*/, this.challengeService.validateSession(dto.session)];
                    case 1:
                        challengeSession = _h.sent();
                        if (challengeSession.challengeName !== auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Cannot get challenge data: expected MFA_REQUIRED challenge, got ".concat(challengeSession.challengeName));
                        }
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Challenge session has no associated user');
                        }
                        provider = this.getProvider(dto.method);
                        if (!provider.sendChallenge) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "MFA method '".concat(dto.method, "' does not support challenge data generation"));
                        }
                        return [4 /*yield*/, provider.sendChallenge(user)];
                    case 2:
                        challengeData = _h.sent();
                        if (!(dto.method === 'passkey')) return [3 /*break*/, 4];
                        passkeyOptions = challengeData;
                        passkeyChallenge = (_c = passkeyOptions.options) === null || _c === void 0 ? void 0 : _c.challenge;
                        if (!passkeyChallenge) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.challengeService.updateMetadata(dto.session, {
                                passkeyChallenge: passkeyChallenge,
                            })];
                    case 3:
                        _h.sent();
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.debug) === null || _e === void 0 ? void 0 : _e.call(_d, "Passkey challenge stored in session metadata: user=".concat(user.sub));
                        _h.label = 4;
                    case 4:
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "MFA challenge data generated: method=".concat(dto.method, ", user=").concat(user.sub));
                        return [2 /*return*/, {
                                challengeData: challengeData,
                            }];
                }
            });
        });
    };
    return MFAService;
}());
exports.MFAService = MFAService;
