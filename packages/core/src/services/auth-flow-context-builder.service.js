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
exports.AuthFlowContextBuilder = void 0;
/**
 * Authentication Flow Context Builder
 *
 * Pre-computes all derived values needed for state machine rule evaluation.
 * This optimization ensures values are calculated once at the beginning of the flow,
 * rather than repeatedly during rule evaluation.
 *
 * @example
 * ```typescript
 * const context = await contextBuilder.build({
 *   user,
 *   config,
 *   authMethod: 'password',
 *   deviceToken: 'abc123'
 * });
 * ```
 */
var AuthFlowContextBuilder = /** @class */ (function () {
    function AuthFlowContextBuilder(trustedDeviceService, adaptiveMFADecisionService, _clientInfoService, // Reserved for future use (not stored as property)
    logger) {
        this.trustedDeviceService = trustedDeviceService;
        this.adaptiveMFADecisionService = adaptiveMFADecisionService;
        this.logger = logger;
    }
    /**
     * Build authentication flow context with pre-computed values
     *
     * @param params - Context parameters
     * @param params.user - User attempting authentication
     * @param params.config - Authentication configuration
     * @param params.authMethod - Authentication method ('password' or 'social')
     * @param params.authProvider - Social auth provider name (e.g., 'google', 'apple')
     * @param params.deviceToken - Device token for trusted device check
     * @param params.skipMFAVerification - Skip MFA verification flag
     * @returns Authentication flow context with computed values
     *
     * @example
     * ```typescript
     * const context = await contextBuilder.build({
     *   user,
     *   config,
     *   authMethod: 'password',
     *   deviceToken: 'abc123'
     * });
     * ```
     */
    AuthFlowContextBuilder.prototype.build = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var user, config, authMethod, authProvider, deviceToken, skipMFAVerification, isEmailVerificationRequired, isPhoneVerificationRequired, isPhoneCollectionNeeded, isMFAExempt, isMFASetupRequired, isDeviceTrusted, gracePeriodData, blockData, mfaVerificationData, computed;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        user = params.user, config = params.config, authMethod = params.authMethod, authProvider = params.authProvider, deviceToken = params.deviceToken, skipMFAVerification = params.skipMFAVerification;
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "[ContextBuilder] Building context for user ".concat(user.sub, " (authMethod=").concat(authMethod || 'password', ", mfaEnabled=").concat(user.mfaEnabled, ", mfaExempt=").concat(user.mfaExempt || false, ")"));
                        isEmailVerificationRequired = this.isEmailVerificationRequired(user, config, authMethod);
                        isPhoneVerificationRequired = this.isPhoneVerificationRequired(user, config, authMethod);
                        isPhoneCollectionNeeded = this.isPhoneCollectionNeeded(user, config, authMethod);
                        isMFAExempt = this.checkMFAExempt(user);
                        isMFASetupRequired = this.isMFASetupRequired(user, config, authMethod);
                        return [4 /*yield*/, this.checkDeviceTrust(user, deviceToken, config)];
                    case 1:
                        isDeviceTrusted = _e.sent();
                        gracePeriodData = this.calculateGracePeriod(user, config);
                        return [4 /*yield*/, this.checkBlocked(user)];
                    case 2:
                        blockData = _e.sent();
                        return [4 /*yield*/, this.checkMFAVerification(user, config, authMethod, deviceToken, isDeviceTrusted, skipMFAVerification)];
                    case 3:
                        mfaVerificationData = _e.sent();
                        computed = {
                            isEmailVerificationRequired: isEmailVerificationRequired,
                            isPhoneVerificationRequired: isPhoneVerificationRequired,
                            isPhoneCollectionNeeded: isPhoneCollectionNeeded,
                            isMFAExempt: isMFAExempt,
                            isMFASetupRequired: isMFASetupRequired,
                            isMFAVerificationRequired: mfaVerificationData.required,
                            isDeviceTrusted: isDeviceTrusted,
                            isGracePeriodActive: gracePeriodData.isActive,
                            gracePeriodEndsAt: gracePeriodData.endsAt,
                            isBlocked: blockData.blocked,
                            blockedUntil: blockData.until,
                            blockReason: blockData.reason,
                            riskScore: mfaVerificationData.riskScore,
                            riskLevel: mfaVerificationData.riskLevel,
                        };
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "[ContextBuilder] Computed values: emailReq=".concat(computed.isEmailVerificationRequired, ", phoneReq=").concat(computed.isPhoneVerificationRequired, ", phoneCollect=").concat(computed.isPhoneCollectionNeeded, ", mfaExempt=").concat(computed.isMFAExempt, ", mfaSetupReq=").concat(computed.isMFASetupRequired, ", mfaVerifyReq=").concat(computed.isMFAVerificationRequired, ", trusted=").concat(computed.isDeviceTrusted, ", gracePeriod=").concat(computed.isGracePeriodActive, ", blocked=").concat(computed.isBlocked));
                        return [2 /*return*/, {
                                user: user,
                                config: config,
                                authMethod: authMethod,
                                authProvider: authProvider,
                                deviceToken: deviceToken,
                                skipMFAVerification: skipMFAVerification,
                                computed: computed,
                            }];
                }
            });
        });
    };
    /**
     * Check if email verification is required
     *
     * @param user - User to check
     * @param config - Auth configuration
     * @param authMethod - Authentication method
     * @returns True if email verification is required
     */
    AuthFlowContextBuilder.prototype.isEmailVerificationRequired = function (user, config, authMethod) {
        var _a;
        var verificationMethod = ((_a = config.signup) === null || _a === void 0 ? void 0 : _a.verificationMethod) || 'email';
        // Email verification not required if verification is disabled
        if (verificationMethod === 'none' || verificationMethod === 'phone') {
            return false;
        }
        // Social auth users have email pre-verified by OAuth provider
        if (authMethod === 'social') {
            return false;
        }
        // Check if email is already verified
        if (user.isEmailVerified) {
            return false;
        }
        // Email verification required for 'email' or 'both' methods
        return verificationMethod === 'email' || verificationMethod === 'both';
    };
    /**
     * Check if phone verification is required
     *
     * @param user - User to check
     * @param config - Auth configuration
     * @param authMethod - Authentication method
     * @returns True if phone verification is required
     */
    AuthFlowContextBuilder.prototype.isPhoneVerificationRequired = function (user, config, _authMethod) {
        var _a;
        var verificationMethod = ((_a = config.signup) === null || _a === void 0 ? void 0 : _a.verificationMethod) || 'email';
        // Phone verification not required if verification is disabled or email-only
        if (verificationMethod === 'none' || verificationMethod === 'email') {
            return false;
        }
        // Phone verification required for 'phone' or 'both' methods
        // But only if user has a phone number
        if (verificationMethod === 'phone' || verificationMethod === 'both') {
            // If user has no phone, phone collection is needed first (handled separately)
            if (!user.phone) {
                return false; // Phone collection needed, not verification
            }
            // Check if phone is already verified
            return !user.isPhoneVerified;
        }
        return false;
    };
    /**
     * Check if phone collection is needed
     *
     * @param user - User to check
     * @param config - Auth configuration
     * @param _authMethod - Authentication method (unused, kept for API consistency)
     * @returns True if phone collection is needed
     */
    AuthFlowContextBuilder.prototype.isPhoneCollectionNeeded = function (user, config, _authMethod) {
        var _a;
        var verificationMethod = ((_a = config.signup) === null || _a === void 0 ? void 0 : _a.verificationMethod) || 'email';
        // Phone collection not needed if verification is disabled or email-only
        if (verificationMethod === 'none' || verificationMethod === 'email') {
            return false;
        }
        // Phone collection needed for 'phone' or 'both' methods if user has no phone
        if ((verificationMethod === 'phone' || verificationMethod === 'both') && !user.phone) {
            return true;
        }
        return false;
    };
    /**
     * Check if user is exempt from MFA
     *
     * @param user - User to check
     * @returns True if user is exempt from MFA
     */
    AuthFlowContextBuilder.prototype.checkMFAExempt = function (user) {
        var mfaExempt = user.mfaExempt;
        // Handle different database representations (boolean true, MySQL tinyint 1, etc.)
        return mfaExempt === true || mfaExempt === 1;
    };
    /**
     * Check if MFA setup is required
     *
     * @param user - User to check
     * @param config - Auth configuration
     * @param authMethod - Authentication method
     * @returns True if MFA setup is required
     */
    AuthFlowContextBuilder.prototype.isMFASetupRequired = function (user, config, authMethod) {
        var _a, _b;
        // Check exemption first
        if (this.checkMFAExempt(user)) {
            return false;
        }
        // MFA not enabled in config
        if (!((_a = config.mfa) === null || _a === void 0 ? void 0 : _a.enabled)) {
            return false;
        }
        // User already has MFA enabled
        if (user.mfaEnabled) {
            return false;
        }
        // Social login exemption
        if (authMethod === 'social' && config.mfa.requireForSocialLogin === false) {
            return false;
        }
        // Check enforcement policy
        var enforcement = config.mfa.enforcement || 'OPTIONAL';
        if (enforcement === 'OPTIONAL') {
            return false;
        }
        // REQUIRED or ADAPTIVE: Check grace period
        var gracePeriod = (_b = config.mfa.gracePeriod) !== null && _b !== void 0 ? _b : 7;
        var gracePeriodData = this.calculateGracePeriod(user, config);
        // If grace period is 0, MFA setup is required immediately
        if (gracePeriod === 0) {
            return true;
        }
        // If grace period is active, MFA setup is optional
        if (gracePeriodData.isActive) {
            return false;
        }
        // Grace period expired - MFA setup required
        return true;
    };
    /**
     * Check if device is trusted
     *
     * @param user - User to check
     * @param deviceToken - Device token
     * @param config - Auth configuration
     * @returns True if device is trusted
     */
    AuthFlowContextBuilder.prototype.checkDeviceTrust = function (user, deviceToken, config) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, error_1, errorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!deviceToken ||
                            !((_a = config === null || config === void 0 ? void 0 : config.mfa) === null || _a === void 0 ? void 0 : _a.rememberDevices) ||
                            config.mfa.rememberDevices === 'never' ||
                            !this.trustedDeviceService) {
                            return [2 /*return*/, false];
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.trustedDeviceService.validateDeviceToken(deviceToken, user.id)];
                    case 2:
                        validation = _d.sent();
                        return [2 /*return*/, validation.isValid];
                    case 3:
                        error_1 = _d.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.warn) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to check device trust: ".concat(errorMessage), { error: error_1, userId: user.id });
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate grace period status
     *
     * @param user - User to check
     * @param config - Auth configuration
     * @returns Grace period status
     */
    AuthFlowContextBuilder.prototype.calculateGracePeriod = function (user, config) {
        var _a, _b;
        var gracePeriod = (_b = (_a = config.mfa) === null || _a === void 0 ? void 0 : _a.gracePeriod) !== null && _b !== void 0 ? _b : 7;
        // No grace period
        if (gracePeriod === 0) {
            return { isActive: false };
        }
        // Access createdAt from user interface
        var userWithDates = user;
        var createdAt = userWithDates.createdAt;
        if (!createdAt) {
            // No creation date - grace period not active
            return { isActive: false };
        }
        var gracePeriodEnd = new Date(createdAt);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);
        var now = new Date();
        var isActive = now < gracePeriodEnd;
        return {
            isActive: isActive,
            endsAt: isActive ? gracePeriodEnd : undefined,
        };
    };
    /**
     * Check if user is blocked
     *
     * @param user - User to check
     * @returns Block status
     */
    AuthFlowContextBuilder.prototype.checkBlocked = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var blockStatus, error_2, errorMessage;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.adaptiveMFADecisionService) {
                            return [2 /*return*/, { blocked: false }];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.adaptiveMFADecisionService.isUserBlocked(user.id)];
                    case 2:
                        blockStatus = _c.sent();
                        return [2 /*return*/, {
                                blocked: blockStatus.blocked,
                                until: blockStatus.expiresAt,
                                reason: blockStatus.message,
                            }];
                    case 3:
                        error_2 = _c.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to check user block status: ".concat(errorMessage), { error: error_2, userId: user.id });
                        return [2 /*return*/, { blocked: false }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if MFA verification is required
     *
     * @param user - User to check
     * @param config - Auth configuration
     * @param authMethod - Authentication method
     * @param deviceToken - Device token
     * @param isDeviceTrusted - Whether device is trusted
     * @param skipMFAVerification - Skip MFA verification flag
     * @returns MFA verification requirement and risk data
     */
    AuthFlowContextBuilder.prototype.checkMFAVerification = function (user, config, authMethod, _deviceToken, // Reserved for future use
    isDeviceTrusted, skipMFAVerification) {
        return __awaiter(this, void 0, void 0, function () {
            var enforcement, decision, error_3, errorMessage;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        // Skip if flag is set
                        if (skipMFAVerification) {
                            return [2 /*return*/, { required: false }];
                        }
                        // Check exemption first
                        if (this.checkMFAExempt(user)) {
                            return [2 /*return*/, { required: false }];
                        }
                        // MFA not enabled in config
                        if (!((_a = config.mfa) === null || _a === void 0 ? void 0 : _a.enabled)) {
                            return [2 /*return*/, { required: false }];
                        }
                        // User doesn't have MFA enabled
                        if (!user.mfaEnabled) {
                            return [2 /*return*/, { required: false }];
                        }
                        // Social login exemption
                        if (authMethod === 'social' && config.mfa.requireForSocialLogin === false) {
                            return [2 /*return*/, { required: false }];
                        }
                        enforcement = config.mfa.enforcement || 'OPTIONAL';
                        // ============================================================================
                        // OPTIONAL Enforcement: Setup is optional, but if user has MFA enabled,
                        // it must be used (unless trusted device bypass applies)
                        // ============================================================================
                        if (enforcement === 'OPTIONAL') {
                            // OPTIONAL means setup is optional, but once enabled, MFA is required
                            // Check if trusted device bypass applies
                            if (isDeviceTrusted &&
                                config.mfa.rememberDevices &&
                                config.mfa.rememberDevices !== 'never' &&
                                config.mfa.bypassMFAForTrustedDevices === true) {
                                return [2 /*return*/, { required: false }];
                            }
                            // User has MFA enabled - require it
                            return [2 /*return*/, { required: true }];
                        }
                        // Trusted device bypass (for REQUIRED enforcement, not ADAPTIVE)
                        if (enforcement === 'REQUIRED' &&
                            isDeviceTrusted &&
                            config.mfa.rememberDevices &&
                            config.mfa.rememberDevices !== 'never' &&
                            config.mfa.bypassMFAForTrustedDevices === true) {
                            return [2 /*return*/, { required: false }];
                        }
                        if (!(enforcement === 'ADAPTIVE')) return [3 /*break*/, 4];
                        if (!this.adaptiveMFADecisionService) {
                            // Service not available - fall back to REQUIRED behavior
                            (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.warn) === null || _c === void 0 ? void 0 : _c.call(_b, "ADAPTIVE enforcement enabled but AdaptiveMFADecisionService not available - falling back to REQUIRED behavior for user ".concat(user.sub));
                            return [2 /*return*/, { required: true }];
                        }
                        // For ADAPTIVE, untrusted devices always require MFA
                        if (!isDeviceTrusted) {
                            return [2 /*return*/, { required: true }];
                        }
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.adaptiveMFADecisionService.evaluateAdaptiveMFA(user, authMethod || 'password')];
                    case 2:
                        decision = _f.sent();
                        return [2 /*return*/, {
                                required: decision.action === 'require_mfa',
                                riskScore: decision.riskScore,
                                riskLevel: decision.riskLevel,
                            }];
                    case 3:
                        error_3 = _f.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.warn) === null || _e === void 0 ? void 0 : _e.call(_d, "Failed to evaluate adaptive MFA: ".concat(errorMessage), { error: error_3, userId: user.id });
                        // Fall back to requiring MFA on error (safer)
                        return [2 /*return*/, { required: true }];
                    case 4: 
                    // REQUIRED enforcement
                    return [2 /*return*/, { required: true }];
                }
            });
        });
    };
    return AuthFlowContextBuilder;
}());
exports.AuthFlowContextBuilder = AuthFlowContextBuilder;
