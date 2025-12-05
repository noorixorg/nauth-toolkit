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
exports.SocialAuthService = void 0;
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var change_password_request_dto_1 = require("../dto/change-password-request.dto");
/**
 * Social Auth Service
 *
 * Complete API for social authentication (OAuth) and account management.
 * This service provides:
 * - OAuth authentication flows (login/signup via social providers)
 * - Social account linking/unlinking
 * - Account management for social users
 * - Password management for social-only users
 *
 * **Optional Feature:** Only available when social auth provider modules are imported.
 *
 * **Usage:**
 * ```typescript
 * // NestJS
 * imports: [
 *   AuthModule.forRoot(config),
 *   GoogleSocialAuthModule,  // Enables Google OAuth
 *   AppleSocialAuthModule,   // Enables Apple Sign In
 * ]
 *
 * // Then inject and use
 * constructor(private socialAuthService: SocialAuthService) {}
 *
 * const { url } = await this.socialAuthService.getSocialAuthUrl({ provider: 'google' });
 * const result = await this.socialAuthService.handleSocialCallback({ provider: 'google', code, state });
 * ```
 */
var SocialAuthService = /** @class */ (function () {
    function SocialAuthService(providerRegistry, userRepository, socialAccountRepository, authService, logger, auditService) {
        this.providerRegistry = providerRegistry;
        this.userRepository = userRepository;
        this.socialAccountRepository = socialAccountRepository;
        this.authService = authService;
        this.logger = logger;
        this.auditService = auditService;
    }
    // ============================================================================
    // Social Authentication Methods
    // ============================================================================
    /**
     * Get social authentication URL
     *
     * Generates OAuth authorization URL for the specified provider.
     * This is the first step in the OAuth flow - redirect user to this URL.
     *
     * @param dto - Request DTO containing provider and optional state
     * @returns Response DTO with OAuth authorization URL
     * @throws {NAuthException} SOCIAL_CONFIG_MISSING if provider not registered or configured
     *
     * @example
     * ```typescript
     * const dto = { provider: 'google', state: 'csrf-token-123' };
     * const { url } = await socialAuthService.getSocialAuthUrl(dto);
     * // Redirect user to url
     * res.redirect(url);
     * ```
     */
    SocialAuthService.prototype.getSocialAuthUrl = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var provider, state, providerInstance, url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        provider = dto.provider, state = dto.state;
                        providerInstance = this.providerRegistry.getProvider(provider);
                        return [4 /*yield*/, providerInstance.getAuthUrl(state)];
                    case 1:
                        url = _a.sent();
                        return [2 /*return*/, { url: url }];
                }
            });
        });
    };
    /**
     * Handle social authentication callback
     *
     * Processes OAuth callback and authenticates user (login or signup).
     * This is called after the user is redirected back from the OAuth provider.
     *
     * @param dto - Request DTO containing provider, code, and state
     * @returns Auth response (tokens or challenge if MFA/verification required)
     * @throws {NAuthException} Various auth errors (SOCIAL_AUTH_FAILED, etc.)
     *
     * @example
     * ```typescript
     * const dto = {
     *   provider: 'google',
     *   code: req.query.code,
     *   state: req.query.state
     * };
     * const result = await socialAuthService.handleSocialCallback(dto);
     * // Returns tokens or challenge
     * ```
     */
    SocialAuthService.prototype.handleSocialCallback = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var provider, code, state, providerInstance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        provider = dto.provider, code = dto.code, state = dto.state;
                        providerInstance = this.providerRegistry.getProvider(provider);
                        return [4 /*yield*/, providerInstance.handleCallback(code, state)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Link social account to existing authenticated user
     *
     * Connects a social provider to an already logged-in user's account.
     * User must be authenticated before calling this method.
     *
     * @param dto - Request DTO containing userId, provider, code, and state
     * @returns Response DTO with success message and provider name
     * @throws {NAuthException} SOCIAL_ALREADY_LINKED, NOT_FOUND, etc.
     *
     * @example
     * ```typescript
     * const dto = {
     *   userId: user.sub,
     *   provider: 'apple',
     *   code: req.query.code,
     *   state: req.query.state
     * };
     * const result = await socialAuthService.linkSocialAccount(dto);
     * ```
     */
    SocialAuthService.prototype.linkSocialAccount = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, provider, code, state, providerInstance, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userId = dto.userId, provider = dto.provider, code = dto.code, state = dto.state;
                        providerInstance = this.providerRegistry.getProvider(provider);
                        return [4 /*yield*/, providerInstance.linkAccount(userId, code, state)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, result), { provider: provider })];
                }
            });
        });
    };
    /**
     * List available social auth providers
     *
     * Returns names of all registered and enabled social auth providers.
     * Useful for displaying available login options in the UI.
     *
     * @returns Array of provider names (e.g., ['google', 'apple', 'facebook'])
     *
     * @example
     * ```typescript
     * const providers = socialAuthService.listAvailableProviders();
     * // Display social login buttons based on available providers
     * ```
     */
    SocialAuthService.prototype.listAvailableProviders = function () {
        return this.providerRegistry.listProviders();
    };
    // ============================================================================
    // Social Account Management Methods
    // ============================================================================
    /**
     * Get linked social accounts for a user
     *
     * @param dto - Request DTO containing userId
     * @returns Response DTO with array of linked social accounts
     * @throws {NAuthException} NOT_FOUND when user is not found
     *
     * @example
     * ```typescript
     * const dto = { userId: 'user-uuid' };
     * const accounts = await socialAuthService.getLinkedAccounts(dto);
     * console.log(accounts.accounts); // [{ provider: 'google', ... }]
     * ```
     */
    SocialAuthService.prototype.getLinkedAccounts = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, user, socialAccounts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userId = dto.userId;
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: userId } })];
                    case 1:
                        user = (_a.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.socialAccountRepository.find({
                                where: { userId: user.id },
                                order: { linkedAt: 'DESC' },
                            })];
                    case 2:
                        socialAccounts = (_a.sent());
                        return [2 /*return*/, {
                                accounts: socialAccounts.map(function (account) { return ({
                                    provider: account.provider,
                                    providerEmail: account.providerEmail || undefined,
                                    linkedAt: account.linkedAt,
                                    lastUsedAt: account.lastUsedAt || undefined,
                                }); }),
                            }];
                }
            });
        });
    };
    /**
     * Unlink social account from user
     *
     * @param dto - Request DTO containing userId and provider
     * @returns Response DTO with success message
     * @throws {NAuthException} NOT_FOUND when user or account is not found
     *
     * @example
     * ```typescript
     * const dto = { userId: 'user-uuid', provider: 'google' };
     * await socialAuthService.unlinkSocialAccount(dto);
     * ```
     */
    SocialAuthService.prototype.unlinkSocialAccount = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, provider, user, socialAccount, auditError_1, errorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        userId = dto.userId, provider = dto.provider;
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: userId } })];
                    case 1:
                        user = (_d.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.socialAccountRepository.findOne({
                                where: { userId: user.id, provider: provider },
                            })];
                    case 2:
                        socialAccount = (_d.sent());
                        if (!socialAccount) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_ACCOUNT_NOT_FOUND, "".concat(provider, " account is not linked to this user"));
                        }
                        // Delete social account
                        return [4 /*yield*/, this.socialAccountRepository.remove(socialAccount)];
                    case 3:
                        // Delete social account
                        _d.sent();
                        // Update user's social auth flags
                        return [4 /*yield*/, this.updateUserSocialFlags(user.id)];
                    case 4:
                        // Update user's social auth flags
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SOCIAL_ACCOUNT_UNLINKED,
                                eventStatus: 'INFO',
                                authMethod: provider,
                                // Client info automatically included from context
                                metadata: {
                                    provider: provider,
                                    providerEmail: socialAccount.providerEmail || null,
                                },
                            }))];
                    case 6:
                        _d.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        auditError_1 = _d.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record SOCIAL_ACCOUNT_UNLINKED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                            provider: provider,
                        });
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, { message: "".concat(provider, " account unlinked successfully") }];
                }
            });
        });
    };
    /**
     * Check if user can set a password
     * Users with social-only accounts can set passwords
     *
     * @param dto - Request DTO containing userId
     * @returns Response DTO indicating whether user can set password
     *
     * @example
     * ```typescript
     * const dto = { userId: 'user-uuid' };
     * const result = await socialAuthService.canSetPassword(dto);
     * if (result.canSetPassword) {
     *   // Allow user to set password
     * }
     * ```
     */
    SocialAuthService.prototype.canSetPassword = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userId = dto.userId;
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: userId } })];
                    case 1:
                        user = (_a.sent());
                        if (!user) {
                            return [2 /*return*/, { canSetPassword: false }];
                        }
                        // User can set password if they don't have one (social-only account)
                        return [2 /*return*/, { canSetPassword: !user.passwordHash }];
                }
            });
        });
    };
    /**
     * Set password for social-only user
     *
     * @param dto - Request DTO containing userId and password
     * @returns Response DTO with success message
     * @throws {NAuthException} NOT_FOUND when user is not found
     * @throws {NAuthException} VALIDATION_FAILED when user already has a password
     *
     * @example
     * ```typescript
     * const dto = { userId: 'user-uuid', password: 'newpassword' };
     * await socialAuthService.setPasswordForSocialUser(dto);
     * ```
     */
    SocialAuthService.prototype.setPasswordForSocialUser = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, password, user, changePasswordDto;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userId = dto.userId, password = dto.password;
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: userId } })];
                    case 1:
                        user = _a.sent();
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        if (user.passwordHash) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'User already has a password', {
                                field: 'password',
                            });
                        }
                        changePasswordDto = new change_password_request_dto_1.ChangePasswordRequestDTO();
                        changePasswordDto.sub = userId; // userId is the sub (external UUID) in this context
                        changePasswordDto.oldPassword = ''; // Social-only users don't have a password
                        changePasswordDto.newPassword = password;
                        return [4 /*yield*/, this.authService.changePassword(changePasswordDto)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { message: 'Password set successfully' }];
                }
            });
        });
    };
    /**
     * Find social account by provider and provider ID
     *
     * @param provider - Provider name (e.g., 'google', 'apple')
     * @param providerId - Provider user ID
     * @returns Social account with user relation, or null
     * @internal - For use by BaseSocialAuthProviderService
     */
    SocialAuthService.prototype.findSocialAccountByProvider = function (provider, providerId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.socialAccountRepository.findOne({
                            where: { provider: provider, providerId: providerId },
                            relations: ['user'],
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Find social account by user ID and provider
     *
     * @param userId - User ID (internal)
     * @param provider - Provider name
     * @returns Social account or null
     * @internal - For use by BaseSocialAuthProviderService
     */
    SocialAuthService.prototype.findSocialAccountByUser = function (userId, provider) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.socialAccountRepository.findOne({
                            where: { userId: userId, provider: provider },
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Create or update social account
     *
     * @param userId - User ID (internal)
     * @param provider - Provider name
     * @param providerId - Provider user ID
     * @param providerEmail - Provider email
     * @param metadata - Optional raw profile data
     * @internal - For use by BaseSocialAuthProviderService
     */
    SocialAuthService.prototype.createOrUpdateSocialAccount = function (userId, provider, providerId, providerEmail, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var existingAccount, socialAccount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.findSocialAccountByUser(userId, provider)];
                    case 1:
                        existingAccount = _a.sent();
                        if (!existingAccount) return [3 /*break*/, 3];
                        // Update existing account
                        existingAccount.providerEmail = providerEmail || null;
                        existingAccount.lastUsedAt = new Date();
                        existingAccount.metadata = metadata || null;
                        return [4 /*yield*/, this.socialAccountRepository.save(existingAccount)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        socialAccount = this.socialAccountRepository.create({
                            userId: userId,
                            provider: provider,
                            providerId: providerId,
                            providerEmail: providerEmail || null,
                            linkedAt: new Date(),
                            lastUsedAt: new Date(),
                            metadata: metadata || null,
                        });
                        return [4 /*yield*/, this.socialAccountRepository.save(socialAccount)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: 
                    // Update user's social auth flags
                    return [4 /*yield*/, this.updateUserSocialFlags(userId)];
                    case 6:
                        // Update user's social auth flags
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update user's social authentication flags
     *
     * @param userId - User ID (internal)
     * @internal - For use by BaseSocialAuthProviderService
     */
    SocialAuthService.prototype.updateUserSocialFlags = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var socialAccounts, providers, hasSocialAuth;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.socialAccountRepository.find({
                            where: { userId: userId },
                        })];
                    case 1:
                        socialAccounts = (_a.sent());
                        providers = (socialAccounts === null || socialAccounts === void 0 ? void 0 : socialAccounts.map(function (account) { return account.provider; })) || [];
                        hasSocialAuth = socialAccounts && socialAccounts.length > 0;
                        return [4 /*yield*/, this.userRepository.update(userId, {
                                hasSocialAuth: hasSocialAuth,
                                socialProviders: providers.length > 0 ? providers : null,
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return SocialAuthService;
}());
exports.SocialAuthService = SocialAuthService;
