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
exports.AuthChallengeHelperService = void 0;
var auth_challenge_dto_1 = require("../dto/auth-challenge.dto");
var verify_email_dto_1 = require("../dto/verify-email.dto");
var verify_phone_dto_1 = require("../dto/verify-phone.dto");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
var auth_flow_state_machine_types_1 = require("./auth-flow-state-machine.types");
/**
 * Helper service for challenge-response authentication flows
 *
 * This service determines if a user needs to complete challenges
 * before full authentication can be granted, and generates appropriate
 * responses including MFA challenges.
 *
 * @example
 * ```typescript
 * const response = await challengeHelper.determineAuthResponse(
 *   user,
 *   'login',
 *   { ipAddress: '1.2.3.4' }
 * );
 * ```
 */
var AuthChallengeHelperService = /** @class */ (function () {
    function AuthChallengeHelperService(challengeService, jwtService, sessionService, mfaDeviceRepository, logger, stateMachine, contextBuilder, clientInfoService, emailVerificationService, phoneVerificationService) {
        this.challengeService = challengeService;
        this.jwtService = jwtService;
        this.sessionService = sessionService;
        this.mfaDeviceRepository = mfaDeviceRepository;
        this.logger = logger;
        this.stateMachine = stateMachine;
        this.contextBuilder = contextBuilder;
        this.clientInfoService = clientInfoService;
        this.emailVerificationService = emailVerificationService;
        this.phoneVerificationService = phoneVerificationService;
    }
    // ============================================================================
    // OLD METHODS DELETED - Replaced by state machine
    // ============================================================================
    // determinePendingChallenges() - DELETED (replaced by state machine)
    // isMFASetupRequired() - DELETED (replaced by state machine)
    // checkMFARequirement() - DELETED (replaced by state machine)
    // All challenge determination is now handled by determineAuthResponse() using state machine
    /**
     * Create challenge response for authentication
     *
     * Generates a challenge session and returns challenge details to client.
     * Sends verification codes when challenges are created to ensure sequential flow.
     *
     * @param user - User who needs to complete challenges
     * @param challengeName - Type of challenge
     * @param config - Auth configuration
     * @param authMethod - Authentication method ('password' or 'social')
     * @param authProvider - Provider name for social auth (e.g., 'google', 'facebook')
     * @returns Challenge response DTO
     *
     * @example
     * ```typescript
     * const response = await challengeHelper.createChallengeResponse(
     *   user,
     *   AuthChallenge.VERIFY_EMAIL,
     *   config,
     *   'social',
     *   'google'
     * );
     * ```
     */
    AuthChallengeHelperService.prototype.createChallengeResponse = function (user_1, challengeName_1, config_1) {
        return __awaiter(this, arguments, void 0, function (user, challengeName, config, authMethod, authProvider) {
            var challengeSession, emailDto, smsDto, challengeParameters, allowedMethods, response;
            var _this = this;
            var _a, _b, _c, _d, _e, _f, _g;
            if (authMethod === void 0) { authMethod = 'password'; }
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by ChallengeService and AuditService
                        // ============================================================================
                        // STEP 1: Create challenge session FIRST (before sending codes)
                        // ============================================================================
                        // This ensures the session exists before any verification codes are sent.
                        // Creating the session first is critical for proper audit trail and session tracking.
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "Creating challenge with authMethod=".concat(authMethod, ", authProvider=").concat(authProvider || 'none', " for user ").concat(user.sub));
                        return [4 /*yield*/, this.challengeService.createChallengeSession(user, challengeName, {
                                email: user.email,
                                phone: user.phone,
                                authMethod: authMethod, // Store auth method for challenge completion flow
                                authProvider: authProvider,
                            })];
                    case 1:
                        challengeSession = _h.sent();
                        // ============================================================================
                        // STEP 2: Send verification codes AFTER session is created
                        // ============================================================================
                        // This ensures codes are sent at the right time:
                        // - Email code sent when VERIFY_EMAIL challenge is created
                        // - Phone code sent when VERIFY_PHONE challenge is created (after email is verified)
                        // This prevents sending both codes at once, avoiding user confusion.
                        // Challenges are sequential: first VERIFY_EMAIL, then VERIFY_PHONE
                        if (challengeName === auth_challenge_dto_1.AuthChallenge.VERIFY_EMAIL && this.emailVerificationService) {
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "\uD83D\uDCE7 Sending verification email to: ".concat(user.email));
                            emailDto = Object.assign(new verify_email_dto_1.SendVerificationEmailDTO(), { sub: user.sub, baseUrl: undefined });
                            this.emailVerificationService
                                .sendVerificationEmail(emailDto)
                                .then(function () {
                                var _a, _b;
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Verification email sent successfully to: ".concat(user.email));
                            })
                                .catch(function (error) {
                                var _a, _b;
                                var errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to send verification email to ".concat(user.email, ": ").concat(errorMessage));
                            });
                        }
                        if (challengeName === auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE && this.phoneVerificationService && user.phone) {
                            (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "Sending verification SMS to: ".concat(user.phone));
                            smsDto = Object.assign(new verify_phone_dto_1.SendVerificationSMSDTO(), { sub: user.sub });
                            this.phoneVerificationService
                                .sendVerificationSMS(smsDto)
                                .then(function () {
                                var _a, _b;
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Verification SMS sent successfully to: ".concat(user.phone));
                            })
                                .catch(function (error) {
                                var _a, _b;
                                var errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to send verification SMS to ".concat(user.phone, ": ").concat(errorMessage));
                            });
                        }
                        challengeParameters = {};
                        switch (challengeName) {
                            case auth_challenge_dto_1.AuthChallenge.VERIFY_EMAIL:
                                challengeParameters.email = user.email;
                                challengeParameters.codeDeliveryDestination = this.challengeService.maskEmail(user.email);
                                break;
                            case auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE:
                                challengeParameters.phone = user.phone || undefined;
                                challengeParameters.codeDeliveryDestination = user.phone
                                    ? this.challengeService.maskPhone(user.phone)
                                    : undefined;
                                // If no phone, indicate user must provide it first
                                if (!user.phone) {
                                    challengeParameters.requiresPhoneCollection = 'true';
                                    challengeParameters.instructions = 'You must add a phone number and verify it to continue';
                                }
                                break;
                            case auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED:
                                challengeParameters.instructions = 'Multi-factor authentication is required';
                                // Include masked phone if SMS is preferred method
                                if (user.preferredMfaMethod === 'sms' && user.phone) {
                                    challengeParameters.codeDeliveryDestination = this.challengeService.maskPhone(user.phone);
                                }
                                // Include masked email if Email is preferred method
                                if (user.preferredMfaMethod === 'email' && user.email) {
                                    challengeParameters.codeDeliveryDestination = this.challengeService.maskEmail(user.email);
                                }
                                break;
                            case auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED: {
                                allowedMethods = ((_g = config.mfa) === null || _g === void 0 ? void 0 : _g.allowedMethods) || __spreadArray([], mfa_method_enum_1.MFADeviceMethods, true);
                                challengeParameters.allowedMethods = allowedMethods;
                                challengeParameters.instructions = 'Multi-factor authentication setup is required before you can login';
                                break;
                            }
                            case auth_challenge_dto_1.AuthChallenge.FORCE_CHANGE_PASSWORD:
                                challengeParameters.instructions = 'You must change your password before continuing';
                                break;
                        }
                        response = {
                            challengeName: challengeName,
                            session: challengeSession.sessionToken,
                            challengeParameters: challengeParameters,
                            userSub: user.sub,
                        };
                        return [2 /*return*/, response];
                }
            });
        });
    };
    // ============================================================================
    // MFA Challenge Support
    // ============================================================================
    // checkMFARequirement() - DELETED (replaced by state machine)
    // All MFA requirement checking is now handled by state machine in determineAuthResponse()
    /**
     * Create MFA setup challenge response
     *
     * Generates challenge session for MFA setup requirement.
     * User must set up MFA before being allowed to login.
     *
     * @param user - User requiring MFA setup
     * @param config - Auth configuration
     * @param authMethod - Authentication method ('password' or 'social')
     * @param authProvider - Provider name for social auth (e.g., 'google', 'facebook')
     * @returns MFA setup challenge response
     *
     * @example
     * ```typescript
     * const response = await challengeHelper.createMFASetupChallengeResponse(
     *   user,
     *   config,
     *   'social',
     *   'google'
     * );
     * // Returns: { challengeName: 'MFA_SETUP_REQUIRED', session: '...', challengeParameters: {...} }
     * ```
     */
    AuthChallengeHelperService.prototype.createMFASetupChallengeResponse = function (user_1, config_1) {
        return __awaiter(this, arguments, void 0, function (user, config, authMethod, authProvider) {
            var allowedMethods, challengeSession;
            var _a, _b, _c, _d, _e, _f, _g;
            if (authMethod === void 0) { authMethod = 'password'; }
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by ChallengeService and AuditService
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Creating MFA setup challenge for user: ".concat(user.sub));
                        allowedMethods = ((_c = config.mfa) === null || _c === void 0 ? void 0 : _c.allowedMethods) || __spreadArray([], mfa_method_enum_1.MFADeviceMethods, true);
                        // Create challenge session with auth context
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.debug) === null || _e === void 0 ? void 0 : _e.call(_d, "Creating MFA setup challenge with authMethod=".concat(authMethod, ", authProvider=").concat(authProvider || 'none', " for user ").concat(user.sub));
                        return [4 /*yield*/, this.challengeService.createChallengeSession(user, auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED, {
                                allowedMethods: allowedMethods,
                                requiresSetup: true,
                                authMethod: authMethod, // Store auth method for challenge completion flow
                                authProvider: authProvider,
                            })];
                    case 1:
                        challengeSession = _h.sent();
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.log) === null || _g === void 0 ? void 0 : _g.call(_f, "MFA setup challenge created for user: ".concat(user.sub));
                        // Return challenge response
                        return [2 /*return*/, {
                                challengeName: auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED,
                                session: challengeSession.sessionToken,
                                challengeParameters: {
                                    allowedMethods: allowedMethods,
                                    instructions: 'Multi-factor authentication setup is required before you can login',
                                },
                                userSub: user.sub,
                            }];
                }
            });
        });
    };
    /**
     * Create MFA challenge response
     *
     * Generates challenge session for MFA verification.
     * Returns available MFA methods and challenge parameters.
     *
     * @param user - User requiring MFA
     * @returns MFA challenge response
     * @remarks Client info (ipAddress, userAgent) is automatically extracted from ClientInfoService context
     *
     * @example
     * ```typescript
     * const response = await challengeHelper.createMFAChallengeResponse(
     *   user,
     *   '1.2.3.4',
     *   'Mozilla/5.0...'
     * );
     * // Returns: { challengeName: 'MFA_REQUIRED', session: '...', challengeParameters: {...} }
     * ```
     */
    AuthChallengeHelperService.prototype.createMFAChallengeResponse = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var devices, deviceMethods, availableMethods, preferredMethod, normalizedPreferredMethod, primaryDevice, maskedPhone, smsDevice, digits, maskedEmail, emailDevice, emailToMask, _a, localPart, domain, firstChar, lastChar, challengeSession, smsIsPreferred, smsIsOnly, smsDto, emailIsPreferred, emailIsOnly, emailDto, challengeParams;
            var _this = this;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            return __generator(this, function (_y) {
                switch (_y.label) {
                    case 0:
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by ChallengeService and AuditService
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.log) === null || _c === void 0 ? void 0 : _c.call(_b, "Creating MFA challenge for user: ".concat(user.sub));
                        return [4 /*yield*/, this.mfaDeviceRepository.find({
                                where: { userId: user.id, isActive: true },
                                order: { isPrimary: 'DESC', lastUsedAt: 'DESC' },
                            })];
                    case 1:
                        devices = (_y.sent());
                        if (devices.length === 0) {
                            (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.warn) === null || _e === void 0 ? void 0 : _e.call(_d, "User has MFA enabled but no active devices: ".concat(user.sub));
                            // User has MFA enabled but no devices - should not happen
                            // Allow login and let them set up MFA
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'MFA enabled but no devices configured');
                        }
                        deviceMethods = __spreadArray([], new Set(devices.map(function (d) { return d.type; })), true);
                        availableMethods = __spreadArray([], deviceMethods, true);
                        if (user.backupCodes && user.backupCodes.length > 0) {
                            availableMethods.push(mfa_method_enum_1.MFAMethod.BACKUP);
                        }
                        // Debug logging for troubleshooting
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "MFA challenge for user ".concat(user.sub, ": preferredMfaMethod=").concat(user.preferredMfaMethod, ", deviceMethods=[").concat(deviceMethods.join(', '), "], devices=[").concat(devices.map(function (d) { return "".concat(d.type).concat(d.isPrimary ? '(primary)' : ''); }).join(', '), "]"));
                        normalizedPreferredMethod = (_h = user.preferredMfaMethod) === null || _h === void 0 ? void 0 : _h.toLowerCase();
                        // Check if user has a preferred method and it's available
                        if (normalizedPreferredMethod &&
                            (normalizedPreferredMethod === mfa_method_enum_1.MFAMethod.TOTP ||
                                normalizedPreferredMethod === mfa_method_enum_1.MFAMethod.SMS ||
                                normalizedPreferredMethod === mfa_method_enum_1.MFAMethod.EMAIL ||
                                normalizedPreferredMethod === mfa_method_enum_1.MFAMethod.PASSKEY) &&
                            deviceMethods.some(function (m) { return m.toLowerCase() === normalizedPreferredMethod; })) {
                            // User has explicitly set a preferred method and it's available
                            // Find the actual method from deviceMethods to ensure case consistency
                            preferredMethod =
                                deviceMethods.find(function (m) { return m.toLowerCase() === normalizedPreferredMethod; }) || normalizedPreferredMethod;
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.debug) === null || _k === void 0 ? void 0 : _k.call(_j, "Using user preferred MFA method: ".concat(preferredMethod, " (from user.preferredMfaMethod: ").concat(user.preferredMfaMethod, ")"));
                        }
                        else {
                            primaryDevice = devices.find(function (d) { return d.isPrimary; });
                            preferredMethod = (primaryDevice === null || primaryDevice === void 0 ? void 0 : primaryDevice.type) || deviceMethods[0];
                            (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.debug) === null || _m === void 0 ? void 0 : _m.call(_l, "Using fallback MFA method: ".concat(preferredMethod, " (preferred: ").concat(user.preferredMfaMethod, ", available: ").concat(deviceMethods.join(', '), ")"));
                        }
                        smsDevice = devices.find(function (d) { return d.type === mfa_method_enum_1.MFAMethod.SMS && d.phoneNumber; });
                        if (smsDevice === null || smsDevice === void 0 ? void 0 : smsDevice.phoneNumber) {
                            digits = smsDevice.phoneNumber.replace(/\D/g, '');
                            maskedPhone = digits.length >= 4 ? "***-***-".concat(digits.slice(-4)) : smsDevice.phoneNumber;
                        }
                        emailDevice = devices.find(function (d) { return d.type === mfa_method_enum_1.MFAMethod.EMAIL && d.email; });
                        emailToMask = (emailDevice === null || emailDevice === void 0 ? void 0 : emailDevice.email) || user.email;
                        if (emailToMask) {
                            _a = emailToMask.split('@'), localPart = _a[0], domain = _a[1];
                            if (localPart && domain) {
                                firstChar = localPart[0];
                                lastChar = localPart[localPart.length - 1];
                                maskedEmail = localPart.length > 2 ? "".concat(firstChar, "***").concat(lastChar, "@").concat(domain) : "".concat(firstChar, "***@").concat(domain);
                            }
                            else {
                                maskedEmail = emailToMask;
                            }
                        }
                        return [4 /*yield*/, this.challengeService.createChallengeSession(user, auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED, {
                                availableMethods: availableMethods,
                                preferredMethod: preferredMethod,
                                maskedPhone: maskedPhone,
                                maskedEmail: maskedEmail,
                                method: preferredMethod, // Store method in metadata for resend endpoint
                            })];
                    case 2:
                        challengeSession = _y.sent();
                        (_p = (_o = this.logger) === null || _o === void 0 ? void 0 : _o.log) === null || _p === void 0 ? void 0 : _p.call(_o, "MFA challenge created for user: ".concat(user.sub));
                        smsIsPreferred = preferredMethod.toLowerCase() === 'sms';
                        smsIsOnly = deviceMethods.length === 1 && deviceMethods[0].toLowerCase() === 'sms';
                        if ((smsIsPreferred || smsIsOnly) && this.phoneVerificationService && user.phone) {
                            (_r = (_q = this.logger) === null || _q === void 0 ? void 0 : _q.log) === null || _r === void 0 ? void 0 : _r.call(_q, "Auto-sending MFA SMS code to user ".concat(user.sub, " (preferred=").concat(smsIsPreferred, ", only=").concat(smsIsOnly, ")"));
                            smsDto = Object.assign(new verify_phone_dto_1.SendVerificationSMSDTO(), {
                                sub: user.sub,
                                skipAlreadyVerifiedCheck: true,
                            });
                            this.phoneVerificationService
                                .sendVerificationSMS(smsDto)
                                .then(function () {
                                var _a, _b;
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "MFA SMS code sent successfully to user ".concat(user.sub));
                            })
                                .catch(function (error) {
                                var _a, _b;
                                var errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to send MFA SMS code to user ".concat(user.sub, ": ").concat(errorMessage));
                            });
                        }
                        else {
                            (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.debug) === null || _t === void 0 ? void 0 : _t.call(_s, "Skipped auto-send MFA SMS for user ".concat(user.sub, ": ") +
                                "phoneService=".concat(!!this.phoneVerificationService, ", ") +
                                "preferredMethod=".concat(preferredMethod, ", ") +
                                "smsIsPreferred=".concat(smsIsPreferred, ", ") +
                                "smsIsOnly=".concat(smsIsOnly, ", ") +
                                "deviceMethods=[".concat(deviceMethods.join(', '), "], ") +
                                "phone=".concat(!!user.phone));
                        }
                        emailIsPreferred = preferredMethod.toLowerCase() === 'email';
                        emailIsOnly = deviceMethods.length === 1 && deviceMethods[0].toLowerCase() === 'email';
                        if ((emailIsPreferred || emailIsOnly) && this.emailVerificationService && user.email) {
                            (_v = (_u = this.logger) === null || _u === void 0 ? void 0 : _u.log) === null || _v === void 0 ? void 0 : _v.call(_u, "Auto-sending MFA Email code to user ".concat(user.sub, " (preferred=").concat(emailIsPreferred, ", only=").concat(emailIsOnly, ")"));
                            emailDto = Object.assign(new verify_email_dto_1.SendVerificationEmailDTO(), {
                                sub: user.sub,
                                baseUrl: undefined,
                                skipAlreadyVerifiedCheck: true,
                            });
                            this.emailVerificationService
                                .sendVerificationEmail(emailDto)
                                .then(function () {
                                var _a, _b;
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "MFA Email code sent successfully to user ".concat(user.sub));
                            })
                                .catch(function (error) {
                                var _a, _b;
                                var errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                (_b = (_a = _this.logger) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to send MFA Email code to user ".concat(user.sub, ": ").concat(errorMessage));
                            });
                        }
                        else {
                            (_x = (_w = this.logger) === null || _w === void 0 ? void 0 : _w.debug) === null || _x === void 0 ? void 0 : _x.call(_w, "Skipped auto-send MFA Email for user ".concat(user.sub, ": ") +
                                "emailService=".concat(!!this.emailVerificationService, ", ") +
                                "preferredMethod=".concat(preferredMethod, ", ") +
                                "emailIsPreferred=".concat(emailIsPreferred, ", ") +
                                "emailIsOnly=".concat(emailIsOnly, ", ") +
                                "deviceMethods=[".concat(deviceMethods.join(', '), "], ") +
                                "email=".concat(!!user.email));
                        }
                        challengeParams = {
                            availableMethods: availableMethods,
                            preferredMethod: preferredMethod,
                        };
                        if (maskedPhone) {
                            challengeParams.maskedPhone = maskedPhone;
                        }
                        if (maskedEmail || preferredMethod.toLowerCase() === 'email') {
                            // Include maskedEmail if available, or if email is preferred (frontend will handle display)
                            challengeParams.maskedEmail = maskedEmail || user.email || '';
                        }
                        return [2 /*return*/, {
                                challengeName: auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED,
                                session: challengeSession.sessionToken,
                                challengeParameters: challengeParams,
                            }];
                }
            });
        });
    };
    // ============================================================================
    // Success Response
    // ============================================================================
    /**
     * Create successful authentication response with tokens
     *
     * Generates tokens and session for fully authenticated user.
     *
     * @param user - Authenticated user
     * @param deviceToken - Device token (optional)
     * @param isTrusted - Whether device is trusted (optional)
     * @param isSocialLogin - Whether this is a social login (optional)
     * @param metadata - Response metadata (optional)
     * @returns Auth response with tokens
     *
     * @example
     * ```typescript
     * const response = await challengeHelper.createSuccessResponse(
     *   user,
     *   'abc123',
     *   true,
     *   false
     * );
     * ```
     */
    AuthChallengeHelperService.prototype.createSuccessResponse = function (user_1, deviceToken_1, isTrusted_1) {
        return __awaiter(this, arguments, void 0, function (user, deviceToken, isTrusted, _isSocialLogin, // Reserved for future use
        _metadata) {
            var clientInfo, finalDeviceToken, tokenFamily, tempTokens, finalDeviceId, crypto_1, session, tokens, accessTokenValidation, refreshTokenValidation, response;
            var _a, _b;
            if (_isSocialLogin === void 0) { _isSocialLogin = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        finalDeviceToken = clientInfo.deviceToken || deviceToken;
                        tokenFamily = this.jwtService.generateTokenFamily();
                        return [4 /*yield*/, this.jwtService.generateTokenPair({
                                userId: user.sub, // Use sub in JWT payload (external identifier)
                                email: user.email,
                                sessionId: 'temp', // Temporary - will be regenerated with real sessionId
                                tokenFamily: tokenFamily,
                            })];
                    case 1:
                        tempTokens = _c.sent();
                        finalDeviceId = finalDeviceToken;
                        if (!!finalDeviceId) return [3 /*break*/, 3];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('crypto'); })];
                    case 2:
                        crypto_1 = _c.sent();
                        finalDeviceId = crypto_1.randomUUID();
                        _c.label = 3;
                    case 3: return [4 /*yield*/, this.sessionService.createSession({
                            userId: user.id, // Use internal id for foreign key
                            accessTokenHash: this.jwtService.hashToken(tempTokens.accessToken),
                            refreshTokenHash: this.jwtService.hashToken(tempTokens.refreshToken),
                            tokenFamily: tokenFamily,
                            deviceId: finalDeviceId,
                            expiresAt: this.sessionService.getSessionExpirationDate(),
                            authMethod: 'password', // Default to password for challenge flows (signup, verification completion)
                        })];
                    case 4:
                        session = _c.sent();
                        return [4 /*yield*/, this.jwtService.generateTokenPair({
                                userId: user.sub,
                                email: user.email,
                                sessionId: session.id.toString(),
                                tokenFamily: tokenFamily,
                            })];
                    case 5:
                        tokens = _c.sent();
                        // Update session with new token hashes
                        return [4 /*yield*/, this.sessionService.updateTokens(session.id, this.jwtService.hashToken(tokens.accessToken), this.jwtService.hashToken(tokens.refreshToken))];
                    case 6:
                        // Update session with new token hashes
                        _c.sent();
                        return [4 /*yield*/, this.jwtService.validateAccessToken(tokens.accessToken)];
                    case 7:
                        accessTokenValidation = _c.sent();
                        return [4 /*yield*/, this.jwtService.validateRefreshToken(tokens.refreshToken)];
                    case 8:
                        refreshTokenValidation = _c.sent();
                        response = {
                            accessToken: tokens.accessToken,
                            refreshToken: tokens.refreshToken,
                            accessTokenExpiresAt: ((_a = accessTokenValidation.payload) === null || _a === void 0 ? void 0 : _a.exp) || 0,
                            refreshTokenExpiresAt: ((_b = refreshTokenValidation.payload) === null || _b === void 0 ? void 0 : _b.exp) || 0,
                            trusted: isTrusted,
                            user: {
                                sub: user.sub,
                                email: user.email,
                                firstName: user.firstName || undefined,
                                lastName: user.lastName || undefined,
                                isEmailVerified: user.isEmailVerified,
                                isPhoneVerified: user.isPhoneVerified,
                                socialProviders: user.socialProviders || undefined,
                            },
                            userSub: user.sub,
                        };
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Determine and create appropriate auth response
     *
     * Main entry point that decides whether to return challenges or tokens.
     * Uses state machine to evaluate authentication flow state.
     *
     * @param params - Authentication parameters
     * @param params.user - User attempting authentication
     * @param params.config - Auth configuration
     * @param params.deviceToken - Device token (optional)
     * @param params.isSocialLogin - Whether this is a social login (OAuth) authentication (optional)
     * @param params.skipMFAVerification - Skip MFA verification flag (optional)
     * @param params.authProvider - Social auth provider name (optional)
     * @returns Auth response (either challenge or success)
     *
     * @example
     * ```typescript
     * const response = await challengeHelper.determineAuthResponse({
     *   user,
     *   config,
     *   deviceToken: 'abc123',
     *   isSocialLogin: false
     * });
     * ```
     */
    AuthChallengeHelperService.prototype.determineAuthResponse = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var user, config, deviceToken, _a, isSocialLogin, _b, skipMFAVerification, authProvider, context, state, stateDefinition, metadata, response;
            var _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        user = params.user, config = params.config, deviceToken = params.deviceToken, _a = params.isSocialLogin, isSocialLogin = _a === void 0 ? false : _a, _b = params.skipMFAVerification, skipMFAVerification = _b === void 0 ? false : _b, authProvider = params.authProvider;
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "[ChallengeHelper] determineAuthResponse called for user ".concat(user.sub, " (isSocialLogin=").concat(isSocialLogin, ", skipMFA=").concat(skipMFAVerification, ", deviceToken=").concat(deviceToken ? 'present' : 'none', ")"));
                        return [4 /*yield*/, this.contextBuilder.build({
                                user: user,
                                config: config,
                                authMethod: isSocialLogin ? 'social' : 'password',
                                authProvider: authProvider,
                                deviceToken: deviceToken,
                                skipMFAVerification: skipMFAVerification,
                            })];
                    case 1:
                        context = _j.sent();
                        return [4 /*yield*/, this.stateMachine.evaluateState(context)];
                    case 2:
                        state = _j.sent();
                        stateDefinition = this.stateMachine.getStateDefinition(state);
                        if (!stateDefinition) {
                            (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.call(_e, "No state definition found for state: ".concat(state), { state: state, userId: user.id });
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Invalid authentication state');
                        }
                        metadata = this.stateMachine.buildMetadata(state, context);
                        return [4 /*yield*/, this.stateToResponse(state, stateDefinition, context, metadata)];
                    case 3:
                        response = _j.sent();
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.debug) === null || _h === void 0 ? void 0 : _h.call(_g, "[ChallengeHelper] State ".concat(state, " \u2192 Challenge: ").concat(response.challengeName || 'SUCCESS', " for user ").concat(user.sub));
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Convert state to authentication response
     *
     * Maps state to appropriate response (challenge or success).
     * Merges state metadata into response.
     *
     * @param state - Authentication flow state
     * @param stateDefinition - State definition
     * @param context - Authentication flow context
     * @param metadata - Response metadata (optional)
     * @returns Authentication response
     */
    AuthChallengeHelperService.prototype.stateToResponse = function (state, stateDefinition, context, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, deviceToken, authMethod, isTrusted_1, response, errorCode, message, isTrusted;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        deviceToken = clientInfo.deviceToken || context.deviceToken;
                        authMethod = context.authMethod || 'password';
                        // Handle challenge states
                        if (stateDefinition.challenge) {
                            // Handle MFA_SETUP_REQUIRED challenge specially
                            if (stateDefinition.challenge === auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED) {
                                return [2 /*return*/, this.createMFASetupChallengeResponse(context.user, context.config, authMethod, context.authProvider)];
                            }
                            // Handle MFA_REQUIRED challenge specially - needs preferred method logic
                            if (stateDefinition.challenge === auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED) {
                                return [2 /*return*/, this.createMFAChallengeResponse(context.user)];
                            }
                            // Handle other challenges
                            return [2 /*return*/, this.createChallengeResponse(context.user, stateDefinition.challenge, context.config, authMethod, context.authProvider)];
                        }
                        if (!(state === auth_flow_state_machine_types_1.AuthFlowState.GRACE_PERIOD_ACTIVE)) return [3 /*break*/, 2];
                        isTrusted_1 = context.computed.isDeviceTrusted;
                        return [4 /*yield*/, this.createSuccessResponse(context.user, deviceToken, isTrusted_1, context.authMethod === 'social', metadata)];
                    case 1:
                        response = _g.sent();
                        // Merge metadata
                        if (metadata === null || metadata === void 0 ? void 0 : metadata.gracePeriodEndsAt) {
                            response.gracePeriodEndsAt = metadata.gracePeriodEndsAt;
                        }
                        if ((metadata === null || metadata === void 0 ? void 0 : metadata.riskScore) !== undefined) {
                            response.riskScore = metadata.riskScore;
                        }
                        if (metadata === null || metadata === void 0 ? void 0 : metadata.riskLevel) {
                            response.riskLevel = metadata.riskLevel;
                        }
                        return [2 /*return*/, response];
                    case 2:
                        if (state === auth_flow_state_machine_types_1.AuthFlowState.BLOCKED) {
                            errorCode = ((_c = (_b = (_a = context.config.mfa) === null || _a === void 0 ? void 0 : _a.adaptive) === null || _b === void 0 ? void 0 : _b.blockedSignIn) === null || _c === void 0 ? void 0 : _c.errorCode) ||
                                error_codes_enum_1.AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK;
                            message = (metadata === null || metadata === void 0 ? void 0 : metadata.reason) ||
                                ((_f = (_e = (_d = context.config.mfa) === null || _d === void 0 ? void 0 : _d.adaptive) === null || _e === void 0 ? void 0 : _e.blockedSignIn) === null || _f === void 0 ? void 0 : _f.message) ||
                                'Sign-in blocked due to suspicious activity';
                            throw new nauth_exception_1.NAuthException(errorCode, message, {
                                expiresAt: metadata === null || metadata === void 0 ? void 0 : metadata.blockedUntil,
                            });
                        }
                        isTrusted = context.computed.isDeviceTrusted;
                        return [2 /*return*/, this.createSuccessResponse(context.user, deviceToken, isTrusted, context.authMethod === 'social', metadata)];
                }
            });
        });
    };
    return AuthChallengeHelperService;
}());
exports.AuthChallengeHelperService = AuthChallengeHelperService;
