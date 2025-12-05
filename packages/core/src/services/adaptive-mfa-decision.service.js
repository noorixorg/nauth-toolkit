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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveMFADecisionService = void 0;
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
/**
 * Adaptive MFA Decision Service
 *
 * Makes context-aware MFA requirement decisions based on risk analysis.
 * Supports multiple actions (allow, require_mfa, block_signin) based on risk level.
 *
 * **Decision Flow:**
 * 1. Detect risk factors (via RiskDetectionService)
 * 2. Calculate risk score (via RiskScoringService)
 * 3. Determine risk level and action from configuration
 * 4. Call lifecycle hooks if notifyUser is true
 * 5. Record audit event (non-blocking)
 * 6. Return decision object
 *
 * **Default Risk Levels:**
 * - Low (0-20): action 'allow', notifyUser false
 * - Medium (21-50): action 'require_mfa', notifyUser true
 * - High (51-100): action 'require_mfa', notifyUser true (conservative default)
 *
 * **User Blocking:**
 * When action is 'block_signin', user is blocked in storage adapter with optional TTL.
 * Block status is checked before evaluation to prevent blocked users from attempting sign-in.
 *
 * @example
 * ```typescript
 * const decision = await adaptiveMFADecisionService.evaluateAdaptiveMFA(user, 'password');
 * if (decision.action === 'block_signin') {
 *   throw new NAuthException(AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK, 'Sign-in blocked');
 * }
 * return decision.action === 'require_mfa';
 * ```
 */
