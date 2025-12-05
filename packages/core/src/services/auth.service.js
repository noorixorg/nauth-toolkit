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
exports.AuthService = void 0;
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var risk_factor_enum_1 = require("../enums/risk-factor.enum");
var context_storage_1 = require("../utils/context-storage");
var user_response_dto_1 = require("../dto/user-response.dto");
var auth_challenge_dto_1 = require("../dto/auth-challenge.dto");
var verify_email_dto_1 = require("../dto/verify-email.dto");
var verify_phone_dto_1 = require("../dto/verify-phone.dto");
var verify_phone_by_sub_dto_1 = require("../dto/verify-phone-by-sub.dto");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
var crypto = require("crypto");
/**
 * Dummy Argon2 hash for constant-time response
 *
 * ⚠️ SECURITY CRITICAL: Used when user doesn't exist to prevent timing attacks
 * This dummy hash has same format/cost as real Argon2id hashes but verifies against nothing.
 *
 * Format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
 */
var DUMMY_ARGON2_HASH = '$argon2id$v=19$m=65536,t=3,p=4$RFVNTVlfU0FMVF9GT1JfVElNSU5H$dummyhashfordummyhashfordummyhash1234567890';
var AuthService = /** @class */ (function () {
    function AuthService(userRepository, loginAttemptRepository, passwordService, jwtService, sessionService, challengeService, challengeHelper, emailVerificationService, clientInfoService, accountLockoutStorage, config, logger, auditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
    phoneVerificationService, // Optional - only available when SMS provider is configured
    mfaService, // Optional - available when MFA modules are imported
    mfaDeviceRepository, // Optional - available when MFA modules are imported
    trustedDeviceService) {
        var _a, _b;
        this.userRepository = userRepository;
        this.loginAttemptRepository = loginAttemptRepository;
        this.passwordService = passwordService;
        this.jwtService = jwtService;
        this.sessionService = sessionService;
        this.challengeService = challengeService;
        this.challengeHelper = challengeHelper;
        this.emailVerificationService = emailVerificationService;
        this.clientInfoService = clientInfoService;
        this.accountLockoutStorage = accountLockoutStorage;
        this.config = config;
        this.logger = logger;
        this.auditService = auditService;
        this.phoneVerificationService = phoneVerificationService;
        this.mfaService = mfaService;
        this.mfaDeviceRepository = mfaDeviceRepository;
        this.trustedDeviceService = trustedDeviceService;
        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, 'AuthService initialized');
    }
    // ============================================================================
    // User Signup
    // ============================================================================
    /**
     * Register a new user.
     *
     * Checks for duplicates (email, username, phone), validates password, hashes it,
     * creates the user, and returns tokens or a challenge if verification is required.
     *
     * @param dto - Signup payload
     * @returns Auth response with tokens or a verification challenge
     * @throws {NAuthException} If user exists, password is invalid, or signup is disabled
     *
     * @example
     * ```typescript
     * const result = await authService.signup({
     *   email: 'user@example.com',
     *   password: 'Password123!',
     *   username: 'johndoe',
     * });
     * ```
     */
    AuthService.prototype.signup = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, existingUserByEmail, existingUserByUsername, existingUserByPhone, passwordValidation, passwordHash, verificationMethod, user, savedUser, auditError_1, errorMessage, error_1, dbError, errorMessage, response;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27;
            return __generator(this, function (_28) {
                switch (_28.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Signup attempt for email: ".concat(dto.email));
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "Signup details: { email: ".concat(dto.email, ", username: ").concat(dto.username || 'none', ", ip: ").concat(clientInfo.ipAddress, " }"));
                        // Check if signup is enabled
                        if (((_e = this.config.signup) === null || _e === void 0 ? void 0 : _e.enabled) === false) {
                            (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.warn) === null || _g === void 0 ? void 0 : _g.call(_f, "Signup blocked - signup is disabled");
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SIGNUP_DISABLED, 'Signups are currently disabled');
                        }
                        // Check if user already exists (email and username)
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.debug) === null || _j === void 0 ? void 0 : _j.call(_h, "Checking if user exists: ".concat(dto.email));
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { email: dto.email },
                            })];
                    case 1:
                        existingUserByEmail = _28.sent();
                        if (existingUserByEmail) {
                            (_l = (_k = this.logger) === null || _k === void 0 ? void 0 : _k.warn) === null || _l === void 0 ? void 0 : _l.call(_k, "Signup failed - user already exists: ".concat(dto.email));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
                        }
                        if (!dto.username) return [3 /*break*/, 3];
                        (_o = (_m = this.logger) === null || _m === void 0 ? void 0 : _m.debug) === null || _o === void 0 ? void 0 : _o.call(_m, "Checking if username exists: ".concat(dto.username));
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { username: dto.username },
                            })];
                    case 2:
                        existingUserByUsername = _28.sent();
                        if (existingUserByUsername) {
                            (_q = (_p = this.logger) === null || _p === void 0 ? void 0 : _p.warn) === null || _q === void 0 ? void 0 : _q.call(_p, "Signup failed - username already exists: ".concat(dto.username));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
                        }
                        _28.label = 3;
                    case 3:
                        if (!(dto.phone && !((_r = this.config.signup) === null || _r === void 0 ? void 0 : _r.allowDuplicatePhones))) return [3 /*break*/, 5];
                        (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.debug) === null || _t === void 0 ? void 0 : _t.call(_s, "Checking if phone exists: ".concat(dto.phone));
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { phone: dto.phone },
                            })];
                    case 4:
                        existingUserByPhone = _28.sent();
                        if (existingUserByPhone) {
                            (_v = (_u = this.logger) === null || _u === void 0 ? void 0 : _u.warn) === null || _v === void 0 ? void 0 : _v.call(_u, "Signup failed - phone already exists: ".concat(dto.phone));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
                        }
                        _28.label = 5;
                    case 5:
                        // Validate password policy
                        (_x = (_w = this.logger) === null || _w === void 0 ? void 0 : _w.debug) === null || _x === void 0 ? void 0 : _x.call(_w, 'Validating password against policy');
                        return [4 /*yield*/, this.passwordService.validatePassword(dto.password, {
                                email: dto.email,
                                username: dto.username,
                            })];
                    case 6:
                        passwordValidation = _28.sent();
                        if (!passwordValidation.valid) {
                            (_z = (_y = this.logger) === null || _y === void 0 ? void 0 : _y.warn) === null || _z === void 0 ? void 0 : _z.call(_y, "Password validation failed for ".concat(dto.email, ": ").concat(passwordValidation.errors.join(', ')));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.WEAK_PASSWORD, passwordValidation.errors.join(', '), {
                                errors: passwordValidation.errors,
                            });
                        }
                        return [4 /*yield*/, this.passwordService.hashPassword(dto.password)];
                    case 7:
                        passwordHash = _28.sent();
                        verificationMethod = (_0 = this.config.signup) === null || _0 === void 0 ? void 0 : _0.verificationMethod;
                        // Validate required fields based on verification method
                        if ((verificationMethod === 'phone' || verificationMethod === 'both') && !dto.phone) {
                            (_2 = (_1 = this.logger) === null || _1 === void 0 ? void 0 : _1.warn) === null || _2 === void 0 ? void 0 : _2.call(_1, "Signup failed - phone required for verification method: ".concat(verificationMethod));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PHONE_REQUIRED, 'Phone number is required for the selected verification method', { verificationMethod: verificationMethod });
                        }
                        // Create user
                        // Users are always created as ACTIVE (so they can complete pending challenges)
                        // Verification status controls access via challenge system, not account activation
                        // Email and phone verification status is always false initially - must be explicitly verified
                        (_4 = (_3 = this.logger) === null || _3 === void 0 ? void 0 : _3.debug) === null || _4 === void 0 ? void 0 : _4.call(_3, "Creating user record for: ".concat(dto.email, " || ").concat(dto.username, " || ").concat(dto.phone));
                        user = this.userRepository.create({
                            email: dto.email,
                            username: dto.username,
                            firstName: dto.firstName,
                            lastName: dto.lastName,
                            phone: dto.phone,
                            passwordHash: passwordHash,
                            passwordChangedAt: new Date(),
                            isEmailVerified: false, // Always false initially - must be explicitly verified
                            isPhoneVerified: false, // Always false initially - must be verified via SMS
                            isActive: true, // Always active - challenges control access instead
                            metadata: dto.metadata,
                        });
                        _28.label = 8;
                    case 8:
                        _28.trys.push([8, 14, , 15]);
                        return [4 /*yield*/, this.userRepository.save(user)];
                    case 9:
                        savedUser = (_28.sent());
                        (_6 = (_5 = this.logger) === null || _5 === void 0 ? void 0 : _5.log) === null || _6 === void 0 ? void 0 : _6.call(_5, "User created successfully: ".concat(dto.email, " (sub: ").concat(savedUser.sub, ")"));
                        _28.label = 10;
                    case 10:
                        _28.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, ((_7 = this.auditService) === null || _7 === void 0 ? void 0 : _7.recordEvent({
                                userId: savedUser.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.ACCOUNT_CREATED,
                                eventStatus: 'INFO',
                                authMethod: 'password',
                                // Client info automatically included from context
                                metadata: {
                                    email: savedUser.email,
                                    username: savedUser.username || null,
                                    verificationMethod: verificationMethod,
                                },
                            }))];
                    case 11:
                        _28.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        auditError_1 = _28.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_9 = (_8 = this.logger) === null || _8 === void 0 ? void 0 : _8.error) === null || _9 === void 0 ? void 0 : _9.call(_8, "Failed to record ACCOUNT_CREATED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: savedUser.id,
                        });
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        error_1 = _28.sent();
                        // Handle database constraint violations gracefully
                        if (error_1 && typeof error_1 === 'object' && 'code' in error_1 && error_1.code === '23505') {
                            dbError = error_1;
                            if ((_10 = dbError.detail) === null || _10 === void 0 ? void 0 : _10.includes('email')) {
                                (_12 = (_11 = this.logger) === null || _11 === void 0 ? void 0 : _11.warn) === null || _12 === void 0 ? void 0 : _12.call(_11, "Signup failed - email constraint violation: ".concat(dto.email));
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.EMAIL_EXISTS, 'User with this email already exists');
                            }
                            else if ((_13 = dbError.detail) === null || _13 === void 0 ? void 0 : _13.includes('username')) {
                                (_15 = (_14 = this.logger) === null || _14 === void 0 ? void 0 : _14.warn) === null || _15 === void 0 ? void 0 : _15.call(_14, "Signup failed - username constraint violation: ".concat(dto.username));
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.USERNAME_EXISTS, 'Username is already taken');
                            }
                            else if ((_16 = dbError.detail) === null || _16 === void 0 ? void 0 : _16.includes('phone')) {
                                (_18 = (_17 = this.logger) === null || _17 === void 0 ? void 0 : _17.warn) === null || _18 === void 0 ? void 0 : _18.call(_17, "Signup failed - phone constraint violation: ".concat(dto.phone));
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PHONE_EXISTS, 'Phone number is already registered');
                            }
                            else {
                                (_20 = (_19 = this.logger) === null || _19 === void 0 ? void 0 : _19.error) === null || _20 === void 0 ? void 0 : _20.call(_19, "Signup failed - database constraint violation: ".concat(dbError.message));
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.EMAIL_EXISTS, 'User with this information already exists', {
                                    conflictType: 'unknown',
                                });
                            }
                        }
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown database error';
                        (_22 = (_21 = this.logger) === null || _21 === void 0 ? void 0 : _21.error) === null || _22 === void 0 ? void 0 : _22.call(_21, "Signup failed - database error: ".concat(errorMessage));
                        throw error_1;
                    case 15:
                        if (!((_23 = this.config.hooks) === null || _23 === void 0 ? void 0 : _23.afterSignup)) return [3 /*break*/, 17];
                        return [4 /*yield*/, this.config.hooks.afterSignup(savedUser, { requiresVerification: verificationMethod !== 'none' })];
                    case 16:
                        _28.sent();
                        _28.label = 17;
                    case 17: return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                            user: savedUser,
                            config: this.config,
                            deviceToken: clientInfo.deviceToken,
                        })];
                    case 18:
                        response = _28.sent();
                        if (response.challengeName) {
                            (_25 = (_24 = this.logger) === null || _24 === void 0 ? void 0 : _24.log) === null || _25 === void 0 ? void 0 : _25.call(_24, "Challenge required for user ".concat(savedUser.sub, ": ").concat(response.challengeName));
                        }
                        else {
                            (_27 = (_26 = this.logger) === null || _26 === void 0 ? void 0 : _26.log) === null || _27 === void 0 ? void 0 : _27.call(_26, "Signup successful - tokens issued for: ".concat(dto.email));
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    // ============================================================================
    // User Login
    // ============================================================================
    /**
     * Log in a user with identifier (email, username, or phone) and password.
     *
     * Handles client/device context, login hooks, lockout checks, audit logging, password verification,
     * and challenge flow (MFA/verification) if required.
     *
     * @param dto - Login credentials (identifier and password)
     * @returns Authentication response containing challenge details if required, or tokens on success
     * @throws {NAuthException} On login failure, forbidden access, or account lockout
     *
     * @example
     * ```typescript
     * const res = await authService.login({ identifier: 'user@email.com', password: 'Pass123!' });
     * if (res.challengeName) {
     *   // prompt user for verification code
     * }
     * ```
     */
    AuthService.prototype.login = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, fireAndForget, clientInfo_1, ipAddress, isLocked, auditError_2, errorMessage, identifierType, isValidIdentifier, user, hashToVerify, isPasswordValid, auditError_3, errorMessage, provider, providerName, expiryDays, expiryDate, now, response_1, response, reasonMap, isTrustedDevice, mfaBypassed, mfaBypassReason, userEntityDebug, userMfaExempt, enforcement, wouldRequireMFA, auditError_4, errorMessage, ipAddress, validatedDeviceId, tokenFamily, revokedCount, atomic, session, tokens, auditError_5, errorMessage, deviceToken, isTrusted, rememberDevicesMode, error_2, errorMessage, accessTokenValidation, refreshTokenValidation, userDto;
            var _a;
            var _this = this;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53;
            return __generator(this, function (_54) {
                switch (_54.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        fireAndForget = ((_b = this.config.auditLogs) === null || _b === void 0 ? void 0 : _b.fireAndForget) === true;
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "Login attempt for: ".concat(dto.identifier));
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.debug) === null || _f === void 0 ? void 0 : _f.call(_e, "Login details: { identifier: ".concat(dto.identifier, ", ip: ").concat(clientInfo.ipAddress, ", deviceToken: ").concat(clientInfo.deviceToken ? 'present' : 'none', " }"));
                        if (!((_g = this.config.lockout) === null || _g === void 0 ? void 0 : _g.enabled)) return [3 /*break*/, 7];
                        clientInfo_1 = this.clientInfoService.get();
                        ipAddress = clientInfo_1.ipAddress;
                        if (!ipAddress) return [3 /*break*/, 7];
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.debug) === null || _j === void 0 ? void 0 : _j.call(_h, "Checking IP lockout status for: ".concat(ipAddress));
                        return [4 /*yield*/, this.accountLockoutStorage.isAccountLocked(ipAddress)];
                    case 1:
                        isLocked = _54.sent();
                        if (!isLocked) return [3 /*break*/, 7];
                        (_l = (_k = this.logger) === null || _k === void 0 ? void 0 : _k.warn) === null || _l === void 0 ? void 0 : _l.call(_k, "Login blocked - IP locked: ".concat(ipAddress));
                        return [4 /*yield*/, this.recordLoginAttempt(dto.identifier, false, 'ip_locked')];
                    case 2:
                        _54.sent();
                        if (!fireAndForget) return [3 /*break*/, 3];
                        (_m = this.auditService) === null || _m === void 0 ? void 0 : _m.recordEvent({
                            userSub: dto.identifier,
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_BLOCKED,
                            eventStatus: 'FAILURE',
                            authMethod: 'password',
                            reason: 'ip_locked',
                            description: 'Login blocked - IP address locked due to too many failed attempts',
                        }).catch(function () { return undefined; });
                        return [3 /*break*/, 6];
                    case 3:
                        _54.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, ((_o = this.auditService) === null || _o === void 0 ? void 0 : _o.recordEvent({
                                userSub: dto.identifier,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_BLOCKED,
                                eventStatus: 'FAILURE',
                                authMethod: 'password',
                                reason: 'ip_locked',
                                description: 'Login blocked - IP address locked due to too many failed attempts',
                            }))];
                    case 4:
                        _54.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_2 = _54.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_q = (_p = this.logger) === null || _p === void 0 ? void 0 : _p.error) === null || _q === void 0 ? void 0 : _q.call(_p, "Failed to record LOGIN_BLOCKED audit event (IP locked): ".concat(errorMessage), {
                            error: auditError_2,
                        });
                        return [3 /*break*/, 6];
                    case 6: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_LOGIN, 'Too many failed attempts from this IP. Please try again later.');
                    case 7:
                        identifierType = (_r = this.config.login) === null || _r === void 0 ? void 0 : _r.identifierType;
                        if (!identifierType) return [3 /*break*/, 9];
                        (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.debug) === null || _t === void 0 ? void 0 : _t.call(_s, "Validating identifier type for: ".concat(dto.identifier, ", allowed type: ").concat(identifierType));
                        isValidIdentifier = this.validateIdentifierType(dto.identifier, identifierType);
                        if (!!isValidIdentifier) return [3 /*break*/, 9];
                        (_v = (_u = this.logger) === null || _u === void 0 ? void 0 : _u.warn) === null || _v === void 0 ? void 0 : _v.call(_u, "Login rejected - identifier type mismatch. Identifier: ".concat(dto.identifier, ", Required: ").concat(identifierType));
                        return [4 /*yield*/, this.handleFailedLogin(dto.identifier, 'identifier_type_mismatch')];
                    case 8:
                        _54.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INVALID_CREDENTIALS, "Login with this identifier type is not allowed. Expected: ".concat(identifierType));
                    case 9:
                        // Find user by email, username, or phone (filtered by identifierType config)
                        (_x = (_w = this.logger) === null || _w === void 0 ? void 0 : _w.debug) === null || _x === void 0 ? void 0 : _x.call(_w, "Finding user by identifier: ".concat(dto.identifier));
                        return [4 /*yield*/, this.findUserByIdentifier(dto.identifier, identifierType)];
                    case 10:
                        user = _54.sent();
                        hashToVerify = (user === null || user === void 0 ? void 0 : user.passwordHash) || DUMMY_ARGON2_HASH;
                        // Verify password (takes ~200-300ms regardless of user existence)
                        (_z = (_y = this.logger) === null || _y === void 0 ? void 0 : _y.debug) === null || _z === void 0 ? void 0 : _z.call(_y, 'Verifying password');
                        return [4 /*yield*/, this.passwordService.verifyPassword(dto.password, hashToVerify)];
                    case 11:
                        isPasswordValid = _54.sent();
                        if (!(!user || !user.passwordHash || !isPasswordValid)) return [3 /*break*/, 17];
                        (_1 = (_0 = this.logger) === null || _0 === void 0 ? void 0 : _0.warn) === null || _1 === void 0 ? void 0 : _1.call(_0, "Login failed - invalid credentials for: ".concat(dto.identifier));
                        return [4 /*yield*/, this.handleFailedLogin(dto.identifier, 'invalid_credentials')];
                    case 12:
                        _54.sent();
                        if (!user) return [3 /*break*/, 16];
                        if (!fireAndForget) return [3 /*break*/, 13];
                        (_2 = this.auditService) === null || _2 === void 0 ? void 0 : _2.recordEvent({
                            userId: user.id,
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_FAILED,
                            eventStatus: 'FAILURE',
                            authMethod: 'password',
                            reason: 'invalid_credentials',
                            description: 'Invalid password or user not found',
                        }).catch(function () { return undefined; });
                        return [3 /*break*/, 16];
                    case 13:
                        _54.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, ((_3 = this.auditService) === null || _3 === void 0 ? void 0 : _3.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_FAILED,
                                eventStatus: 'FAILURE',
                                authMethod: 'password',
                                reason: 'invalid_credentials',
                                description: 'Invalid password or user not found',
                            }))];
                    case 14:
                        _54.sent();
                        return [3 /*break*/, 16];
                    case 15:
                        auditError_3 = _54.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_5 = (_4 = this.logger) === null || _4 === void 0 ? void 0 : _4.error) === null || _5 === void 0 ? void 0 : _5.call(_4, "Failed to record LOGIN_FAILED audit event: ".concat(errorMessage), {
                            error: auditError_3,
                            userId: user === null || user === void 0 ? void 0 : user.id,
                        });
                        return [3 /*break*/, 16];
                    case 16:
                        // Provide helpful error if user exists but has no password (social-only account)
                        if (user && !user.passwordHash && user.socialProviders && user.socialProviders.length > 0) {
                            provider = user.socialProviders[0];
                            providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INVALID_CREDENTIALS, "Invalid credentials - use your ".concat(providerName, " account"), {
                                suggestedProvider: providerName,
                            });
                        }
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
                    case 17:
                        expiryDays = (_6 = this.config.password) === null || _6 === void 0 ? void 0 : _6.expiryDays;
                        if (!(expiryDays && expiryDays > 0 && user.passwordChangedAt)) return [3 /*break*/, 20];
                        expiryDate = new Date(user.passwordChangedAt);
                        expiryDate.setDate(expiryDate.getDate() + expiryDays);
                        now = new Date();
                        if (!(now > expiryDate)) return [3 /*break*/, 20];
                        (_8 = (_7 = this.logger) === null || _7 === void 0 ? void 0 : _7.warn) === null || _8 === void 0 ? void 0 : _8.call(_7, "Password expired for user: ".concat(user.sub, ". Changed: ").concat(user.passwordChangedAt, ", Expiry: ").concat(expiryDate));
                        // Force password change by setting mustChangePassword flag
                        return [4 /*yield*/, this.userRepository.update(user.id, {
                                mustChangePassword: true,
                            })];
                    case 18:
                        // Force password change by setting mustChangePassword flag
                        _54.sent();
                        // Update in-memory user reference to include mustChangePassword
                        user.mustChangePassword = true;
                        return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                                user: user,
                                config: this.config,
                                deviceToken: clientInfo.deviceToken,
                                isSocialLogin: false,
                            })];
                    case 19:
                        response_1 = _54.sent();
                        if (response_1.challengeName) {
                            (_10 = (_9 = this.logger) === null || _9 === void 0 ? void 0 : _9.warn) === null || _10 === void 0 ? void 0 : _10.call(_9, "Login blocked - password expired, challenge: ".concat(response_1.challengeName, " for ").concat(dto.identifier));
                            return [2 /*return*/, response_1];
                        }
                        _54.label = 20;
                    case 20: return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                            user: user,
                            config: this.config,
                            deviceToken: clientInfo.deviceToken,
                            isSocialLogin: false,
                        })];
                    case 21:
                        response = _54.sent();
                        if (!response.challengeName) return [3 /*break*/, 23];
                        reasonMap = (_a = {},
                            _a[auth_challenge_dto_1.AuthChallenge.VERIFY_EMAIL] = 'verification_required',
                            _a[auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE] = 'verification_required',
                            _a[auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED] = 'mfa_setup_required',
                            _a[auth_challenge_dto_1.AuthChallenge.FORCE_CHANGE_PASSWORD] = 'password_change_required',
                            _a[auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED] = 'mfa_required',
                            _a);
                        (_12 = (_11 = this.logger) === null || _11 === void 0 ? void 0 : _11.warn) === null || _12 === void 0 ? void 0 : _12.call(_11, "Login blocked - pending challenge: ".concat(response.challengeName, " for ").concat(dto.identifier, " (sub: ").concat(user.sub, ")"));
                        return [4 /*yield*/, this.recordLoginAttempt(dto.identifier, false, reasonMap[response.challengeName] || 'challenge_required', user.id)];
                    case 22:
                        _54.sent();
                        return [2 /*return*/, response];
                    case 23:
                        isTrustedDevice = false;
                        mfaBypassed = false;
                        mfaBypassReason = null;
                        if (!(((_13 = this.config.mfa) === null || _13 === void 0 ? void 0 : _13.rememberDevices) &&
                            ((_14 = this.config.mfa) === null || _14 === void 0 ? void 0 : _14.rememberDevices) !== 'never' &&
                            this.trustedDeviceService &&
                            clientInfo.deviceToken)) return [3 /*break*/, 25];
                        return [4 /*yield*/, this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, user.id)];
                    case 24:
                        isTrustedDevice = _54.sent();
                        _54.label = 25;
                    case 25:
                        userEntityDebug = user;
                        userMfaExempt = userEntityDebug.mfaExempt === true || userEntityDebug.mfaExempt === 'true';
                        // Determine if MFA was bypassed
                        // MFA is bypassed if:
                        // 1. No challenge was returned (meaning MFA was skipped)
                        // 2. MFA would have been required otherwise
                        // 3. Either:
                        //    a. Device is trusted AND bypassMFAForTrustedDevices is enabled (trusted device bypass)
                        //    b. User has mfaExempt = true (MFA exemption bypass)
                        if (!response.challengeName && this.config.mfa) {
                            enforcement = this.config.mfa.enforcement || 'OPTIONAL';
                            wouldRequireMFA = (enforcement === 'OPTIONAL' && user.mfaEnabled) || enforcement === 'REQUIRED' || enforcement === 'ADAPTIVE';
                            if (wouldRequireMFA) {
                                // Check if bypassed due to trusted device
                                if (isTrustedDevice &&
                                    this.config.mfa.bypassMFAForTrustedDevices === true &&
                                    enforcement !== 'ADAPTIVE' && // Adaptive MFA could bypass it anyway if device is trusted but requires different logging
                                    !userMfaExempt) {
                                    mfaBypassed = true;
                                    mfaBypassReason = 'trusted_device';
                                    (_16 = (_15 = this.logger) === null || _15 === void 0 ? void 0 : _15.debug) === null || _16 === void 0 ? void 0 : _16.call(_15, "MFA bypassed for trusted device - user ".concat(user.sub));
                                }
                                // Check if bypassed due to MFA exemption
                                else if (userMfaExempt) {
                                    mfaBypassed = true;
                                    mfaBypassReason = 'mfa_exempt';
                                    (_18 = (_17 = this.logger) === null || _17 === void 0 ? void 0 : _17.debug) === null || _18 === void 0 ? void 0 : _18.call(_17, "MFA bypassed due to exemption - user ".concat(user.sub));
                                }
                            }
                        }
                        if (!!user.isActive) return [3 /*break*/, 31];
                        (_20 = (_19 = this.logger) === null || _19 === void 0 ? void 0 : _19.warn) === null || _20 === void 0 ? void 0 : _20.call(_19, "Login failed - account inactive: ".concat(dto.identifier, " (sub: ").concat(user.sub, ")"));
                        return [4 /*yield*/, this.recordLoginAttempt(dto.identifier, false, 'account_inactive', user.id)];
                    case 26:
                        _54.sent();
                        _54.label = 27;
                    case 27:
                        _54.trys.push([27, 29, , 30]);
                        return [4 /*yield*/, ((_21 = this.auditService) === null || _21 === void 0 ? void 0 : _21.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_BLOCKED,
                                eventStatus: 'FAILURE',
                                authMethod: 'password',
                                reason: 'account_inactive',
                                description: 'Login blocked - account is inactive',
                                // Client info automatically included from context
                            }))];
                    case 28:
                        _54.sent();
                        return [3 /*break*/, 30];
                    case 29:
                        auditError_4 = _54.sent();
                        errorMessage = auditError_4 instanceof Error ? auditError_4.message : 'Unknown error';
                        (_23 = (_22 = this.logger) === null || _22 === void 0 ? void 0 : _22.error) === null || _23 === void 0 ? void 0 : _23.call(_22, "Failed to record LOGIN_BLOCKED audit event (account inactive): ".concat(errorMessage), {
                            error: auditError_4,
                            userId: user.id,
                        });
                        return [3 /*break*/, 30];
                    case 30: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.ACCOUNT_INACTIVE, 'Account is inactive. Please contact support.');
                    case 31:
                        if (!(((_24 = this.config.lockout) === null || _24 === void 0 ? void 0 : _24.enabled) && this.config.lockout.resetOnSuccess)) return [3 /*break*/, 33];
                        ipAddress = clientInfo.ipAddress;
                        if (!ipAddress) return [3 /*break*/, 33];
                        (_26 = (_25 = this.logger) === null || _25 === void 0 ? void 0 : _25.debug) === null || _26 === void 0 ? void 0 : _26.call(_25, "Resetting failed login attempts for IP: ".concat(ipAddress));
                        return [4 /*yield*/, this.accountLockoutStorage.resetFailedAttempts(ipAddress)];
                    case 32:
                        _54.sent();
                        _54.label = 33;
                    case 33:
                        validatedDeviceId = crypto.randomUUID();
                        (_28 = (_27 = this.logger) === null || _27 === void 0 ? void 0 : _27.debug) === null || _28 === void 0 ? void 0 : _28.call(_27, "Generated server-side deviceId: ".concat(validatedDeviceId));
                        tokenFamily = this.jwtService.generateTokenFamily();
                        if (!((_29 = this.config.session) === null || _29 === void 0 ? void 0 : _29.disallowMultipleSessions)) return [3 /*break*/, 35];
                        (_31 = (_30 = this.logger) === null || _30 === void 0 ? void 0 : _30.debug) === null || _31 === void 0 ? void 0 : _31.call(_30, "Single session mode enabled - revoking other sessions for user: ".concat(user.sub));
                        return [4 /*yield*/, this.sessionService.revokeAllUserSessions(user.id, 'Login from new session')];
                    case 34:
                        revokedCount = _54.sent();
                        if (revokedCount > 0) {
                            (_33 = (_32 = this.logger) === null || _32 === void 0 ? void 0 : _32.log) === null || _33 === void 0 ? void 0 : _33.call(_32, "Revoked ".concat(revokedCount, " other active session(s) for user: ").concat(user.sub));
                        }
                        _54.label = 35;
                    case 35:
                        // Atomically create session and persist token hashes
                        (_35 = (_34 = this.logger) === null || _34 === void 0 ? void 0 : _34.debug) === null || _35 === void 0 ? void 0 : _35.call(_34, "Creating login session for user: ".concat(user.sub));
                        return [4 /*yield*/, this.sessionService.createSessionAtomic({
                                userId: user.id,
                                tokenFamily: tokenFamily,
                                deviceId: validatedDeviceId,
                                deviceName: dto.deviceName,
                                deviceType: dto.deviceType,
                                // Client info (ipAddress, ipCountry, ipCity, userAgent) automatically extracted from ClientInfoService
                                isRemembered: false,
                                expiresAt: this.sessionService.getSessionExpirationDate(),
                                authMethod: 'password',
                            }, function (sessionId) { return __awaiter(_this, void 0, void 0, function () {
                                var pair;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.jwtService.generateTokenPair({
                                                userId: user.sub,
                                                email: user.email,
                                                sessionId: sessionId.toString(),
                                                tokenFamily: tokenFamily,
                                            })];
                                        case 1:
                                            pair = _a.sent();
                                            return [2 /*return*/, {
                                                    accessTokenHash: this.jwtService.hashToken(pair.accessToken),
                                                    refreshTokenHash: this.jwtService.hashToken(pair.refreshToken),
                                                    extra: pair,
                                                }];
                                    }
                                });
                            }); })];
                    case 36:
                        atomic = _54.sent();
                        session = atomic.session;
                        tokens = atomic.extra;
                        (_37 = (_36 = this.logger) === null || _36 === void 0 ? void 0 : _36.debug) === null || _37 === void 0 ? void 0 : _37.call(_36, "Session created: ".concat(session.id));
                        // Update user last login info - use internal id for update
                        return [4 /*yield*/, this.userRepository.update(user.id, {
                                lastLoginAt: new Date(),
                                lastLoginIp: clientInfo.ipAddress,
                                failedLoginAttempts: 0,
                            })];
                    case 37:
                        // Update user last login info - use internal id for update
                        _54.sent();
                        // Record successful login attempt - use internal id
                        return [4 /*yield*/, this.recordLoginAttempt(dto.identifier, true, undefined, user.id)];
                    case 38:
                        // Record successful login attempt - use internal id
                        _54.sent();
                        (_39 = (_38 = this.logger) === null || _38 === void 0 ? void 0 : _38.log) === null || _39 === void 0 ? void 0 : _39.call(_38, "Login successful for: ".concat(dto.identifier, " (sub: ").concat(user.sub, ") from ").concat(clientInfo.ipAddress));
                        if (!fireAndForget) return [3 /*break*/, 39];
                        (_40 = this.auditService) === null || _40 === void 0 ? void 0 : _40.recordEvent({
                            userId: user.id,
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_SUCCESS,
                            eventStatus: 'SUCCESS',
                            sessionId: session.id,
                            deviceId: validatedDeviceId || undefined,
                            authMethod: 'password',
                            metadata: { trustedDevice: isTrustedDevice, mfaBypassed: mfaBypassed, mfaBypassReason: mfaBypassReason },
                        }).catch(function () { return undefined; });
                        return [3 /*break*/, 42];
                    case 39:
                        _54.trys.push([39, 41, , 42]);
                        return [4 /*yield*/, ((_41 = this.auditService) === null || _41 === void 0 ? void 0 : _41.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_SUCCESS,
                                eventStatus: 'SUCCESS',
                                sessionId: session.id,
                                deviceId: validatedDeviceId || undefined,
                                authMethod: 'password',
                                metadata: { trustedDevice: isTrustedDevice, mfaBypassed: mfaBypassed, mfaBypassReason: mfaBypassReason },
                            }))];
                    case 40:
                        _54.sent();
                        return [3 /*break*/, 42];
                    case 41:
                        auditError_5 = _54.sent();
                        errorMessage = auditError_5 instanceof Error ? auditError_5.message : 'Unknown error';
                        (_43 = (_42 = this.logger) === null || _42 === void 0 ? void 0 : _42.error) === null || _43 === void 0 ? void 0 : _43.call(_42, "Failed to record LOGIN_SUCCESS audit event: ".concat(errorMessage), {
                            error: auditError_5,
                            userId: user.id,
                        });
                        return [3 /*break*/, 42];
                    case 42:
                        isTrusted = false;
                        if (!(((_44 = this.config.mfa) === null || _44 === void 0 ? void 0 : _44.rememberDevices) && ((_45 = this.config.mfa) === null || _45 === void 0 ? void 0 : _45.rememberDevices) !== 'never' && this.trustedDeviceService)) return [3 /*break*/, 48];
                        rememberDevicesMode = this.config.mfa.rememberDevices;
                        if (!clientInfo.deviceToken) return [3 /*break*/, 44];
                        return [4 /*yield*/, this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, user.id)];
                    case 43:
                        isTrusted = _54.sent();
                        if (isTrusted) {
                            deviceToken = clientInfo.deviceToken; // Reuse existing token
                            (_47 = (_46 = this.logger) === null || _46 === void 0 ? void 0 : _46.debug) === null || _47 === void 0 ? void 0 : _47.call(_46, "Device already trusted for user ".concat(user.sub));
                        }
                        _54.label = 44;
                    case 44:
                        if (!(rememberDevicesMode === 'always' && !isTrusted)) return [3 /*break*/, 48];
                        _54.label = 45;
                    case 45:
                        _54.trys.push([45, 47, , 48]);
                        return [4 /*yield*/, this.trustedDeviceService.createTrustedDevice(user.id, dto.deviceName || clientInfo.deviceName, dto.deviceType || clientInfo.deviceType, clientInfo.ipAddress, clientInfo.userAgent, clientInfo.platform, clientInfo.browser)];
                    case 46:
                        deviceToken = _54.sent();
                        isTrusted = true;
                        (_49 = (_48 = this.logger) === null || _48 === void 0 ? void 0 : _48.debug) === null || _49 === void 0 ? void 0 : _49.call(_48, "Auto-created trusted device token for user ".concat(user.sub, " (always mode)"));
                        return [3 /*break*/, 48];
                    case 47:
                        error_2 = _54.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        (_51 = (_50 = this.logger) === null || _50 === void 0 ? void 0 : _50.warn) === null || _51 === void 0 ? void 0 : _51.call(_50, "Failed to create trusted device token: ".concat(errorMessage), { error: error_2 });
                        return [3 /*break*/, 48];
                    case 48: return [4 /*yield*/, this.jwtService.validateAccessToken(tokens.accessToken)];
                    case 49:
                        accessTokenValidation = _54.sent();
                        return [4 /*yield*/, this.jwtService.validateRefreshToken(tokens.refreshToken)];
                    case 50:
                        refreshTokenValidation = _54.sent();
                        userDto = user_response_dto_1.UserResponseDto.fromEntity(user);
                        return [2 /*return*/, {
                                user: {
                                    sub: userDto.sub,
                                    email: userDto.email,
                                    firstName: userDto.firstName || undefined,
                                    lastName: userDto.lastName || undefined,
                                    isEmailVerified: userDto.isEmailVerified,
                                    socialProviders: userDto.socialProviders || undefined,
                                    hasPasswordHash: userDto.hasPasswordHash,
                                },
                                accessToken: tokens.accessToken,
                                refreshToken: tokens.refreshToken,
                                accessTokenExpiresAt: ((_52 = accessTokenValidation.payload) === null || _52 === void 0 ? void 0 : _52.exp) || 0,
                                refreshTokenExpiresAt: ((_53 = refreshTokenValidation.payload) === null || _53 === void 0 ? void 0 : _53.exp) || 0,
                                trusted: isTrusted, // Include trusted flag so frontend knows if device is already trusted
                                // Include deviceToken - CookieTokenInterceptor will handle cookie/stripping based on @TokenDelivery decorator
                                deviceToken: deviceToken,
                            }];
                }
            });
        });
    };
    /**
     * Complete an authentication challenge using the provided response data.
     *
     * Handles all challenge types (email verification, phone verification, MFA, password change, MFA setup).
     * Validates the session, challenge type, and parameters, and returns the result (tokens or next challenge).
     *
     * @param responseData - Data for responding to the challenge
     * @returns The authentication response (tokens or next challenge requirement)
     * @throws {NAuthException} If validation fails or the challenge type is unknown
     *
     * @example
     * ```typescript
     * // Example for email verification:
     * const dto = Object.assign(new RespondChallengeDTO(), {
     *   session: 'session-token',
     *   type: 'VERIFY_EMAIL',
     *   code: '123456',
     * });
     * await authService.respondToChallenge(dto);
     * ```
     */
    AuthService.prototype.respondToChallenge = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var responseData, session, type, challengeSession, _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        responseData = dto;
                        session = responseData.session, type = responseData.type;
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.log) === null || _c === void 0 ? void 0 : _c.call(_b, "Challenge response received: type=".concat(type));
                        return [4 /*yield*/, this.challengeService.validateSession(session)];
                    case 1:
                        challengeSession = _d.sent();
                        // Validate response matches expected challenge
                        this.validateChallengeTypeMatch(challengeSession.challengeName, type);
                        // Validate parameters for this challenge type
                        // TODO: Later check if we can use classvalidator to replicate the logic of DTO validation centrally
                        this.validateChallengeParams(type, responseData);
                        _a = type;
                        switch (_a) {
                            case 'VERIFY_EMAIL': return [3 /*break*/, 2];
                            case 'VERIFY_PHONE': return [3 /*break*/, 4];
                            case 'MFA_REQUIRED': return [3 /*break*/, 6];
                            case 'FORCE_CHANGE_PASSWORD': return [3 /*break*/, 8];
                            case 'MFA_SETUP_REQUIRED': return [3 /*break*/, 10];
                        }
                        return [3 /*break*/, 12];
                    case 2: return [4 /*yield*/, this.handleVerifyEmail(challengeSession, responseData.code)];
                    case 3: return [2 /*return*/, _d.sent()];
                    case 4: return [4 /*yield*/, this.handleVerifyPhone(challengeSession, responseData)];
                    case 5: return [2 /*return*/, _d.sent()];
                    case 6: return [4 /*yield*/, this.handleMFAVerification(challengeSession, responseData)];
                    case 7: return [2 /*return*/, _d.sent()];
                    case 8: return [4 /*yield*/, this.handleForceChangePassword(challengeSession, responseData.newPassword)];
                    case 9: return [2 /*return*/, _d.sent()];
                    case 10: return [4 /*yield*/, this.handleMFASetup(challengeSession, responseData)];
                    case 11: return [2 /*return*/, _d.sent()];
                    case 12: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Unknown challenge type: ".concat(type));
                }
            });
        });
    };
    /**
     * Validate that response type matches expected challenge type
     */
    AuthService.prototype.validateChallengeTypeMatch = function (expected, provided) {
        if (expected !== provided) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Challenge type mismatch: expected ".concat(expected, ", got ").concat(provided));
        }
    };
    /**
     * Validate parameters for challenge type
     *
     * Service-level validation ensures Express/other frameworks get same validation as NestJS.
     * This is critical for non-DTO-based applications.
     */
    AuthService.prototype.validateChallengeParams = function (type, data) {
        switch (type) {
            case 'VERIFY_EMAIL': {
                var response = data;
                if (!response.code || typeof response.code !== 'string') {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Verification code is required', { field: 'code' });
                }
                break;
            }
            case 'VERIFY_PHONE': {
                var response = data;
                var hasCode = 'code' in response && response.code;
                var hasPhone = 'phone' in response && response.phone;
                if (!hasCode && !hasPhone) {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Either phone number or verification code is required', { fields: ['phone', 'code'] });
                }
                break;
            }
            case 'MFA_REQUIRED': {
                var response = data;
                if (!response.method) {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MFA method is required', { field: 'method' });
                }
                if (response.method === 'passkey') {
                    var passkeyResponse = response;
                    if (!passkeyResponse.credential) {
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Passkey credential is required', {
                            field: 'credential',
                        });
                    }
                }
                else {
                    var codeResponse = response;
                    if (!codeResponse.code || typeof codeResponse.code !== 'string') {
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MFA code is required', { field: 'code' });
                    }
                }
                break;
            }
            case 'FORCE_CHANGE_PASSWORD': {
                var response = data;
                if (!response.newPassword || typeof response.newPassword !== 'string') {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'New password is required', {
                        field: 'newPassword',
                    });
                }
                break;
            }
            case 'MFA_SETUP_REQUIRED': {
                var response = data;
                if (!response.method) {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MFA setup method is required', {
                        field: 'method',
                    });
                }
                if (!response.setupData || typeof response.setupData !== 'object') {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'MFA setup data is required', {
                        field: 'setupData',
                    });
                }
                break;
            }
        }
    };
    /**
     * Handle VERIFY_EMAIL challenge
     */
    AuthService.prototype.handleVerifyEmail = function (challengeSession, code) {
        return __awaiter(this, void 0, void 0, function () {
            var user, verifyDto, result, isVerified, updatedUser, clientInfo, authMethod, authProvider, isSocialLogin, response;
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
                        }
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Verifying email for user: ".concat(user.sub));
                        verifyDto = Object.assign(new verify_email_dto_1.VerifyEmailWithCodeDTO(), { email: user.email, code: code });
                        return [4 /*yield*/, this.emailVerificationService.verifyEmailWithCode(verifyDto)];
                    case 1:
                        result = _j.sent();
                        isVerified = result.message === 'Email verified successfully. Please log in to continue.';
                        if (!!isVerified) return [3 /*break*/, 3];
                        // Increment attempts but don't consume session
                        return [4 /*yield*/, this.challengeService.incrementAttempts(challengeSession)];
                    case 2:
                        // Increment attempts but don't consume session
                        _j.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code');
                    case 3: 
                    // Consume challenge session
                    return [4 /*yield*/, this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, auth_challenge_dto_1.AuthChallenge.VERIFY_EMAIL)];
                    case 4:
                        // Consume challenge session
                        _j.sent();
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: user.sub } })];
                    case 5:
                        updatedUser = _j.sent();
                        if (!updatedUser) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found after email verification');
                        }
                        clientInfo = this.clientInfoService.get();
                        authMethod = ((_c = challengeSession.metadata) === null || _c === void 0 ? void 0 : _c.authMethod) || 'password';
                        authProvider = (_d = challengeSession.metadata) === null || _d === void 0 ? void 0 : _d.authProvider;
                        isSocialLogin = authMethod === 'social';
                        return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                                user: updatedUser,
                                config: this.config,
                                deviceToken: clientInfo.deviceToken,
                                isSocialLogin: isSocialLogin,
                                skipMFAVerification: false,
                                authProvider: authProvider,
                            })];
                    case 6:
                        response = _j.sent();
                        if (response.challengeName) {
                            (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "Additional challenge required: ".concat(response.challengeName));
                        }
                        else {
                            (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.log) === null || _h === void 0 ? void 0 : _h.call(_g, "Email verified, auth completed for: ".concat(user.email));
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Handle VERIFY_PHONE challenge
     */
    AuthService.prototype.handleVerifyPhone = function (challengeSession, data) {
        return __awaiter(this, void 0, void 0, function () {
            var user, phone, phoneRegex, smsError, smsDto, error_3, errorMessage, authMethod, authProvider, challengeResponse, code, verifyDto, result, isVerified, updatedUser, clientInfo, authMethod, authProvider, isSocialLogin, response;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            return __generator(this, function (_y) {
                switch (_y.label) {
                    case 0:
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
                        }
                        if (!('phone' in data && data.phone)) return [3 /*break*/, 9];
                        phone = data.phone;
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Collecting phone number for user: ".concat(user.sub));
                        phoneRegex = /^\+[1-9]\d{1,14}$/;
                        if (!phoneRegex.test(phone)) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INVALID_PHONE_FORMAT, 'Invalid phone number format. Use E.164 format (e.g., +1234567890)');
                        }
                        // Update user phone number
                        return [4 /*yield*/, this.userRepository.update({ sub: user.sub }, { phone: phone })];
                    case 1:
                        // Update user phone number
                        _y.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "Phone number added for user ".concat(user.sub, ": ").concat(phone));
                        smsError = void 0;
                        if (!this.phoneVerificationService) return [3 /*break*/, 6];
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "Sending verification SMS to newly added phone: ".concat(phone));
                        _y.label = 2;
                    case 2:
                        _y.trys.push([2, 4, , 5]);
                        smsDto = Object.assign(new verify_phone_dto_1.SendVerificationSMSDTO(), { sub: user.sub });
                        return [4 /*yield*/, this.phoneVerificationService.sendVerificationSMS(smsDto)];
                    case 3:
                        _y.sent();
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.log) === null || _h === void 0 ? void 0 : _h.call(_g, "Verification SMS sent successfully to: ".concat(phone));
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _y.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.error) === null || _k === void 0 ? void 0 : _k.call(_j, "Failed to send verification SMS to ".concat(phone, ": ").concat(errorMessage));
                        smsError = errorMessage;
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.warn) === null || _m === void 0 ? void 0 : _m.call(_l, "Phone verification SMS not sent - PhoneVerificationService not available. " +
                            'Phone verification requires an SMS provider to be configured.');
                        _y.label = 7;
                    case 7:
                        authMethod = ((_o = challengeSession.metadata) === null || _o === void 0 ? void 0 : _o.authMethod) || 'password';
                        authProvider = (_p = challengeSession.metadata) === null || _p === void 0 ? void 0 : _p.authProvider;
                        return [4 /*yield*/, this.challengeHelper.createChallengeResponse(__assign(__assign({}, user), { phone: phone }), auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE, this.config, authMethod, authProvider)];
                    case 8:
                        challengeResponse = _y.sent();
                        // Include SMS error in challenge parameters if SMS failed
                        if (smsError) {
                            challengeResponse.challengeParameters = challengeResponse.challengeParameters || {};
                            challengeResponse.challengeParameters.smsError = smsError;
                        }
                        return [2 /*return*/, challengeResponse];
                    case 9:
                        code = data.code;
                        (_r = (_q = this.logger) === null || _q === void 0 ? void 0 : _q.log) === null || _r === void 0 ? void 0 : _r.call(_q, "Verifying phone for user: ".concat(user.sub));
                        // Check if phone is set
                        if (!user.phone) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Phone number not yet provided. Submit phone number first.');
                        }
                        verifyDto = Object.assign(new verify_phone_by_sub_dto_1.VerifyPhoneWithCodeBySubDTO(), { sub: user.sub, code: code });
                        return [4 /*yield*/, this.phoneVerificationService.verifyPhoneWithCodeBySub(verifyDto)];
                    case 10:
                        result = _y.sent();
                        isVerified = result.message === 'Phone verified successfully. Please log in to continue.';
                        if (!!isVerified) return [3 /*break*/, 12];
                        // Increment attempts but don't consume session
                        return [4 /*yield*/, this.challengeService.incrementAttempts(challengeSession)];
                    case 11:
                        // Increment attempts but don't consume session
                        _y.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code');
                    case 12: 
                    // Consume challenge session
                    return [4 /*yield*/, this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE)];
                    case 13:
                        // Consume challenge session
                        _y.sent();
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: user.sub } })];
                    case 14:
                        updatedUser = _y.sent();
                        if (!updatedUser) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found after phone verification');
                        }
                        clientInfo = this.clientInfoService.get();
                        authMethod = ((_s = challengeSession.metadata) === null || _s === void 0 ? void 0 : _s.authMethod) || 'password';
                        authProvider = (_t = challengeSession.metadata) === null || _t === void 0 ? void 0 : _t.authProvider;
                        isSocialLogin = authMethod === 'social';
                        return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                                user: updatedUser,
                                config: this.config,
                                deviceToken: clientInfo.deviceToken,
                                isSocialLogin: isSocialLogin,
                                skipMFAVerification: false,
                                authProvider: authProvider,
                            })];
                    case 15:
                        response = _y.sent();
                        if (response.challengeName) {
                            (_v = (_u = this.logger) === null || _u === void 0 ? void 0 : _u.log) === null || _v === void 0 ? void 0 : _v.call(_u, "Additional challenge required: ".concat(response.challengeName));
                        }
                        else {
                            (_x = (_w = this.logger) === null || _w === void 0 ? void 0 : _w.log) === null || _x === void 0 ? void 0 : _x.call(_w, "Phone verified, auth completed for: ".concat(user.email));
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Handle MFA_REQUIRED challenge
     */
    AuthService.prototype.handleMFAVerification = function (challengeSession, data) {
        return __awaiter(this, void 0, void 0, function () {
            var user, method, clientInfo, isValid, passkeyData, credential, expectedChallenge, wrappedCredential, verifyResult, codeData, code, verifyResult, auditError_6, errorMessage, auditError_7, errorMessage, authMethod, authProvider, isSocialLogin, response;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
            return __generator(this, function (_z) {
                switch (_z.label) {
                    case 0:
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
                        }
                        method = data.method;
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "MFA verification attempt: method=".concat(method, ", user=").concat(user.sub));
                        // Check if MFAService is available
                        if (!this.mfaService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
                        }
                        clientInfo = this.clientInfoService.get();
                        isValid = false;
                        if (!(method === 'passkey')) return [3 /*break*/, 2];
                        passkeyData = data;
                        credential = passkeyData.credential;
                        expectedChallenge = (_c = challengeSession.metadata) === null || _c === void 0 ? void 0 : _c.passkeyChallenge;
                        if (!expectedChallenge) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'No passkey challenge found in session');
                        }
                        wrappedCredential = { credential: credential, expectedChallenge: expectedChallenge };
                        return [4 /*yield*/, this.mfaService.verifyCode({
                                sub: user.sub,
                                methodName: mfa_method_enum_1.MFAMethod.PASSKEY,
                                code: wrappedCredential,
                            })];
                    case 1:
                        verifyResult = _z.sent();
                        isValid = verifyResult.valid;
                        return [3 /*break*/, 4];
                    case 2:
                        codeData = data;
                        code = codeData.code;
                        return [4 /*yield*/, this.mfaService.verifyCode({
                                sub: user.sub,
                                methodName: method,
                                code: code,
                            })];
                    case 3:
                        verifyResult = _z.sent();
                        isValid = verifyResult.valid;
                        _z.label = 4;
                    case 4:
                        if (!!isValid) return [3 /*break*/, 10];
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.warn) === null || _e === void 0 ? void 0 : _e.call(_d, "MFA verification failed for user: ".concat(user.sub));
                        if (!((_f = this.config.auditLogs) === null || _f === void 0 ? void 0 : _f.fireAndForget)) return [3 /*break*/, 5];
                        (_g = this.auditService) === null || _g === void 0 ? void 0 : _g.recordEvent({
                            userId: user.id,
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_VERIFICATION_FAILED,
                            eventStatus: 'FAILURE',
                            challengeSessionId: challengeSession.id,
                            authMethod: method,
                            metadata: { mfaMethod: method },
                        }).catch(function () { return undefined; });
                        return [3 /*break*/, 8];
                    case 5:
                        _z.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, ((_h = this.auditService) === null || _h === void 0 ? void 0 : _h.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_VERIFICATION_FAILED,
                                eventStatus: 'FAILURE',
                                challengeSessionId: challengeSession.id,
                                authMethod: method,
                                metadata: { mfaMethod: method },
                            }))];
                    case 6:
                        _z.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        auditError_6 = _z.sent();
                        errorMessage = auditError_6 instanceof Error ? auditError_6.message : 'Unknown error';
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.error) === null || _k === void 0 ? void 0 : _k.call(_j, "Failed to record MFA_VERIFICATION_FAILED audit event: ".concat(errorMessage), {
                            error: auditError_6,
                            userId: user.id,
                        });
                        return [3 /*break*/, 8];
                    case 8: 
                    // Increment challenge attempts (session not consumed, so user can retry)
                    return [4 /*yield*/, this.challengeService.incrementAttempts(challengeSession)];
                    case 9:
                        // Increment challenge attempts (session not consumed, so user can retry)
                        _z.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid MFA code');
                    case 10:
                        (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.log) === null || _m === void 0 ? void 0 : _m.call(_l, "MFA verified successfully for user: ".concat(user.sub));
                        if (!((_o = this.config.auditLogs) === null || _o === void 0 ? void 0 : _o.fireAndForget)) return [3 /*break*/, 11];
                        (_p = this.auditService) === null || _p === void 0 ? void 0 : _p.recordEvent({
                            userId: user.id,
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
                            eventStatus: 'SUCCESS',
                            challengeSessionId: challengeSession.id,
                            authMethod: method,
                            metadata: { mfaMethod: method },
                        }).catch(function () { return undefined; });
                        return [3 /*break*/, 14];
                    case 11:
                        _z.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, ((_q = this.auditService) === null || _q === void 0 ? void 0 : _q.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.MFA_VERIFICATION_SUCCESS,
                                eventStatus: 'SUCCESS',
                                challengeSessionId: challengeSession.id,
                                authMethod: method,
                                metadata: { mfaMethod: method },
                            }))];
                    case 12:
                        _z.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        auditError_7 = _z.sent();
                        errorMessage = auditError_7 instanceof Error ? auditError_7.message : 'Unknown error';
                        (_s = (_r = this.logger) === null || _r === void 0 ? void 0 : _r.error) === null || _s === void 0 ? void 0 : _s.call(_r, "Failed to record MFA_VERIFICATION_SUCCESS audit event: ".concat(errorMessage), {
                            error: auditError_7,
                            userId: user.id,
                        });
                        return [3 /*break*/, 14];
                    case 14: 
                    // Store MFA method in challenge session metadata for CHALLENGE_COMPLETED audit event
                    return [4 /*yield*/, this.challengeService.updateMetadata(challengeSession.sessionToken, {
                            mfaMethod: method,
                        })];
                    case 15:
                        // Store MFA method in challenge session metadata for CHALLENGE_COMPLETED audit event
                        _z.sent();
                        // Only consume the session AFTER successful verification
                        return [4 /*yield*/, this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED)];
                    case 16:
                        // Only consume the session AFTER successful verification
                        _z.sent();
                        authMethod = ((_t = challengeSession.metadata) === null || _t === void 0 ? void 0 : _t.authMethod) || 'password';
                        authProvider = (_u = challengeSession.metadata) === null || _u === void 0 ? void 0 : _u.authProvider;
                        isSocialLogin = authMethod === 'social';
                        return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                                user: user,
                                config: this.config,
                                deviceToken: clientInfo.deviceToken,
                                isSocialLogin: isSocialLogin,
                                skipMFAVerification: true, // Already verified
                                authProvider: authProvider,
                            })];
                    case 17:
                        response = _z.sent();
                        if (response.challengeName) {
                            (_w = (_v = this.logger) === null || _v === void 0 ? void 0 : _v.log) === null || _w === void 0 ? void 0 : _w.call(_v, "Additional challenge required: ".concat(response.challengeName));
                        }
                        else {
                            (_y = (_x = this.logger) === null || _x === void 0 ? void 0 : _x.log) === null || _y === void 0 ? void 0 : _y.call(_x, "MFA verified, auth completed for: ".concat(user.email));
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Handle FORCE_CHANGE_PASSWORD challenge
     */
    AuthService.prototype.handleForceChangePassword = function (challengeSession, newPassword) {
        return __awaiter(this, void 0, void 0, function () {
            var user, validation, newHash, updatedUser, clientInfo, authMethod, authProvider, isSocialLogin, response;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
                        }
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Changing password for user: ".concat(user.sub));
                        return [4 /*yield*/, this.passwordService.validatePassword(newPassword, {
                                email: user.email,
                                username: user.username || undefined,
                            })];
                    case 1:
                        validation = _l.sent();
                        if (!validation.valid) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.WEAK_PASSWORD, validation.errors.join(', '), {
                                errors: validation.errors,
                            });
                        }
                        return [4 /*yield*/, this.passwordService.hashPassword(newPassword)];
                    case 2:
                        newHash = _l.sent();
                        // Update user password and clear mustChangePassword flag
                        return [4 /*yield*/, this.userRepository.update({ sub: user.sub }, {
                                passwordHash: newHash,
                                passwordChangedAt: new Date(),
                                mustChangePassword: false,
                            })];
                    case 3:
                        // Update user password and clear mustChangePassword flag
                        _l.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "Password changed successfully for user: ".concat(user.sub));
                        // Consume challenge session
                        return [4 /*yield*/, this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, auth_challenge_dto_1.AuthChallenge.FORCE_CHANGE_PASSWORD)];
                    case 4:
                        // Consume challenge session
                        _l.sent();
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: user.sub } })];
                    case 5:
                        updatedUser = _l.sent();
                        if (!updatedUser) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found after password update');
                        }
                        clientInfo = this.clientInfoService.get();
                        authMethod = ((_e = challengeSession.metadata) === null || _e === void 0 ? void 0 : _e.authMethod) || 'password';
                        authProvider = (_f = challengeSession.metadata) === null || _f === void 0 ? void 0 : _f.authProvider;
                        isSocialLogin = authMethod === 'social';
                        return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                                user: updatedUser,
                                config: this.config,
                                deviceToken: clientInfo.deviceToken,
                                isSocialLogin: isSocialLogin,
                                skipMFAVerification: false,
                                authProvider: authProvider,
                            })];
                    case 6:
                        response = _l.sent();
                        if (response.challengeName) {
                            (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.log) === null || _h === void 0 ? void 0 : _h.call(_g, "Additional challenge required: ".concat(response.challengeName));
                        }
                        else {
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.log) === null || _k === void 0 ? void 0 : _k.call(_j, "Password changed, auth completed for: ".concat(user.email));
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Handle MFA_SETUP_REQUIRED challenge
     */
    AuthService.prototype.handleMFASetup = function (challengeSession, data) {
        return __awaiter(this, void 0, void 0, function () {
            var user, method, setupData, provider, deviceId, error_4, updatedUser, clientInfo, response;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'User not found in challenge session');
                        }
                        method = data.method;
                        setupData = data.setupData;
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "MFA setup attempt: method=".concat(method, ", user=").concat(user.sub));
                        // Check if MFAService is available
                        if (!this.mfaService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
                        }
                        provider = this.mfaService.getProvider(method);
                        _l.label = 1;
                    case 1:
                        _l.trys.push([1, 3, , 5]);
                        return [4 /*yield*/, provider.verifySetup(user, setupData)];
                    case 2:
                        deviceId = _l.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "MFA device setup completed: method=".concat(method, ", deviceId=").concat(deviceId));
                        return [3 /*break*/, 5];
                    case 3:
                        error_4 = _l.sent();
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.warn) === null || _f === void 0 ? void 0 : _f.call(_e, "MFA setup verification failed: method=".concat(method, ", user=").concat(user.sub));
                        // Increment attempts but don't consume session
                        return [4 /*yield*/, this.challengeService.incrementAttempts(challengeSession)];
                    case 4:
                        // Increment attempts but don't consume session
                        _l.sent();
                        // Re-throw the error
                        throw error_4;
                    case 5: 
                    // Consume challenge session
                    return [4 /*yield*/, this.challengeService.validateAndConsumeSession(challengeSession.sessionToken, auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED)];
                    case 6:
                        // Consume challenge session
                        _l.sent();
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: user.sub } })];
                    case 7:
                        updatedUser = _l.sent();
                        if (!updatedUser) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found after MFA setup');
                        }
                        clientInfo = this.clientInfoService.get();
                        return [4 /*yield*/, this.challengeHelper.determineAuthResponse({
                                user: updatedUser,
                                config: this.config,
                                deviceToken: clientInfo.deviceToken,
                                isSocialLogin: false,
                                skipMFAVerification: true, // Device already verified during setup
                            })];
                    case 8:
                        response = _l.sent();
                        if (response.challengeName) {
                            (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.log) === null || _h === void 0 ? void 0 : _h.call(_g, "Additional challenge required: ".concat(response.challengeName));
                        }
                        else {
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.log) === null || _k === void 0 ? void 0 : _k.call(_j, "MFA setup completed, auth completed for: ".concat(user.email));
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    // ============================================================================
    // Challenge Helper Methods
    // ============================================================================
    /**
     * Resend verification code for current challenge
     *
     * Determines the challenge type from the session and resends the appropriate code:
     * - VERIFY_EMAIL: Resends email verification code
     * - VERIFY_PHONE: Resends SMS verification code
     * - MFA_REQUIRED: Resends MFA code (for SMS MFA)
     *
     * Rate limits are enforced internally by the verification services.
     *
     * @param session - Challenge session token
     * @returns Destination info (masked email/phone)
     * @throws {NAuthException} INVALID_CHALLENGE_SESSION | RATE_LIMIT_* | VALIDATION_FAILED
     *
     * @example
     * ```typescript
     * const result = await authService.resendCode(session);
     * // Returns: { destination: 'u***r@example.com' }
     * ```
     */
    AuthService.prototype.resendCode = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var challengeSession, user, _a, resendDto, maskedEmail, resendDto, maskedPhone, metadata, method, provider, result;
            var _b, _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug) === null || _c === void 0 ? void 0 : _c.call(_b, "Resending verification code: session=".concat(dto.session));
                        return [4 /*yield*/, this.challengeService.validateSession(dto.session)];
                    case 1:
                        challengeSession = _k.sent();
                        user = challengeSession.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Challenge session has no associated user');
                        }
                        _a = challengeSession.challengeName;
                        switch (_a) {
                            case auth_challenge_dto_1.AuthChallenge.VERIFY_EMAIL: return [3 /*break*/, 2];
                            case auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE: return [3 /*break*/, 4];
                            case auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED: return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 9];
                    case 2:
                        resendDto = Object.assign(new verify_email_dto_1.ResendVerificationEmailDTO(), { sub: user.sub });
                        return [4 /*yield*/, this.emailVerificationService.resendVerificationEmail(resendDto)];
                    case 3:
                        _k.sent();
                        maskedEmail = this.maskEmail(user.email);
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.debug) === null || _e === void 0 ? void 0 : _e.call(_d, "Email verification code resent: user=".concat(user.sub, ", email=").concat(maskedEmail));
                        return [2 /*return*/, { destination: maskedEmail }];
                    case 4:
                        // Check if phone already collected
                        if (!user.phone) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Phone number not yet provided. Submit phone number first.');
                        }
                        if (!this.phoneVerificationService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Phone verification service is not available');
                        }
                        resendDto = Object.assign(new verify_phone_dto_1.ResendVerificationSMSDTO(), { sub: user.sub });
                        return [4 /*yield*/, this.phoneVerificationService.resendVerificationSMS(resendDto)];
                    case 5:
                        _k.sent();
                        maskedPhone = this.maskPhone(user.phone);
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "Phone verification code resent: user=".concat(user.sub, ", phone=").concat(maskedPhone));
                        return [2 /*return*/, { destination: maskedPhone }];
                    case 6:
                        metadata = challengeSession.metadata;
                        method = metadata === null || metadata === void 0 ? void 0 : metadata.method;
                        if (!method) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Cannot resend MFA code: method not specified in session');
                        }
                        if (!(method === 'sms' || method === 'email')) return [3 /*break*/, 8];
                        if (!this.mfaService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'MFA service is not available');
                        }
                        provider = this.mfaService.getProvider(method);
                        if (!provider.sendChallenge) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "".concat(method.toUpperCase(), " MFA provider does not support sending challenges"));
                        }
                        return [4 /*yield*/, provider.sendChallenge(user)];
                    case 7:
                        result = _k.sent();
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.debug) === null || _j === void 0 ? void 0 : _j.call(_h, "".concat(method.toUpperCase(), " MFA code resent: user=").concat(user.sub));
                        // Provider returns masked phone or email
                        return [2 /*return*/, { destination: result }];
                    case 8: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Cannot resend code for MFA method '".concat(method, "'. Only SMS and Email support code resending."));
                    case 9: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Cannot resend code for challenge type '".concat(challengeSession.challengeName, "'"));
                }
            });
        });
    };
    /**
     * Mask email for display (helper method)
     */
    AuthService.prototype.maskEmail = function (email) {
        var _a = email.split('@'), localPart = _a[0], domain = _a[1];
        if (localPart.length <= 2) {
            return "".concat(localPart[0], "***@").concat(domain);
        }
        return "".concat(localPart[0], "***").concat(localPart[localPart.length - 1], "@").concat(domain);
    };
    /**
     * Mask phone number for display (helper method)
     */
    AuthService.prototype.maskPhone = function (phone) {
        var digits = phone.replace(/\D/g, '');
        var lastFour = digits.slice(-4);
        return "***-***-".concat(lastFour);
    };
    /**
     * Registers the current device as trusted for the user (opt-in).
     *
     * Only available when rememberDevices is set to 'user_opt_in'. Generates and returns a trusted device token for the device associated with the current authenticated session.
     *
     * Session ID is automatically extracted from the JWT token context (via ClientInfoService), similar to how IP address and user agent are handled.
     *
     * @returns Object containing the new device token
     * @throws {NAuthException} If the feature is unavailable, service is not enabled, or session ID is not available
     *
     * @example
     * ```typescript
     * const result = await authService.trustDevice();
     * // { deviceToken: 'abc123' }
     * ```
     */
    AuthService.prototype.trustDevice = function () {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, sessionId, session, user, userId, isAlreadyTrusted, _a, deviceToken, userId_1, auditError_8, errorMessage;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        if (((_b = this.config.mfa) === null || _b === void 0 ? void 0 : _b.rememberDevices) !== 'user_opt_in') {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.FORBIDDEN, 'Trust device feature is only available in user_opt_in mode');
                        }
                        if (!this.trustedDeviceService) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'Trusted device service not available');
                        }
                        clientInfo = this.clientInfoService.get();
                        sessionId = clientInfo.sessionId;
                        if (!sessionId) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SESSION_NOT_FOUND, 'Session ID not found in request context. Ensure the request is authenticated.');
                        }
                        return [4 /*yield*/, this.sessionService.findById(sessionId)];
                    case 1:
                        session = _p.sent();
                        if (!session || session.isRevoked) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
                        }
                        return [4 /*yield*/, this.userRepository.findOne({ where: { id: session.userId } })];
                    case 2:
                        user = _p.sent();
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
                        if (!clientInfo.deviceToken) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.trustedDeviceService.isDeviceTrusted(clientInfo.deviceToken, userId)];
                    case 3:
                        isAlreadyTrusted = _p.sent();
                        if (isAlreadyTrusted) {
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "Device already trusted for user ".concat(user.sub));
                            return [2 /*return*/, { deviceToken: clientInfo.deviceToken }];
                        }
                        _p.label = 4;
                    case 4:
                        _p.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.trustedDeviceService.revokeTrustedDevice(clientInfo.deviceToken, userId)];
                    case 5:
                        _p.sent();
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.debug) === null || _f === void 0 ? void 0 : _f.call(_e, "Revoked existing untrusted device token for user ".concat(user.sub));
                        return [3 /*break*/, 7];
                    case 6:
                        _a = _p.sent();
                        return [3 /*break*/, 7];
                    case 7: return [4 /*yield*/, this.trustedDeviceService.createTrustedDevice(userId, session.deviceName || clientInfo.deviceName, session.deviceType || clientInfo.deviceType, session.ipAddress || clientInfo.ipAddress, session.userAgent || clientInfo.userAgent, clientInfo.platform, clientInfo.browser)];
                    case 8:
                        deviceToken = _p.sent();
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.log) === null || _h === void 0 ? void 0 : _h.call(_g, "Device trusted for user ".concat(user.sub, " (user opt-in)"));
                        _p.label = 9;
                    case 9:
                        _p.trys.push([9, 11, , 12]);
                        userId_1 = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
                        return [4 /*yield*/, ((_j = this.auditService) === null || _j === void 0 ? void 0 : _j.recordEvent({
                                userId: userId_1,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.DEVICE_TRUSTED,
                                eventStatus: 'SUCCESS',
                                // Override deviceId with the newly created device token
                                deviceId: deviceToken,
                                sessionId: session.id,
                                description: "Device trusted by user (opt-in) - ".concat(session.deviceName || 'Unknown device'),
                                // Client info (deviceName, deviceType, etc.) automatically included from context
                                metadata: {
                                    rememberDeviceDays: ((_k = this.config.mfa) === null || _k === void 0 ? void 0 : _k.rememberDeviceDays) || 30,
                                    trustedUntil: new Date(Date.now() + (((_l = this.config.mfa) === null || _l === void 0 ? void 0 : _l.rememberDeviceDays) || 30) * 24 * 60 * 60 * 1000).toISOString(),
                                },
                            }))];
                    case 10:
                        _p.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        auditError_8 = _p.sent();
                        errorMessage = auditError_8 instanceof Error ? auditError_8.message : 'Unknown error';
                        (_o = (_m = this.logger) === null || _m === void 0 ? void 0 : _m.error) === null || _o === void 0 ? void 0 : _o.call(_m, "Failed to record DEVICE_TRUSTED audit event: ".concat(errorMessage), {
                            error: auditError_8,
                            userId: user.id,
                        });
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/, { deviceToken: deviceToken }];
                }
            });
        });
    };
    /**
     * Refresh the access token using a refresh token.
     *
     * Handles secure token rotation with distributed locking, reuse detection,
     * and family revocation to prevent race conditions and replay attacks.
     *
     * @param refreshToken - The refresh token issued to the client
     * @returns Newly generated access and refresh tokens
     * @throws {NAuthException} If the session is not found, revoked, or refresh is abused
     *
     * @example
     * ```typescript
     * const tokens = await authService.refreshToken(refreshToken);
     * ```
     */
    AuthService.prototype.refreshToken = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenHash, session, validation, userId, lockKey, lockAcquired, lockStartTime, lockDuration, isAlreadyUsed, tokenPayload, tokenSessionId, currentSession, user, newTokens_1, accessTokenValidation_1, refreshTokenValidation_1, userForAudit, auditError_9, errorMessage, validation, payload, lockedSession, refreshTokenTTL, marked, userForAudit, auditError_10, newTokens, accessTokenValidation, refreshTokenValidation;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
            return __generator(this, function (_9) {
                switch (_9.label) {
                    case 0:
                        tokenHash = this.jwtService.hashToken(dto.refreshToken);
                        return [4 /*yield*/, this.sessionService.findByRefreshToken(tokenHash)];
                    case 1:
                        session = _9.sent();
                        if (!(!session || session.isRevoked)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.jwtService.validateRefreshToken(dto.refreshToken)];
                    case 2:
                        validation = _9.sent();
                        userId = ((_a = validation.payload) === null || _a === void 0 ? void 0 : _a.sub) || 'unknown';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug) === null || _c === void 0 ? void 0 : _c.call(_b, "Session not found or revoked for user ".concat(userId, ". Possible issue where token are not cleared on logout"));
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
                    case 3:
                        lockKey = "session-refresh:".concat(session.id);
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.debug) === null || _e === void 0 ? void 0 : _e.call(_d, "[REFRESH DEBUG] Attempting to acquire lock ".concat(lockKey, " for token hash ").concat(tokenHash.substring(0, 16), "..."));
                        lockAcquired = false;
                        _9.label = 4;
                    case 4:
                        _9.trys.push([4, , 37, 40]);
                        lockStartTime = Date.now();
                        return [4 /*yield*/, this.sessionService.acquireRefreshLock(lockKey, 10000)];
                    case 5:
                        lockAcquired = _9.sent();
                        lockDuration = Date.now() - lockStartTime;
                        if (!lockAcquired) {
                            (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.warn) === null || _g === void 0 ? void 0 : _g.call(_f, "[REFRESH DEBUG] Lock ".concat(lockKey, " NOT acquired - refresh already in progress for session ").concat(session.id));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_LOGIN, 'Token refresh already in progress', {
                                retryAfter: 5,
                            });
                        }
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.debug) === null || _j === void 0 ? void 0 : _j.call(_h, "[REFRESH DEBUG] Lock ".concat(lockKey, " acquired successfully in ").concat(lockDuration, "ms for token hash ").concat(tokenHash.substring(0, 16), "..."));
                        if (!this.config.jwt.refreshToken.reuseDetection) return [3 /*break*/, 21];
                        return [4 /*yield*/, this.sessionService.isRefreshTokenUsed(tokenHash)];
                    case 6:
                        isAlreadyUsed = _9.sent();
                        if (!isAlreadyUsed) return [3 /*break*/, 21];
                        tokenPayload = this.jwtService.decodeToken(dto.refreshToken);
                        tokenSessionId = tokenPayload === null || tokenPayload === void 0 ? void 0 : tokenPayload.sessionId;
                        return [4 /*yield*/, this.sessionService.findByIdLight(session.id)];
                    case 7:
                        currentSession = (_9.sent());
                        if (!currentSession || currentSession.isRevoked) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
                        }
                        if (!(tokenSessionId && tokenSessionId === session.id.toString())) return [3 /*break*/, 13];
                        // Same session - this is a cookie race condition
                        // Return the current valid tokens (user already has them from first request)
                        (_l = (_k = this.logger) === null || _k === void 0 ? void 0 : _k.debug) === null || _l === void 0 ? void 0 : _l.call(_k, "[REFRESH DEBUG] Token hash ".concat(tokenHash.substring(0, 16), "... already used for same session ").concat(session.id, " - cookie race detected, returning current tokens"));
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { id: currentSession.userId },
                            })];
                    case 8:
                        user = (_9.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.jwtService.generateTokenPair({
                                userId: user.sub,
                                email: user.email,
                                sessionId: currentSession.id.toString(),
                                tokenFamily: currentSession.tokenFamily,
                            })];
                    case 9:
                        newTokens_1 = _9.sent();
                        // Update session with these tokens (they're already there, but ensures consistency)
                        return [4 /*yield*/, this.sessionService.updateTokens(currentSession.id, this.jwtService.hashToken(newTokens_1.accessToken), this.jwtService.hashToken(newTokens_1.refreshToken))];
                    case 10:
                        // Update session with these tokens (they're already there, but ensures consistency)
                        _9.sent();
                        return [4 /*yield*/, this.jwtService.validateAccessToken(newTokens_1.accessToken)];
                    case 11:
                        accessTokenValidation_1 = _9.sent();
                        return [4 /*yield*/, this.jwtService.validateRefreshToken(newTokens_1.refreshToken)];
                    case 12:
                        refreshTokenValidation_1 = _9.sent();
                        // Return success with current tokens
                        return [2 /*return*/, {
                                accessToken: newTokens_1.accessToken,
                                refreshToken: newTokens_1.refreshToken,
                                accessTokenExpiresAt: ((_m = accessTokenValidation_1.payload) === null || _m === void 0 ? void 0 : _m.exp) || 0,
                                refreshTokenExpiresAt: ((_o = refreshTokenValidation_1.payload) === null || _o === void 0 ? void 0 : _o.exp) || 0,
                            }];
                    case 13:
                        // Different session - this is an attack!
                        // A refresh token from one session cannot be used by another session
                        (_q = (_p = this.logger) === null || _p === void 0 ? void 0 : _p.error) === null || _q === void 0 ? void 0 : _q.call(_p, "[REFRESH DEBUG] Token hash ".concat(tokenHash.substring(0, 16), "... already used for different session - ATTACK DETECTED! Token sessionId: ").concat(tokenSessionId, ", Found session: ").concat(session.id, ". Revoking session ").concat(session.id));
                        // Revoke the session that's trying to use a stolen token
                        return [4 /*yield*/, this.sessionService.revokeSession(session.id, 'Token reuse detected - possible token theft')];
                    case 14:
                        // Revoke the session that's trying to use a stolen token
                        _9.sent();
                        userForAudit = null;
                        _9.label = 15;
                    case 15:
                        _9.trys.push([15, 19, , 20]);
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { id: session.userId },
                            })];
                    case 16:
                        userForAudit = (_9.sent());
                        if (!userForAudit) return [3 /*break*/, 18];
                        return [4 /*yield*/, ((_r = this.auditService) === null || _r === void 0 ? void 0 : _r.recordEvent({
                                userId: userForAudit.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SUSPICIOUS_ACTIVITY,
                                eventStatus: 'SUSPICIOUS',
                                riskFactor: 90,
                                riskFactors: [risk_factor_enum_1.RiskFactor.TOKEN_THEFT_ATTEMPT, risk_factor_enum_1.RiskFactor.REFRESH_TOKEN_REUSE_DIFFERENT_SESSION],
                                reason: 'Refresh token reuse from different session',
                                // Client info automatically included from context
                                description: 'Refresh token from another session attempted to be used. Session revoked as security measure.',
                                metadata: {
                                    sessionId: session.id,
                                    tokenSessionId: tokenSessionId,
                                    tokenHash: "".concat(tokenHash.substring(0, 16), "..."),
                                    detectedAt: new Date().toISOString(),
                                    action: 'session_revoked',
                                },
                            }))];
                    case 17:
                        _9.sent();
                        _9.label = 18;
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        auditError_9 = _9.sent();
                        errorMessage = auditError_9 instanceof Error ? auditError_9.message : 'Unknown error';
                        (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.error) === null || _t === void 0 ? void 0 : _t.call(_s, "Failed to record SUSPICIOUS_ACTIVITY audit event (token reuse): ".concat(errorMessage), {
                            error: auditError_9,
                            userId: (userForAudit === null || userForAudit === void 0 ? void 0 : userForAudit.id) || session.userId,
                        });
                        return [3 /*break*/, 20];
                    case 20: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.TOKEN_INVALID, 'Refresh token has already been used');
                    case 21: return [4 /*yield*/, this.jwtService.validateRefreshToken(dto.refreshToken)];
                    case 22:
                        validation = _9.sent();
                        if (!validation.valid || !validation.payload) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.TOKEN_INVALID, 'Invalid refresh token');
                        }
                        payload = validation.payload;
                        return [4 /*yield*/, this.sessionService.findByIdLight(session.id)];
                    case 23:
                        lockedSession = (_9.sent());
                        if (!lockedSession || lockedSession.isRevoked || lockedSession.id !== session.id) {
                            (_v = (_u = this.logger) === null || _u === void 0 ? void 0 : _u.debug) === null || _v === void 0 ? void 0 : _v.call(_u, "Session changed after lock acquisition for user ".concat(payload.sub, ". Session may have been revoked."));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SESSION_NOT_FOUND, 'Session not found or revoked');
                        }
                        if (!this.config.jwt.refreshToken.reuseDetection) return [3 /*break*/, 32];
                        refreshTokenTTL = this.jwtService.getRefreshTokenTTL();
                        return [4 /*yield*/, this.sessionService.markRefreshTokenAsUsed(tokenHash, refreshTokenTTL)];
                    case 24:
                        marked = _9.sent();
                        if (!!marked) return [3 /*break*/, 31];
                        // Token was already marked as used - reuse detected!
                        (_x = (_w = this.logger) === null || _w === void 0 ? void 0 : _w.error) === null || _x === void 0 ? void 0 : _x.call(_w, "Token reuse detected for user ".concat(payload.sub, " - atomic mark failed, revoking entire token family ").concat(payload.tokenFamily));
                        _9.label = 25;
                    case 25:
                        _9.trys.push([25, 29, , 30]);
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { sub: payload.sub },
                            })];
                    case 26:
                        userForAudit = (_9.sent());
                        if (!userForAudit) return [3 /*break*/, 28];
                        return [4 /*yield*/, ((_y = this.auditService) === null || _y === void 0 ? void 0 : _y.recordEvent({
                                userId: userForAudit.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SUSPICIOUS_ACTIVITY,
                                eventStatus: 'SUSPICIOUS',
                                riskFactor: 75,
                                riskFactors: [risk_factor_enum_1.RiskFactor.TOKEN_REUSE_ATTEMPT],
                                reason: 'Token reuse attempt blocked',
                                // Client info automatically included from context
                                description: 'Refresh token reuse attempt detected via atomic operation. Legitimate user session preserved.',
                                metadata: {
                                    tokenFamily: payload.tokenFamily,
                                    detectedAt: new Date().toISOString(),
                                    action: 'reuse_blocked_atomic',
                                },
                            }))];
                    case 27:
                        _9.sent();
                        _9.label = 28;
                    case 28: return [3 /*break*/, 30];
                    case 29:
                        auditError_10 = _9.sent();
                        (_0 = (_z = this.logger) === null || _z === void 0 ? void 0 : _z.warn) === null || _0 === void 0 ? void 0 : _0.call(_z, 'Failed to record SUSPICIOUS_ACTIVITY audit event', { error: auditError_10 });
                        return [3 /*break*/, 30];
                    case 30: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.TOKEN_INVALID, 'Refresh token has already been used');
                    case 31:
                        (_2 = (_1 = this.logger) === null || _1 === void 0 ? void 0 : _1.debug) === null || _2 === void 0 ? void 0 : _2.call(_1, "Marked refresh token as used for session ".concat(lockedSession.id));
                        _9.label = 32;
                    case 32: return [4 /*yield*/, this.jwtService.generateTokenPair({
                            userId: payload.sub,
                            email: payload.email,
                            sessionId: lockedSession.id.toString(), // Convert integer to string for JWT
                            tokenFamily: payload.tokenFamily,
                        })];
                    case 33:
                        newTokens = _9.sent();
                        // Update session with new token hashes (token rotation)
                        // This automatically invalidates the old tokens as they won't match the session
                        return [4 /*yield*/, this.sessionService.updateTokens(lockedSession.id, this.jwtService.hashToken(newTokens.accessToken), this.jwtService.hashToken(newTokens.refreshToken))];
                    case 34:
                        // Update session with new token hashes (token rotation)
                        // This automatically invalidates the old tokens as they won't match the session
                        _9.sent();
                        (_4 = (_3 = this.logger) === null || _3 === void 0 ? void 0 : _3.log) === null || _4 === void 0 ? void 0 : _4.call(_3, "Token refreshed successfully for user ".concat(payload.sub));
                        return [4 /*yield*/, this.jwtService.validateAccessToken(newTokens.accessToken)];
                    case 35:
                        accessTokenValidation = _9.sent();
                        return [4 /*yield*/, this.jwtService.validateRefreshToken(newTokens.refreshToken)];
                    case 36:
                        refreshTokenValidation = _9.sent();
                        return [2 /*return*/, {
                                accessToken: newTokens.accessToken,
                                refreshToken: newTokens.refreshToken,
                                accessTokenExpiresAt: ((_5 = accessTokenValidation.payload) === null || _5 === void 0 ? void 0 : _5.exp) || 0,
                                refreshTokenExpiresAt: ((_6 = refreshTokenValidation.payload) === null || _6 === void 0 ? void 0 : _6.exp) || 0,
                            }];
                    case 37:
                        if (!lockAcquired) return [3 /*break*/, 39];
                        return [4 /*yield*/, this.sessionService.releaseRefreshLock(lockKey)];
                    case 38:
                        _9.sent();
                        (_8 = (_7 = this.logger) === null || _7 === void 0 ? void 0 : _7.debug) === null || _8 === void 0 ? void 0 : _8.call(_7, "[REFRESH DEBUG] Released lock ".concat(lockKey));
                        _9.label = 39;
                    case 39: return [7 /*endfinally*/];
                    case 40: return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================================
    // Logout
    // ============================================================================
    /**
     * Logout user (revoke session)
     *
     * Session ID is automatically extracted from the JWT token context (via ClientInfoService), similar to how IP address and user agent are handled.
     *
     * @param dto - Logout options (forgetMe flag)
     * @returns Success status
     * @throws {NAuthException} If session ID is not available in request context
     */
    AuthService.prototype.logout = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, sessionId, jwtPayload, sessionIdStr, sessionIdNumber, clientInfoInContext, auditMetadata, session, user, userId, auditError_11, errorMessage, error_5, errorMessage, response;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        sessionId = clientInfo.sessionId;
                        // Fallback: Try to get sessionId from JWT payload in context
                        if (!sessionId) {
                            jwtPayload = context_storage_1.ContextStorage.get('JWT_PAYLOAD');
                            if (jwtPayload === null || jwtPayload === void 0 ? void 0 : jwtPayload.sessionId) {
                                sessionIdStr = String(jwtPayload.sessionId);
                                sessionIdNumber = parseInt(sessionIdStr, 10);
                                if (!isNaN(sessionIdNumber) && sessionIdNumber > 0) {
                                    sessionId = sessionIdNumber;
                                    clientInfoInContext = context_storage_1.ContextStorage.get('CLIENT_INFO');
                                    if (clientInfoInContext) {
                                        clientInfoInContext.sessionId = sessionIdNumber;
                                        context_storage_1.ContextStorage.set('CLIENT_INFO', clientInfoInContext);
                                    }
                                }
                            }
                        }
                        if (!sessionId) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SESSION_NOT_FOUND, 'Session ID not found in request context. Ensure the request is authenticated.');
                        }
                        auditMetadata = dto.forgetMe
                            ? {
                                deviceForgotten: true,
                                reason: 'User requested device to be forgotten on logout',
                            }
                            : undefined;
                        return [4 /*yield*/, this.sessionService.revokeSession(sessionId, 'User logout', auditMetadata)];
                    case 1:
                        _p.sent();
                        if (!(dto.forgetMe &&
                            ((_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.rememberDevices) &&
                            ((_b = this.config.mfa) === null || _b === void 0 ? void 0 : _b.rememberDevices) !== 'never' &&
                            this.trustedDeviceService)) return [3 /*break*/, 11];
                        if (!clientInfo.deviceToken) return [3 /*break*/, 11];
                        _p.label = 2;
                    case 2:
                        _p.trys.push([2, 10, , 11]);
                        return [4 /*yield*/, this.sessionService.findById(sessionId)];
                    case 3:
                        session = _p.sent();
                        if (!session) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.trustedDeviceService.revokeTrustedDevice(clientInfo.deviceToken, session.userId)];
                    case 4:
                        _p.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "Revoked trusted device token for user (forgetMe=true)");
                        return [4 /*yield*/, this.userRepository.findOne({ where: { id: session.userId } })];
                    case 5:
                        user = _p.sent();
                        if (!user) return [3 /*break*/, 9];
                        _p.label = 6;
                    case 6:
                        _p.trys.push([6, 8, , 9]);
                        userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
                        return [4 /*yield*/, ((_e = this.auditService) === null || _e === void 0 ? void 0 : _e.recordEvent({
                                userId: userId,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.DEVICE_UNTRUSTED,
                                eventStatus: 'SUCCESS',
                                sessionId: session.id,
                                description: "Device untrusted by user (forgetMe=true) - ".concat(session.deviceName || 'Unknown device'),
                                // Client info (deviceId, deviceName, deviceType, etc.) automatically included from context
                                metadata: {
                                    reason: 'user_logout_forget_me',
                                },
                            }))];
                    case 7:
                        _p.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        auditError_11 = _p.sent();
                        errorMessage = auditError_11 instanceof Error ? auditError_11.message : 'Unknown error';
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.error) === null || _g === void 0 ? void 0 : _g.call(_f, "Failed to record DEVICE_UNTRUSTED audit event: ".concat(errorMessage), {
                            error: auditError_11,
                            userId: session.userId,
                        });
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_5 = _p.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : 'Unknown error';
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.debug) === null || _j === void 0 ? void 0 : _j.call(_h, "Failed to revoke trusted device token on logout: ".concat(errorMessage), { error: error_5 });
                        return [3 /*break*/, 11];
                    case 11:
                        response = this.clientInfoService.getResponse();
                        if (response && ((_k = this.config.tokenDelivery) === null || _k === void 0 ? void 0 : _k.method) !== 'json') {
                            this.clearAuthCookies(response, (_l = dto.forgetMe) !== null && _l !== void 0 ? _l : false);
                            (_o = (_m = this.logger) === null || _m === void 0 ? void 0 : _m.debug) === null || _o === void 0 ? void 0 : _o.call(_m, 'Auth cookies cleared automatically on logout');
                        }
                        return [2 /*return*/, { success: true }];
                }
            });
        });
    };
    /**
     * Clear authentication cookies from response
     *
     * @param response - HTTP response object with clearCookie method
     * @param forgetDevice - Whether to also clear device token cookie
     * @private
     */
    AuthService.prototype.clearAuthCookies = function (response, forgetDevice) {
        var _a, _b;
        if (!response.clearCookie) {
            return; // Response doesn't support cookie clearing (shouldn't happen)
        }
        var cookieOptions = ((_a = this.config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.cookieOptions) || {};
        var prefix = ((_b = this.config.tokenDelivery) === null || _b === void 0 ? void 0 : _b.cookieNamePrefix) || 'nauth';
        // Clear access and refresh tokens
        response.clearCookie("".concat(prefix, "_access_token"), cookieOptions);
        response.clearCookie("".concat(prefix, "_refresh_token"), cookieOptions);
        // Clear device token if forgetting device
        if (forgetDevice) {
            response.clearCookie("".concat(prefix, "_device_token"), cookieOptions);
            response.clearCookie("".concat(prefix, "_device_id"), cookieOptions); // Legacy name
        }
    };
    /**
     * Global signout (revoke all user sessions)
     * @param sub - External user identifier (sub/UUID)
     * @returns Number of sessions revoked
     */
    AuthService.prototype.logoutAll = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var user, revokedCount, response;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        user = (_d.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.sessionService.revokeAllUserSessions(user.id, 'Global signout')];
                    case 2:
                        revokedCount = _d.sent();
                        response = this.clientInfoService.getResponse();
                        if (response && ((_a = this.config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.method) !== 'json') {
                            // Clear all auth cookies including device token (since all sessions are revoked)
                            this.clearAuthCookies(response, true);
                            (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug) === null || _c === void 0 ? void 0 : _c.call(_b, 'Auth cookies cleared automatically on global logout');
                        }
                        return [2 /*return*/, { revokedCount: revokedCount }];
                }
            });
        });
    };
    // ============================================================================
    // Password Management
    // ============================================================================
    /**
     * Change the password for an existing user.
     *
     * Verifies the current password, validates the new password,
     * checks password reuse policy, and updates the user's password hash and history.
     * Executes configured pre-change hooks if provided.
     *
     * @param sub - External user identifier (sub/UUID)
     * @param dto - ChangePasswordDTO containing old and new password
     * @returns void
     * @throws {NAuthException} If the user is not found, current password is incorrect, the new password is weak, password reuse is detected, or password change is disallowed by hooks.
     *
     * @example
     * ```typescript
     * await authService.changePassword('user-uuid', {
     *   oldPassword: 'currentPass123!',
     *   newPassword: 'newStr0ngPass!@#',
     * });
     * ```
     */
    AuthService.prototype.changePassword = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var user, result, isValid, validation, isReused, newHash, newHistory, auditError_12, errorMessage;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        user = (_g.sent());
                        if (!user || !user.passwordHash) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        if (!((_a = this.config.hooks) === null || _a === void 0 ? void 0 : _a.beforePasswordChange)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.config.hooks.beforePasswordChange(dto.sub, dto.oldPassword)];
                    case 2:
                        result = _g.sent();
                        if (result === false) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED, 'Password change not allowed');
                        }
                        _g.label = 3;
                    case 3: return [4 /*yield*/, this.passwordService.verifyPassword(dto.oldPassword, user.passwordHash)];
                    case 4:
                        isValid = _g.sent();
                        if (!isValid) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PASSWORD_INCORRECT, 'Current password is incorrect');
                        }
                        return [4 /*yield*/, this.passwordService.validatePassword(dto.newPassword, {
                                email: user.email,
                                username: user.username || undefined,
                            })];
                    case 5:
                        validation = _g.sent();
                        if (!validation.valid) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.WEAK_PASSWORD, validation.errors.join(', '), {
                                errors: validation.errors,
                            });
                        }
                        if (!(((_b = this.config.password) === null || _b === void 0 ? void 0 : _b.historyCount) && user.passwordHistory)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.passwordService.isPasswordInHistory(dto.newPassword, user.passwordHistory)];
                    case 6:
                        isReused = _g.sent();
                        if (isReused) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PASSWORD_REUSED, 'Cannot reuse recent passwords');
                        }
                        _g.label = 7;
                    case 7: return [4 /*yield*/, this.passwordService.hashPassword(dto.newPassword)];
                    case 8:
                        newHash = _g.sent();
                        newHistory = this.passwordService.addToHistory(user.passwordHistory || [], user.passwordHash);
                        // Update user - use internal id for update query
                        return [4 /*yield*/, this.userRepository.update(user.id, {
                                passwordHash: newHash,
                                passwordChangedAt: new Date(),
                                passwordHistory: newHistory,
                            })];
                    case 9:
                        // Update user - use internal id for update query
                        _g.sent();
                        if (!((_c = this.config.hooks) === null || _c === void 0 ? void 0 : _c.afterPasswordChange)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.config.hooks.afterPasswordChange(dto.sub)];
                    case 10:
                        _g.sent();
                        _g.label = 11;
                    case 11: 
                    // Optionally revoke all sessions (force re-login) - use internal id
                    return [4 /*yield*/, this.sessionService.revokeAllUserSessions(user.id, 'Password changed')];
                    case 12:
                        // Optionally revoke all sessions (force re-login) - use internal id
                        _g.sent();
                        _g.label = 13;
                    case 13:
                        _g.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, ((_d = this.auditService) === null || _d === void 0 ? void 0 : _d.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PASSWORD_CHANGED,
                                eventStatus: 'SUCCESS',
                                // Client info automatically included from context
                            }))];
                    case 14:
                        _g.sent();
                        return [3 /*break*/, 16];
                    case 15:
                        auditError_12 = _g.sent();
                        errorMessage = auditError_12 instanceof Error ? auditError_12.message : 'Unknown error';
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.call(_e, "Failed to record PASSWORD_CHANGED audit event: ".concat(errorMessage), {
                            error: auditError_12,
                            userId: user.id,
                        });
                        return [3 /*break*/, 16];
                    case 16: return [2 /*return*/, { success: true }];
                }
            });
        });
    };
    /**
     * Update user profile attributes.
     *
     * Updates user fields (name, email, phone, username, metadata) and enforces unique constraints and verification rules.
     *
     * @param sub - User sub/UUID
     * @param updateData - User fields to update
     * @returns Updated user object
     * @throws {NAuthException} If user not found or unique constraint violated
     *
     * @example
     * await authService.updateUserAttributes(sub, { email: 'test@example.com' });
     */
    AuthService.prototype.updateUserAttributes = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var user, updateFields, oldPhone, smsDevices, allActiveDevices, error_6, errorMessage, existingMetadata, updatedUser, updatedFieldNames, fieldChanges, oldMetadata, newMetadata, metadataChanges, allKeys, _i, allKeys_1, key, oldValue, newValue, emailVerificationChanged, phoneVerificationChanged, auditError_13, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
            return __generator(this, function (_2) {
                switch (_2.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        user = (_2.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        // Check for uniqueness constraints - use internal id
                        return [4 /*yield*/, this.validateUniquenessConstraints(user.id, dto)];
                    case 2:
                        // Check for uniqueness constraints - use internal id
                        _2.sent();
                        updateFields = {};
                        // Update basic fields if provided
                        if (dto.firstName !== undefined) {
                            updateFields.firstName = dto.firstName;
                        }
                        if (dto.lastName !== undefined) {
                            updateFields.lastName = dto.lastName;
                        }
                        if (dto.username !== undefined) {
                            updateFields.username = dto.username;
                        }
                        if (dto.email !== undefined) {
                            updateFields.email = dto.email;
                            // Reset email verification if email changed (unless retainVerification is true)
                            if (dto.email !== user.email) {
                                if (!dto.retainVerification) {
                                    updateFields.isEmailVerified = false;
                                }
                                else {
                                    // Explicitly retain current verification status
                                    updateFields.isEmailVerified = user.isEmailVerified;
                                }
                            }
                        }
                        if (!(dto.phone !== undefined)) return [3 /*break*/, 9];
                        oldPhone = user.phone;
                        updateFields.phone = dto.phone;
                        if (!(dto.phone !== user.phone)) return [3 /*break*/, 9];
                        if (!dto.retainVerification) {
                            updateFields.isPhoneVerified = false;
                        }
                        else {
                            // Explicitly retain current verification status
                            updateFields.isPhoneVerified = user.isPhoneVerified;
                        }
                        if (!(oldPhone && this.mfaDeviceRepository)) return [3 /*break*/, 9];
                        _2.label = 3;
                    case 3:
                        _2.trys.push([3, 8, , 9]);
                        return [4 /*yield*/, this.mfaDeviceRepository.find({
                                where: {
                                    userId: user.id,
                                    type: mfa_method_enum_1.MFAMethod.SMS,
                                    phoneNumber: oldPhone,
                                    isActive: true,
                                },
                            })];
                    case 4:
                        smsDevices = (_2.sent());
                        if (!(smsDevices.length > 0)) return [3 /*break*/, 7];
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Deactivating ".concat(smsDevices.length, " SMS MFA device(s) for user ").concat(user.sub, " due to phone number change (old: ").concat(oldPhone, ", new: ").concat(dto.phone, ")"));
                        // Deactivate all SMS devices with old phone number
                        return [4 /*yield*/, this.mfaDeviceRepository.update({
                                userId: user.id,
                                type: mfa_method_enum_1.MFAMethod.SMS,
                                phoneNumber: oldPhone,
                                isActive: true,
                            }, { isActive: false })];
                    case 5:
                        // Deactivate all SMS devices with old phone number
                        _2.sent();
                        return [4 /*yield*/, this.mfaDeviceRepository.find({
                                where: {
                                    userId: user.id,
                                    isActive: true,
                                },
                            })];
                    case 6:
                        allActiveDevices = (_2.sent());
                        // If no active devices remain and user had MFA enabled, disable MFA
                        if (allActiveDevices.length === 0 && user.mfaEnabled) {
                            updateFields.mfaEnabled = false;
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "MFA disabled for user ".concat(user.sub, " - no active MFA devices remaining after phone change"));
                        }
                        else {
                            (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "User ".concat(user.sub, " still has ").concat(allActiveDevices.length, " active MFA device(s) - MFA remains enabled"));
                        }
                        _2.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_6 = _2.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : 'Unknown error';
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.warn) === null || _h === void 0 ? void 0 : _h.call(_g, "Failed to handle MFA device deactivation during phone change for user ".concat(user.sub, ": ").concat(errorMessage));
                        return [3 /*break*/, 9];
                    case 9:
                        // Handle preferred MFA method
                        if (dto.preferredMfaMethod !== undefined) {
                            updateFields.preferredMfaMethod = dto.preferredMfaMethod;
                        }
                        // Handle metadata merge
                        if (dto.metadata !== undefined) {
                            existingMetadata = user.metadata || {};
                            updateFields.metadata = __assign(__assign({}, existingMetadata), dto.metadata);
                        }
                        // Update user in database - use internal id for update query
                        return [4 /*yield*/, this.userRepository.update(user.id, updateFields)];
                    case 10:
                        // Update user in database - use internal id for update query
                        _2.sent();
                        return [4 /*yield*/, this.userRepository.findOne({ where: { id: user.id } })];
                    case 11:
                        updatedUser = (_2.sent());
                        if (!updatedUser) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found after update');
                        }
                        _2.label = 12;
                    case 12:
                        _2.trys.push([12, 20, , 21]);
                        updatedFieldNames = Object.keys(updateFields);
                        fieldChanges = {};
                        // Capture before/after values for each updated field
                        if (dto.firstName !== undefined && dto.firstName !== user.firstName) {
                            fieldChanges.firstName = {
                                before: (_j = user.firstName) !== null && _j !== void 0 ? _j : null,
                                after: (_k = dto.firstName) !== null && _k !== void 0 ? _k : null,
                            };
                        }
                        if (dto.lastName !== undefined && dto.lastName !== user.lastName) {
                            fieldChanges.lastName = {
                                before: (_l = user.lastName) !== null && _l !== void 0 ? _l : null,
                                after: (_m = dto.lastName) !== null && _m !== void 0 ? _m : null,
                            };
                        }
                        if (dto.username !== undefined && dto.username !== user.username) {
                            fieldChanges.username = {
                                before: (_o = user.username) !== null && _o !== void 0 ? _o : null,
                                after: (_p = dto.username) !== null && _p !== void 0 ? _p : null,
                            };
                        }
                        // Note: email and phone are tracked separately with specific audit events,
                        // but we include them in fieldChanges for completeness
                        if (dto.email !== undefined && dto.email !== user.email) {
                            fieldChanges.email = {
                                before: (_q = user.email) !== null && _q !== void 0 ? _q : null,
                                after: (_r = dto.email) !== null && _r !== void 0 ? _r : null,
                            };
                        }
                        if (dto.phone !== undefined && dto.phone !== user.phone) {
                            fieldChanges.phone = {
                                before: (_s = user.phone) !== null && _s !== void 0 ? _s : null,
                                after: (_t = dto.phone) !== null && _t !== void 0 ? _t : null,
                            };
                        }
                        if (dto.preferredMfaMethod !== undefined && dto.preferredMfaMethod !== user.preferredMfaMethod) {
                            fieldChanges.preferredMfaMethod = {
                                before: (_u = user.preferredMfaMethod) !== null && _u !== void 0 ? _u : null,
                                after: (_v = dto.preferredMfaMethod) !== null && _v !== void 0 ? _v : null,
                            };
                        }
                        // Handle metadata changes (merged, so track what was added/changed)
                        if (dto.metadata !== undefined) {
                            oldMetadata = user.metadata || {};
                            newMetadata = __assign(__assign({}, oldMetadata), dto.metadata);
                            metadataChanges = {};
                            allKeys = new Set(__spreadArray(__spreadArray([], Object.keys(oldMetadata), true), Object.keys(dto.metadata), true));
                            for (_i = 0, allKeys_1 = allKeys; _i < allKeys_1.length; _i++) {
                                key = allKeys_1[_i];
                                oldValue = oldMetadata[key];
                                newValue = newMetadata[key];
                                // Only track if value actually changed
                                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                                    metadataChanges[key] = {
                                        before: oldValue !== null && oldValue !== void 0 ? oldValue : null,
                                        after: newValue !== null && newValue !== void 0 ? newValue : null,
                                    };
                                }
                            }
                            if (Object.keys(metadataChanges).length > 0) {
                                fieldChanges.metadata = metadataChanges;
                            }
                        }
                        // Track verification status changes if email/phone changed
                        if (dto.email !== undefined && dto.email !== user.email) {
                            emailVerificationChanged = !dto.retainVerification && updateFields.isEmailVerified === false;
                            if (emailVerificationChanged) {
                                fieldChanges.isEmailVerified = {
                                    before: user.isEmailVerified,
                                    after: false,
                                };
                            }
                        }
                        if (dto.phone !== undefined && dto.phone !== user.phone) {
                            phoneVerificationChanged = !dto.retainVerification && updateFields.isPhoneVerified === false;
                            if (phoneVerificationChanged) {
                                fieldChanges.isPhoneVerified = {
                                    before: user.isPhoneVerified,
                                    after: false,
                                };
                            }
                        }
                        // Record general profile update with field changes
                        return [4 /*yield*/, ((_w = this.auditService) === null || _w === void 0 ? void 0 : _w.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PROFILE_UPDATED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    updatedFields: updatedFieldNames,
                                    fieldChanges: Object.keys(fieldChanges).length > 0 ? fieldChanges : undefined,
                                },
                            }))];
                    case 13:
                        // Record general profile update with field changes
                        _2.sent();
                        if (!(dto.email !== undefined && dto.email !== user.email)) return [3 /*break*/, 15];
                        return [4 /*yield*/, ((_x = this.auditService) === null || _x === void 0 ? void 0 : _x.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.EMAIL_CHANGED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    oldEmail: user.email,
                                    newEmail: dto.email,
                                    retainVerification: dto.retainVerification || false,
                                },
                            }))];
                    case 14:
                        _2.sent();
                        _2.label = 15;
                    case 15:
                        if (!(dto.phone !== undefined && dto.phone !== user.phone)) return [3 /*break*/, 17];
                        return [4 /*yield*/, ((_y = this.auditService) === null || _y === void 0 ? void 0 : _y.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PHONE_CHANGED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    oldPhone: user.phone,
                                    newPhone: dto.phone,
                                    retainVerification: dto.retainVerification || false,
                                },
                            }))];
                    case 16:
                        _2.sent();
                        _2.label = 17;
                    case 17:
                        if (!(dto.username !== undefined && dto.username !== user.username)) return [3 /*break*/, 19];
                        return [4 /*yield*/, ((_z = this.auditService) === null || _z === void 0 ? void 0 : _z.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.USERNAME_CHANGED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    oldUsername: user.username,
                                    newUsername: dto.username,
                                },
                            }))];
                    case 18:
                        _2.sent();
                        _2.label = 19;
                    case 19: return [3 /*break*/, 21];
                    case 20:
                        auditError_13 = _2.sent();
                        errorMessage = auditError_13 instanceof Error ? auditError_13.message : 'Unknown error';
                        (_1 = (_0 = this.logger) === null || _0 === void 0 ? void 0 : _0.error) === null || _1 === void 0 ? void 0 : _1.call(_0, "Failed to record profile update audit events: ".concat(errorMessage), {
                            error: auditError_13,
                            userId: user.id,
                        });
                        return [3 /*break*/, 21];
                    case 21: 
                    // Return user response DTO
                    return [2 /*return*/, user_response_dto_1.UserResponseDto.fromEntity(updatedUser)];
                }
            });
        });
    };
    /**
     * Ensures email, phone, and username are unique for other users before update.
     *
     * Throws if another user already has the specified email, phone, or username.
     *
     * @param userId - Internal numeric user ID (excluded from check)
     * @param updateData - User fields to check for uniqueness
     * @throws {NAuthException} If a unique constraint is violated for email, phone, or username
     *
     * @example
     * ```typescript
     * await authService.validateUniquenessConstraints(1, { email: "test@example.com" });
     * ```
     */
    AuthService.prototype.validateUniquenessConstraints = function (userId, updateData) {
        return __awaiter(this, void 0, void 0, function () {
            var conflicts, existingUser, existingUser, existingUser;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        conflicts = [];
                        if (!updateData.email) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { email: updateData.email },
                            })];
                    case 1:
                        existingUser = _a.sent();
                        if (existingUser && existingUser.id !== userId) {
                            conflicts.push('Email already exists');
                        }
                        _a.label = 2;
                    case 2:
                        if (!updateData.phone) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { phone: updateData.phone },
                            })];
                    case 3:
                        existingUser = _a.sent();
                        if (existingUser && existingUser.id !== userId) {
                            conflicts.push('Phone number already exists');
                        }
                        _a.label = 4;
                    case 4:
                        if (!updateData.username) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.userRepository.findOne({
                                where: { username: updateData.username },
                            })];
                    case 5:
                        existingUser = _a.sent();
                        if (existingUser && existingUser.id !== userId) {
                            conflicts.push('Username already exists');
                        }
                        _a.label = 6;
                    case 6:
                        if (conflicts.length > 0) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, conflicts.join(', '), {
                                conflicts: conflicts,
                            });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Checks if the login identifier matches the specified allowed type.
     *
     * Determines if the given identifier is a valid email, username, phone, or allowed hybrid,
     * according to the configured identifier type restriction.
     *
     * @param identifier - The login identifier to check (email, username, or phone)
     * @param allowedType - The permitted identifier type ('email', 'username', 'phone', or 'email_or_username')
     * @returns True if the identifier conforms to the allowed type, otherwise false
     *
     * @example
     * ```typescript
     * // Email check
     * const valid = this.validateIdentifierType('user@example.com', 'email'); // true
     *
     * // Username check
     * const valid = this.validateIdentifierType('johndoe', 'username'); // true
     * ```
     */
    AuthService.prototype.validateIdentifierType = function (identifier, allowedType) {
        // Check if identifier is an email (contains @)
        var isEmail = identifier.includes('@');
        // Check if identifier looks like a phone (starts with + and contains digits)
        var isPhone = /^\+[1-9]\d{1,14}$/.test(identifier.trim());
        // If not email or phone, assume it's a username
        var isUsername = !isEmail && !isPhone;
        switch (allowedType) {
            case 'email':
                return isEmail;
            case 'username':
                return isUsername;
            case 'phone':
                return isPhone;
            case 'email_or_username':
                return isEmail || isUsername;
            default:
                return true; // No restriction
        }
    };
    /**
     * Retrieves a user entity by login identifier.
     *
     * Performs a lookup for a user by email, username, or phone number.
     * The search respects the identifierType restriction when provided, limiting which fields are queried.
     *
     * @param identifier - Login credential (email, username, or phone)
     * @param identifierType - Restricts search to a specific identifier type ('email', 'username', 'phone', or 'email_or_username')
     * @returns The user entity if found, otherwise null
     *
     * @example
     * ```typescript
     * const user = await this.findUserByIdentifier('user@example.com');
     * const user2 = await this.findUserByIdentifier('johndoe', 'username');
     * ```
     */
    AuthService.prototype.findUserByIdentifier = function (identifier, identifierType) {
        return __awaiter(this, void 0, void 0, function () {
            var queryBuilder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryBuilder = this.userRepository.createQueryBuilder('user');
                        // Build query based on identifier type restriction
                        if (!identifierType) {
                            // No restriction - search all fields
                            queryBuilder
                                .where('user.email = :identifier', { identifier: identifier })
                                .orWhere('user.username = :identifier', { identifier: identifier })
                                .orWhere('user.phone = :identifier', { identifier: identifier });
                        }
                        else {
                            // Apply restriction based on identifier type
                            switch (identifierType) {
                                case 'email':
                                    queryBuilder.where('user.email = :identifier', { identifier: identifier });
                                    break;
                                case 'username':
                                    queryBuilder.where('user.username = :identifier', { identifier: identifier });
                                    break;
                                case 'phone':
                                    queryBuilder.where('user.phone = :identifier', { identifier: identifier });
                                    break;
                                case 'email_or_username':
                                    queryBuilder
                                        .where('user.email = :identifier', { identifier: identifier })
                                        .orWhere('user.username = :identifier', { identifier: identifier });
                                    break;
                            }
                        }
                        // Select only columns required for login checks and response shaping to reduce row size
                        queryBuilder.select([
                            'user.id',
                            'user.sub',
                            'user.email',
                            'user.username',
                            'user.phone',
                            'user.passwordHash',
                            'user.passwordChangedAt',
                            'user.mustChangePassword',
                            'user.isActive',
                            'user.mfaEnabled',
                            'user.preferredMfaMethod',
                            'user.isEmailVerified',
                            'user.isPhoneVerified',
                            'user.mfaExempt', // Required for MFA exemption check in challenge flow
                            // The following are used for messaging/challenge determination when needed
                            'user.socialProviders',
                            'user.backupCodes',
                        ]);
                        return [4 /*yield*/, queryBuilder.getOne()];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Handles a failed login by recording the attempt, applying IP-based lockout policy,
     * and invoking relevant hooks.
     *
     * @param identifier - User identifier (email/username/phone)
     * @param reason - Optional reason for failure
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await authService.handleFailedLogin('user@example.com', 'invalid_credentials');
     * ```
     */
    AuthService.prototype.handleFailedLogin = function (identifier, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, ipAddress, attempts;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        ipAddress = clientInfo.ipAddress;
                        // Record failed attempt
                        return [4 /*yield*/, this.recordLoginAttempt(identifier, false, reason)];
                    case 1:
                        // Record failed attempt
                        _b.sent();
                        if (!(((_a = this.config.lockout) === null || _a === void 0 ? void 0 : _a.enabled) && ipAddress)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.accountLockoutStorage.recordFailedAttempt(ipAddress)];
                    case 2:
                        attempts = _b.sent();
                        if (!(attempts >= (this.config.lockout.maxAttempts || 5))) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.accountLockoutStorage.blockIpAdresss(ipAddress, this.config.lockout.duration || 900, // 15 minutes default
                            'Too many failed login attempts from this IP')];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Records a login attempt with client context.
     *
     * @param email - User's email address
     * @param success - True if login succeeded, false if failed
     * @param failureReason - Optional reason for failure
     * @param userId - Optional internal user ID (only for successful logins)
     * @returns Promise<void>
     */
    AuthService.prototype.recordLoginAttempt = function (email, success, failureReason, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, attempt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        attempt = this.loginAttemptRepository.create({
                            email: email,
                            userId: userId, // Internal user ID (integer)
                            ipAddress: clientInfo.ipAddress,
                            userAgent: clientInfo.userAgent,
                            success: success,
                            failureReason: failureReason,
                        });
                        return [4 /*yield*/, this.loginAttemptRepository.save(attempt)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get user by ID (sub)
     * @param sub - User sub (external identifier)
     * @returns User entity or null
     */
    AuthService.prototype.getUserById = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.sub } })];
                    case 1:
                        user = (_a.sent());
                        return [2 /*return*/, user ? user_response_dto_1.UserResponseDto.fromEntity(user) : null];
                }
            });
        });
    };
    /**
     * Get user by email address.
     *
     * @param email - User email
     * @param requireEmailVerified - Only return user if email is verified (default: false)
     * @returns User entity or null
     * @internal - For use by social auth providers
     *
     * @example
     * ```typescript
     * const user = await authService.getUserByEmail('user@example.com', true);
     * ```
     */
    AuthService.prototype.getUserByEmail = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var where, user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        where = dto.requireEmailVerified
                            ? { email: dto.email, isEmailVerified: true }
                            : { email: dto.email };
                        return [4 /*yield*/, this.userRepository.findOne({ where: where })];
                    case 1:
                        user = (_a.sent());
                        return [2 /*return*/, user ? user_response_dto_1.UserResponseDto.fromEntity(user) : null];
                }
            });
        });
    };
    /**
     * Require user to change password at next login.
     *
     * Throws if user not found or has no password set (e.g. social login only).
     *
     * @param userId - User's sub identifier
     * @returns Resolves when flag is set
     * @throws {NAuthException} If user is not found or cannot change password
     *
     * @example
     * await authService.setMustChangePassword('user-uuid-123');
     */
    AuthService.prototype.setMustChangePassword = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: dto.userId } })];
                    case 1:
                        user = _e.sent();
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        //  CRITICAL PROTECTION: Only allow for users with password authentication
                        // Pure social users cannot be forced to change password
                        if (!user.passwordHash) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Cannot force password change for user ".concat(dto.userId, " - user doesn't have a password (pure social signup)"));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED, 'Password change not available. This account uses social authentication only and has no password.');
                        }
                        return [4 /*yield*/, this.userRepository.update({ sub: dto.userId }, { mustChangePassword: true })];
                    case 2:
                        _e.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.log) === null || _d === void 0 ? void 0 : _d.call(_c, "Must-change-password flag set for user: ".concat(dto.userId));
                        return [2 /*return*/, { success: true }];
                }
            });
        });
    };
    return AuthService;
}());
exports.AuthService = AuthService;
