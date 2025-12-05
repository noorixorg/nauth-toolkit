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
exports.BaseSocialAuthProviderService = void 0;
var crypto = require("crypto");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var dto_1 = require("../dto");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
/**
 * Base Social Auth Provider Service
 *
 * Abstract base class that provides common functionality for all social auth providers.
 * Provider-specific services (Google, Apple, Facebook, GitHub, etc.) should extend this class
 * and implement provider-specific OAuth client logic.
 *
 * This base class handles:
 * - User creation/lookup
 * - Social account linking
 * - JWT token generation
 * - Session management
 * - Challenge system integration
 *
 * **Key Design:**
 * - No hardcoded provider names - works with any provider
 * - Provider config accessed dynamically via `providerName`
 * - Future developers can add new providers without modifying this class
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class GitHubSocialAuthService extends BaseSocialAuthProviderService {
 *   readonly providerName = 'github';
 *
 *   constructor(
 *     // ... dependencies
 *     private readonly githubOAuthClient: GitHubOAuthClient,
 *   ) {
 *     super(/* ... base dependencies *\/);
 *   }
 *
 *   protected async getOAuthProfile(code: string, state: string): Promise<OAuthUserProfile> {
 *     // Provider-specific implementation
 *   }
 * }
 * ```
 */
var BaseSocialAuthProviderService = /** @class */ (function () {
    function BaseSocialAuthProviderService(config, logger, authService, socialAuthService, jwtService, sessionService, challengeHelper, clientInfoService, 
    // State store for CSRF protection - shared across all providers
    stateStore, 
    // User repository for creating social users
    userRepository, 
    // Phone verification service (optional - only available when SMS provider is configured)
    phoneVerificationService, auditService) {
        this.config = config;
        this.logger = logger;
        this.authService = authService;
        this.socialAuthService = socialAuthService;
        this.jwtService = jwtService;
        this.sessionService = sessionService;
        this.challengeHelper = challengeHelper;
        this.clientInfoService = clientInfoService;
        this.stateStore = stateStore;
        this.userRepository = userRepository;
        this.phoneVerificationService = phoneVerificationService;
        this.auditService = auditService;
    }
    /**
     * Get provider configuration dynamically
     *
     * Accesses config.social[providerName] without hardcoding provider names.
     * This allows any provider to work without modifying core code.
     *
     * @returns Provider configuration from NAuthConfig
     * @protected
     */
    BaseSocialAuthProviderService.prototype.getProviderConfig = function () {
        var socialConfig = this.config.social;
        if (!socialConfig)
            return null;
        // Access config dynamically using providerName (no hardcoding)
        return socialConfig[this.providerName] || null;
    };
    /**
     * Handle OAuth callback and authenticate user
     *
     * Uses the provider-specific getOAuthProfile method and then handles
     * user creation, session management, and token generation.
     */
    BaseSocialAuthProviderService.prototype.handleCallback = function (code, state) {
        return __awaiter(this, void 0, void 0, function () {
            var providerConfig, profile, user, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        providerConfig = this.getProviderConfig();
                        if (!providerConfig) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_CONFIG_MISSING, "Provider configuration not found: ".concat(this.providerName));
                        }
                        // Validate state (basic CSRF protection)
                        this.validateState(state);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, this.getOAuthProfile(code, state)];
                    case 2:
                        profile = _c.sent();
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "[SocialAuth] ".concat(this.providerName, " callback verified (secure): ").concat(profile.email));
                        return [4 /*yield*/, this.findOrCreateUser(profile, providerConfig)];
                    case 3:
                        user = _c.sent();
                        // Create or update social account
                        return [4 /*yield*/, this.createOrUpdateSocialAccount(user, profile)];
                    case 4:
                        // Create or update social account
                        _c.sent();
                        return [4 /*yield*/, this.createAuthResponse(user, 'web')];
                    case 5: 
                    // Generate JWT tokens and session
                    return [2 /*return*/, _c.sent()];
                    case 6:
                        error_1 = _c.sent();
                        if (error_1 instanceof nauth_exception_1.NAuthException) {
                            throw error_1;
                        }
                        if (error_1 instanceof Error) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_TOKEN_INVALID, "Social authentication failed: ".concat(error_1.message));
                        }
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Social authentication failed: Unknown error');
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify social authentication token from native mobile apps
     */
    BaseSocialAuthProviderService.prototype.verifyToken = function (idToken, accessToken, profileData) {
        return __awaiter(this, void 0, void 0, function () {
            var providerConfig, profile, user, error_2, errorMessage;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        providerConfig = this.getProviderConfig();
                        if (!providerConfig || !providerConfig.enabled) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_CONFIG_MISSING, "Provider '".concat(this.providerName, "' is not configured or not enabled"));
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, this.verifyNativeToken(idToken, accessToken, profileData)];
                    case 2:
                        profile = _c.sent();
                        return [4 /*yield*/, this.findOrCreateUser(profile, providerConfig)];
                    case 3:
                        user = _c.sent();
                        // Create or update social account
                        return [4 /*yield*/, this.createOrUpdateSocialAccount(user, profile)];
                    case 4:
                        // Create or update social account
                        _c.sent();
                        return [4 /*yield*/, this.createAuthResponse(user, 'mobile')];
                    case 5: 
                    // Generate JWT tokens and session
                    return [2 /*return*/, _c.sent()];
                    case 6:
                        error_2 = _c.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, "Native token verification failed for ".concat(this.providerName, ": ").concat(errorMessage));
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_TOKEN_INVALID, "Token verification failed: ".concat(errorMessage));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Link social account to existing user
     */
    BaseSocialAuthProviderService.prototype.linkAccount = function (userId, code, state) {
        return __awaiter(this, void 0, void 0, function () {
            var user, providerConfig, profile, existingAccount, auditError_1, errorMessage, error_3;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: userId } })];
                    case 1:
                        user = (_d.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        providerConfig = this.getProviderConfig();
                        if (!providerConfig) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_CONFIG_MISSING, "Provider configuration not found: ".concat(this.providerName));
                        }
                        // Validate state
                        this.validateState(state);
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 10, , 11]);
                        return [4 /*yield*/, this.getOAuthProfile(code, state)];
                    case 3:
                        profile = _d.sent();
                        return [4 /*yield*/, this.socialAuthService.findSocialAccountByProvider(this.providerName, profile.id)];
                    case 4:
                        existingAccount = _d.sent();
                        if (existingAccount) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_ACCOUNT_LINKED, 'This social account is already linked to another user');
                        }
                        // Create social account using service
                        return [4 /*yield*/, this.socialAuthService.createOrUpdateSocialAccount(user.id, this.providerName, profile.id, profile.email, profile.raw)];
                    case 5:
                        // Create social account using service
                        _d.sent();
                        _d.label = 6;
                    case 6:
                        _d.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SOCIAL_ACCOUNT_LINKED,
                                eventStatus: 'SUCCESS',
                                authMethod: this.providerName.toLowerCase(),
                                // Client info automatically included from context
                                metadata: {
                                    provider: this.providerName.toLowerCase(),
                                    providerEmail: profile.email || null,
                                },
                            }))];
                    case 7:
                        _d.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        auditError_1 = _d.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record SOCIAL_ACCOUNT_LINKED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                            provider: this.providerName,
                        });
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/, { message: "".concat(this.providerName, " account linked successfully") }];
                    case 10:
                        error_3 = _d.sent();
                        if (error_3 instanceof nauth_exception_1.NAuthException) {
                            throw error_3;
                        }
                        if (error_3 instanceof Error) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_TOKEN_INVALID, "Social account linking failed: ".concat(error_3.message));
                        }
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Social account linking failed: Unknown error');
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get OAuth user profile from callback
     *
     * Alias for getOAuthProfile for interface compliance.
     */
    BaseSocialAuthProviderService.prototype.getUserProfileFromCallback = function (code, state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getOAuthProfile(code, state)];
            });
        });
    };
    // ============================================================================
    // Protected Helper Methods
    // ============================================================================
    /**
     * Validate state parameter for CSRF protection
     */
    BaseSocialAuthProviderService.prototype.validateState = function (state) {
        var stateData = this.stateStore.get(state);
        if (!stateData) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' });
        }
        if (stateData.provider !== this.providerName) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'State provider mismatch', { field: 'state' });
        }
        // Check if state is not too old (5 minutes)
        if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
            this.stateStore.delete(state);
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_EXPIRED, 'State parameter expired');
        }
        // Clean up used state
        this.stateStore.delete(state);
    };
    /**
     * Generate random state for CSRF protection
     */
    BaseSocialAuthProviderService.prototype.generateState = function () {
        var state = crypto.randomBytes(32).toString('hex');
        this.stateStore.set(state, {
            timestamp: Date.now(),
            provider: this.providerName,
        });
        return state;
    };
    /**
     * Find existing user or create new one
     */
    BaseSocialAuthProviderService.prototype.findOrCreateUser = function (profile, providerConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var socialAccount, existingUser, savedUser;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, this.socialAuthService.findSocialAccountByProvider(this.providerName, profile.id)];
                    case 1:
                        socialAccount = _e.sent();
                        if (socialAccount) {
                            return [2 /*return*/, socialAccount.user];
                        }
                        if (!(providerConfig.autoLink && profile.email)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { email: profile.email, isEmailVerified: true },
                            })];
                    case 2:
                        existingUser = (_e.sent());
                        if (existingUser) {
                            return [2 /*return*/, existingUser];
                        }
                        _e.label = 3;
                    case 3:
                        if (!providerConfig.allowSignup) return [3 /*break*/, 5];
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "[SocialAuth] Creating user: email=".concat(profile.email, ", isEmailVerified=").concat(profile.verified || false));
                        return [4 /*yield*/, this.createSocialUser(profile.email || '', profile.firstName, profile.lastName, profile.verified || false, this.providerName)];
                    case 4:
                        savedUser = _e.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "[SocialAuth] User created: email=".concat(savedUser.email, ", isEmailVerified=").concat(savedUser.isEmailVerified));
                        return [2 /*return*/, savedUser];
                    case 5: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SIGNUP_DISABLED, 'User not found and signup is disabled');
                }
            });
        });
    };
    /**
     * Create a social-only user (no password)
     *
     * @param email - User email
     * @param firstName - Optional first name
     * @param lastName - Optional last name
     * @param isEmailVerified - Whether email is verified (default: true)
     * @param socialProvider - Initial social provider name
     * @returns Created user
     * @protected
     */
    BaseSocialAuthProviderService.prototype.createSocialUser = function (email_1, firstName_1, lastName_1) {
        return __awaiter(this, arguments, void 0, function (email, firstName, lastName, isEmailVerified, socialProvider) {
            var user, savedUser;
            var _a, _b;
            if (isEmailVerified === void 0) { isEmailVerified = true; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        user = this.userRepository.create({
                            email: email,
                            firstName: firstName || null,
                            lastName: lastName || null,
                            isEmailVerified: isEmailVerified,
                            hasSocialAuth: true,
                            socialProviders: socialProvider ? [socialProvider] : null,
                            isActive: true,
                        });
                        return [4 /*yield*/, this.userRepository.save(user)];
                    case 1:
                        savedUser = (_c.sent());
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Social user created: ".concat(email, " (sub: ").concat(savedUser.sub, ")"));
                        return [2 /*return*/, savedUser];
                }
            });
        });
    };
    /**
     * Create or update social account
     */
    BaseSocialAuthProviderService.prototype.createOrUpdateSocialAccount = function (user, profile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.socialAuthService.createOrUpdateSocialAccount(user.id, this.providerName, profile.id, profile.email, profile.raw)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create authentication response with tokens and user info
     */
    BaseSocialAuthProviderService.prototype.createAuthResponse = function (user, deviceType) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenFamily, accessTokenHash, refreshTokenHash, expiresAt, revokedCount, clientInfo, deviceId, session, jwtTokens, accessDecoded, refreshDecoded, auditError_2, errorMessage, response, userDto;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            return __generator(this, function (_o) {
                switch (_o.label) {
                    case 0:
                        tokenFamily = crypto.randomBytes(32).toString('hex');
                        accessTokenHash = this.jwtService.hashToken('placeholder-access');
                        refreshTokenHash = this.jwtService.hashToken('placeholder-refresh');
                        expiresAt = this.sessionService.getSessionExpirationDate();
                        if (!((_a = this.config.session) === null || _a === void 0 ? void 0 : _a.disallowMultipleSessions)) return [3 /*break*/, 2];
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug) === null || _c === void 0 ? void 0 : _c.call(_b, "Single session mode enabled - revoking other sessions for user: ".concat(user.sub));
                        return [4 /*yield*/, this.sessionService.revokeAllUserSessions(user.id, "Login from new ".concat(this.providerName, " ").concat(deviceType, " session"))];
                    case 1:
                        revokedCount = _o.sent();
                        if (revokedCount > 0) {
                            (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.log) === null || _e === void 0 ? void 0 : _e.call(_d, "Revoked ".concat(revokedCount, " other active session(s) for user: ").concat(user.sub));
                        }
                        _o.label = 2;
                    case 2:
                        clientInfo = this.clientInfoService.get();
                        deviceId = crypto.randomUUID();
                        return [4 /*yield*/, this.sessionService.createSession({
                                userId: user.id,
                                accessTokenHash: accessTokenHash,
                                refreshTokenHash: refreshTokenHash,
                                tokenFamily: tokenFamily,
                                deviceId: deviceId,
                                deviceType: deviceType, // Use provided deviceType or let parser detect from userAgent
                                expiresAt: expiresAt,
                                authMethod: this.providerName.toLowerCase(), // 'google', 'facebook', 'github', etc.
                            })];
                    case 3:
                        session = _o.sent();
                        return [4 /*yield*/, this.jwtService.generateTokenPair({
                                userId: user.sub,
                                email: user.email,
                                sessionId: session.id.toString(),
                                tokenFamily: tokenFamily,
                            })];
                    case 4:
                        jwtTokens = _o.sent();
                        // Update session with actual token hashes
                        return [4 /*yield*/, this.sessionService.updateTokens(session.id, this.jwtService.hashToken(jwtTokens.accessToken), this.jwtService.hashToken(jwtTokens.refreshToken))];
                    case 5:
                        // Update session with actual token hashes
                        _o.sent();
                        accessDecoded = this.jwtService.decodeToken(jwtTokens.accessToken);
                        refreshDecoded = this.jwtService.decodeToken(jwtTokens.refreshToken);
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.log) === null || _g === void 0 ? void 0 : _g.call(_f, "Social ".concat(this.providerName, " authentication successful for user: ").concat(user.sub));
                        _o.label = 6;
                    case 6:
                        _o.trys.push([6, 8, , 9]);
                        // Use device info from session (already parsed from user agent if not provided)
                        return [4 /*yield*/, ((_h = this.auditService) === null || _h === void 0 ? void 0 : _h.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SOCIAL_LOGIN,
                                eventStatus: 'SUCCESS',
                                sessionId: session.id,
                                // Override deviceId only if provided (from social auth context)
                                deviceId: deviceId || undefined,
                                authMethod: this.providerName.toLowerCase(), // 'google', 'facebook', etc.
                                // Override userAgent if mobile device type
                                userAgent: deviceType === 'mobile' ? 'native-mobile-app' : undefined,
                                // Client info (deviceName, deviceType, etc.) automatically included from context
                                metadata: {
                                    provider: this.providerName.toLowerCase(),
                                },
                            }))];
                    case 7:
                        // Use device info from session (already parsed from user agent if not provided)
                        _o.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        auditError_2 = _o.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.error) === null || _k === void 0 ? void 0 : _k.call(_j, "Failed to record SOCIAL_LOGIN audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: user.id,
                            provider: this.providerName,
                        });
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                            user: user,
                            config: this.config,
                            deviceToken: clientInfo.deviceToken,
                            isSocialLogin: true,
                            skipMFAVerification: false,
                            authProvider: this.providerName.toLowerCase(), // e.g., 'google', 'facebook', 'apple'
                        })];
                    case 10:
                        response = _o.sent();
                        if (response.challengeName) {
                            (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.log) === null || _m === void 0 ? void 0 : _m.call(_l, "Challenge required for social auth user ".concat(user.sub, ": ").concat(response.challengeName));
                            return [2 /*return*/, response];
                        }
                        userDto = dto_1.UserResponseDto.fromEntity(user);
                        return [2 /*return*/, {
                                accessToken: jwtTokens.accessToken,
                                refreshToken: jwtTokens.refreshToken,
                                accessTokenExpiresAt: (accessDecoded === null || accessDecoded === void 0 ? void 0 : accessDecoded.exp) || Math.floor(Date.now() / 1000) + jwtTokens.expiresIn,
                                refreshTokenExpiresAt: (refreshDecoded === null || refreshDecoded === void 0 ? void 0 : refreshDecoded.exp) || Math.floor(Date.now() / 1000) + 86400,
                                user: {
                                    sub: userDto.sub,
                                    email: userDto.email,
                                    firstName: userDto.firstName || undefined,
                                    lastName: userDto.lastName || undefined,
                                    isEmailVerified: userDto.isEmailVerified,
                                    socialProviders: userDto.socialProviders || undefined,
                                    hasPasswordHash: userDto.hasPasswordHash,
                                },
                            }];
                }
            });
        });
    };
    return BaseSocialAuthProviderService;
}());
exports.BaseSocialAuthProviderService = BaseSocialAuthProviderService;