var AdaptiveMFADecisionService = /** @class */ (function () {
    function AdaptiveMFADecisionService(riskDetectionService, riskScoringService, storageAdapter, clientInfoService, config, logger, auditService) {
        this.riskDetectionService = riskDetectionService;
        this.riskScoringService = riskScoringService;
        this.storageAdapter = storageAdapter;
        this.clientInfoService = clientInfoService;
        this.config = config;
        this.logger = logger;
        this.auditService = auditService;
        /**
         * Default risk level configuration
         *
         * Conservative defaults that prioritize security:
         * - Low risk: Allow without MFA (normal flow)
         * - Medium risk: Require MFA
         * - High risk: Require MFA (conservative - don't block by default)
         */
        this.defaultRiskLevels = {
            low: {
                maxScore: 20,
                action: 'allow',
                notifyUser: false,
            },
            medium: {
                maxScore: 50,
                action: 'require_mfa',
                notifyUser: true,
            },
            high: {
                maxScore: 100,
                action: 'require_mfa', // Conservative default (don't block)
                notifyUser: true,
            },
        };
    }
    /**
     * Evaluate adaptive MFA requirement with risk-based actions
     *
     * Main entry point for adaptive MFA evaluation. Analyzes current login context,
     * calculates risk score, determines action, and calls lifecycle hooks.
     *
     * @param user - User being authenticated
     * @param authMethod - Authentication method ('password', 'google', 'apple', etc.)
     * @returns Decision object with action, risk details, and hook override status
     *
     * @example
     * ```typescript
     * const decision = await adaptiveMFADecisionService.evaluateAdaptiveMFA(user, 'password');
     * if (decision.action === 'block_signin') {
     *   // Handle blocking
     * }
     * ```
     */
    AdaptiveMFADecisionService.prototype.evaluateAdaptiveMFA = function (user, authMethod) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, riskFactors, riskScore, riskLevels, _a, level, action, notifyUser, payload, hookOverride, result, error_1, errorMessage;
            var _this = this;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        // Validate email is present (required by IUser interface but runtime check for safety)
                        if (!user.email) {
                            (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "User ".concat(user.sub, " missing email - cannot evaluate adaptive MFA"), {
                                userId: user.id,
                                userSub: user.sub,
                            });
                            throw new Error("User email is required for adaptive MFA evaluation");
                        }
                        clientInfo = this.clientInfoService.get();
                        return [4 /*yield*/, this.riskDetectionService.detectRiskFactors(user, clientInfo)];
                    case 1:
                        riskFactors = _p.sent();
                        riskScore = this.riskScoringService.calculateRiskScore(riskFactors);
                        riskLevels = ((_e = (_d = this.config.mfa) === null || _d === void 0 ? void 0 : _d.adaptive) === null || _e === void 0 ? void 0 : _e.riskLevels) || this.defaultRiskLevels;
                        _a = this.determineRiskLevelAndAction(riskScore, riskLevels), level = _a.level, action = _a.action, notifyUser = _a.notifyUser;
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.log) === null || _g === void 0 ? void 0 : _g.call(_f, "Adaptive MFA evaluation: user=".concat(user.sub, ", score=").concat(riskScore, ", level=").concat(level, ", action=").concat(action, ", notify=").concat(notifyUser, ", factors=[").concat(riskFactors.join(', '), "]"));
                        payload = {
                            user: {
                                sub: user.sub,
                                email: user.email, // Safe after validation above
                                username: user.username || undefined,
                                phoneNumber: user.phone || undefined,
                            },
                            riskScore: riskScore,
                            riskLevel: level,
                            riskFactors: riskFactors,
                            action: action,
                            clientInfo: {
                                ipAddress: clientInfo.ipAddress,
                                ipCountry: clientInfo.ipCountry,
                                ipCity: clientInfo.ipCity,
                                deviceId: clientInfo.deviceToken, // deviceToken maps to deviceId in sessions
                                deviceName: clientInfo.deviceName,
                                deviceType: clientInfo.deviceType,
                                userAgent: clientInfo.userAgent,
                                platform: clientInfo.platform,
                                browser: clientInfo.browser,
                            },
                            authMethod: authMethod,
                            timestamp: new Date(),
                        };
                        hookOverride = false;
                        if (!(notifyUser && ((_h = this.config.hooks) === null || _h === void 0 ? void 0 : _h.onAdaptiveMFATriggered))) return [3 /*break*/, 5];
                        _p.label = 2;
                    case 2:
                        _p.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.config.hooks.onAdaptiveMFATriggered(payload)];
                    case 3:
                        result = _p.sent();
                        // Hook can return false to override and allow sign-in
                        if (result === false) {
                            hookOverride = true;
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.warn) === null || _k === void 0 ? void 0 : _k.call(_j, "Adaptive MFA action overridden by hook: user=".concat(user.sub));
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _p.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.error) === null || _m === void 0 ? void 0 : _m.call(_l, "Adaptive MFA hook failed: ".concat(errorMessage), { error: error_1, userId: user.sub });
                        return [3 /*break*/, 5];
                    case 5:
                        // Record in audit trail (non-blocking)
                        // This logs the login attempt with risk assessment, before final outcome
                        (_o = this.auditService) === null || _o === void 0 ? void 0 : _o.recordEvent({
                            userId: user.id,
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_ATTEMPT,
                            eventStatus: action === 'block_signin' ? 'FAILURE' : 'INFO',
                            riskFactor: riskScore,
                            riskFactors: riskFactors,
                            adaptiveMfaTriggered: action !== 'allow',
                            description: "Login attempt - Adaptive MFA: ".concat(action, " (score: ").concat(riskScore, ", level: ").concat(level, ")"),
                            authMethod: authMethod,
                            // Client info automatically included from context
                        }).catch(function (err) {
                            var _a, _b;
                            (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to record adaptive MFA audit: ".concat(err.message));
                        });
                        return [2 /*return*/, {
                                action: hookOverride ? 'allow' : action,
                                riskScore: riskScore,
                                riskLevel: level,
                                riskFactors: riskFactors,
                                notifyUser: notifyUser,
                                hookOverride: hookOverride,
                                // Include payload when action requires it or when notifyUser is true
                                // This ensures consistent clientInfo data for blockUserSignIn and audit logs
                                payload: action === 'block_signin' || notifyUser ? payload : undefined,
                            }];
                }
            });
        });
    };
    /**
     * Determine risk level and action based on score and configured thresholds
     *
     * Evaluates risk score against configured thresholds in order: low → medium → high.
     * Returns the first level that the score falls within.
     *
     * @param riskScore - Calculated risk score (0-100)
     * @param riskLevels - Configured risk level thresholds
     * @returns Risk level, action, and notifyUser flag
     * @private
     */
    AdaptiveMFADecisionService.prototype.determineRiskLevelAndAction = function (riskScore, riskLevels) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        // Check in order: low → medium → high
        if (riskScore <= ((_b = (_a = riskLevels.low) === null || _a === void 0 ? void 0 : _a.maxScore) !== null && _b !== void 0 ? _b : 20)) {
            return {
                level: 'low',
                action: (_d = (_c = riskLevels.low) === null || _c === void 0 ? void 0 : _c.action) !== null && _d !== void 0 ? _d : 'allow',
                notifyUser: (_f = (_e = riskLevels.low) === null || _e === void 0 ? void 0 : _e.notifyUser) !== null && _f !== void 0 ? _f : false,
            };
        }
        if (riskScore <= ((_h = (_g = riskLevels.medium) === null || _g === void 0 ? void 0 : _g.maxScore) !== null && _h !== void 0 ? _h : 50)) {
            return {
                level: 'medium',
                action: (_k = (_j = riskLevels.medium) === null || _j === void 0 ? void 0 : _j.action) !== null && _k !== void 0 ? _k : 'require_mfa',
                notifyUser: (_m = (_l = riskLevels.medium) === null || _l === void 0 ? void 0 : _l.notifyUser) !== null && _m !== void 0 ? _m : true,
            };
        }
        return {
            level: 'high',
            action: (_p = (_o = riskLevels.high) === null || _o === void 0 ? void 0 : _o.action) !== null && _p !== void 0 ? _p : 'require_mfa',
            notifyUser: (_r = (_q = riskLevels.high) === null || _q === void 0 ? void 0 : _q.notifyUser) !== null && _r !== void 0 ? _r : true,
        };
    };
    /**
     * Check if user is currently blocked due to high-risk sign-in
     *
     * Uses storage adapter to check for existing block. Block is stored with
     * key format: `adaptive_mfa_block:{userId}`.
     *
     * @param userId - Internal user ID (integer)
     * @returns Block status with expiration and message if blocked
     *
     * @example
     * ```typescript
     * const blockStatus = await adaptiveMFADecisionService.isUserBlocked(user.id);
     * if (blockStatus.blocked) {
     *   throw new NAuthException(AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK, blockStatus.message);
     * }
     * ```
     */
    AdaptiveMFADecisionService.prototype.isUserBlocked = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var blockKey, blockData, parsed, expiresAt, error_2, errorMessage;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        blockKey = "adaptive_mfa_block:".concat(userId);
                        return [4 /*yield*/, this.storageAdapter.get(blockKey)];
                    case 1:
                        blockData = _c.sent();
                        if (!blockData) {
                            return [2 /*return*/, { blocked: false }];
                        }
                        parsed = JSON.parse(blockData);
                        expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : undefined;
                        if (!(expiresAt && expiresAt < new Date())) return [3 /*break*/, 3];
                        // Block expired - clean up
                        return [4 /*yield*/, this.storageAdapter.del(blockKey)];
                    case 2:
                        // Block expired - clean up
                        _c.sent();
                        return [2 /*return*/, { blocked: false }];
                    case 3: return [2 /*return*/, {
                            blocked: true,
                            expiresAt: expiresAt,
                            message: parsed.message,
                        }];
                    case 4:
                        error_2 = _c.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to check user block status: ".concat(errorMessage), { error: error_2, userId: userId });
                        return [2 /*return*/, { blocked: false }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Block user sign-in due to high risk
     *
     * Stores block in storage adapter with optional TTL. Block data includes:
     * - userId, userSub (for reference)
     * - message (shown to user)
     * - riskScore, riskFactors (for audit)
     * - blockedAt, expiresAt (timestamps)
     *
     * Also calls onSignInBlocked lifecycle hook if configured.
     *
     * @param user - User to block
     * @param payload - Risk event payload with all context
     *
     * @example
     * ```typescript
     * await adaptiveMFADecisionService.blockUserSignIn(user, payload);
     * ```
     */
    AdaptiveMFADecisionService.prototype.blockUserSignIn = function (user, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var blockConfig, blockDuration, message, blockKey, blockData, ttl, blockedPayload, error_3, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        blockConfig = (_b = (_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.adaptive) === null || _b === void 0 ? void 0 : _b.blockedSignIn;
                        blockDuration = blockConfig === null || blockConfig === void 0 ? void 0 : blockConfig.blockDuration;
                        message = (blockConfig === null || blockConfig === void 0 ? void 0 : blockConfig.message) || 'Sign-in blocked due to suspicious activity. Please contact support.';
                        blockKey = "adaptive_mfa_block:".concat(user.id);
                        blockData = {
                            userId: user.id,
                            userSub: user.sub,
                            message: message,
                            riskScore: payload.riskScore,
                            riskFactors: payload.riskFactors,
                            blockedAt: new Date().toISOString(),
                            expiresAt: blockDuration ? new Date(Date.now() + blockDuration * 60 * 1000).toISOString() : undefined,
                        };
                        ttl = blockDuration ? blockDuration * 60 : undefined;
                        return [4 /*yield*/, this.storageAdapter.set(blockKey, JSON.stringify(blockData), ttl)];
                    case 1:
                        _h.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "User sign-in blocked: user=".concat(user.sub, ", score=").concat(payload.riskScore, ", duration=").concat(blockDuration ? "".concat(blockDuration, "min") : 'permanent'));
                        if (!((_e = this.config.hooks) === null || _e === void 0 ? void 0 : _e.onSignInBlocked)) return [3 /*break*/, 5];
                        blockedPayload = __assign(__assign({}, payload), { blockDuration: blockDuration, blockExpiresAt: blockDuration ? new Date(Date.now() + blockDuration * 60 * 1000) : undefined, message: message });
                        _h.label = 2;
                    case 2:
                        _h.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.config.hooks.onSignInBlocked(blockedPayload)];
                    case 3:
                        _h.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _h.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.error) === null || _g === void 0 ? void 0 : _g.call(_f, "Sign-in blocked hook failed: ".concat(errorMessage), { error: error_3, userId: user.sub });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clear user block (manual unblock)
     *
     * Removes the block from storage adapter, allowing user to sign in again.
     * Useful for admin actions or when risk situation has improved.
     *
     * @param userId - Internal user ID (integer)
     *
     * @example
     * ```typescript
     * await adaptiveMFADecisionService.clearUserBlock(user.id);
     * ```
     */
    AdaptiveMFADecisionService.prototype.clearUserBlock = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var blockKey, error_4, errorMessage;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        blockKey = "adaptive_mfa_block:".concat(userId);
                        return [4 /*yield*/, this.storageAdapter.del(blockKey)];
                    case 1:
                        _e.sent();
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "User block cleared: userId=".concat(userId));
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _e.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error';
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to clear user block: ".concat(errorMessage), { error: error_4, userId: userId });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return AdaptiveMFADecisionService;
}());
exports.AdaptiveMFADecisionService = AdaptiveMFADecisionService;
