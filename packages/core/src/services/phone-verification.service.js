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
exports.PhoneVerificationService = void 0;
var typeorm_1 = require("typeorm");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var verify_phone_dto_1 = require("../dto/verify-phone.dto");
var crypto = require("crypto");
/**
 * Phone Verification Service (Core)
 *
 * Database-agnostic phone verification workflow with provider-driven SMS delivery.
 *
 * WHY: Keeps core business logic independent of database and SMS vendors. Databases are
 * injected via repository tokens and SMS via an `SMSProvider` adapter so consumers
 * can plug in Postgres, MySQL, or any SMS provider without code changes.
 *
 * @example
 * ```typescript
 * // Send OTP
 * const tokenId = await phoneVerificationService.sendVerificationSMS('user-sub');
 *
 * // Verify by sub
 * await phoneVerificationService.verifyPhoneWithCodeBySub('user-sub', '123456');
 *
 * // Resend
 * await phoneVerificationService.resendVerificationSMS('user-sub');
 * ```
 */
var PhoneVerificationService = /** @class */ (function () {
    function PhoneVerificationService(verificationTokenRepo, userRepo, smsProvider, storageAdapter, config, clientInfoService, logger, auditService) {
        this.verificationTokenRepo = verificationTokenRepo;
        this.userRepo = userRepo;
        this.smsProvider = smsProvider;
        this.storageAdapter = storageAdapter;
        this.config = config;
        this.clientInfoService = clientInfoService;
        this.logger = logger;
        this.auditService = auditService;
    }
    /**
     * Send verification SMS to user identified by `sub`.
     * Applies rate limits and resend delay, stores hashed token + OTP, and sends via SMS provider.
     *
     * @param dto - Request DTO containing sub and skipAlreadyVerifiedCheck
     * @returns Response DTO with verification token ID
     * @throws {NAuthException} RATE_LIMIT_SMS | NOT_FOUND | PHONE_REQUIRED | ALREADY_VERIFIED | RATE_LIMIT_RESEND
     */
    PhoneVerificationService.prototype.sendVerificationSMS = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var sub, _a, skipAlreadyVerifiedCheck, rateLimitKey, rateLimitMax, rateLimitWindow, ttlBefore, isWindowExpired, currentCount, actualTtl, user, resendDelay, lastToken, secondsSinceLastSend, waitSeconds, code, token, tokenHash, clientInfo, ipAddress, userAgent, verificationToken, saved, auditError_1, errorMessage;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
            return __generator(this, function (_z) {
                switch (_z.label) {
                    case 0:
                        sub = dto.sub, _a = dto.skipAlreadyVerifiedCheck, skipAlreadyVerifiedCheck = _a === void 0 ? true : _a;
                        rateLimitKey = "phone-verification:".concat(sub);
                        rateLimitMax = ((_c = (_b = this.config.signup) === null || _b === void 0 ? void 0 : _b.phoneVerification) === null || _c === void 0 ? void 0 : _c.rateLimitMax) || 3;
                        rateLimitWindow = ((_e = (_d = this.config.signup) === null || _d === void 0 ? void 0 : _d.phoneVerification) === null || _e === void 0 ? void 0 : _e.rateLimitWindow) || 3600;
                        return [4 /*yield*/, this.storageAdapter.ttl(rateLimitKey)];
                    case 1:
                        ttlBefore = _z.sent();
                        isWindowExpired = ttlBefore === -1 || ttlBefore < 0 || ttlBefore > rateLimitWindow;
                        if (!(ttlBefore > rateLimitWindow)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.storageAdapter.del(rateLimitKey)];
                    case 2:
                        _z.sent();
                        _z.label = 3;
                    case 3: return [4 /*yield*/, this.storageAdapter.incr(rateLimitKey, isWindowExpired ? rateLimitWindow : undefined)];
                    case 4:
                        currentCount = _z.sent();
                        // If we created a new window, log it
                        if (isWindowExpired && currentCount === 1) {
                            (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "Rate limit window reset for phone verification: sub=".concat(sub, ", window=").concat(rateLimitWindow, "s, max=").concat(rateLimitMax));
                        }
                        return [4 /*yield*/, this.storageAdapter.ttl(rateLimitKey)];
                    case 5:
                        actualTtl = _z.sent();
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.debug) === null || _j === void 0 ? void 0 : _j.call(_h, "Phone verification rate limit check: sub=".concat(sub, ", count=").concat(currentCount, "/").concat(rateLimitMax, ", ttl=").concat(actualTtl, "s"));
                        if (currentCount > rateLimitMax) {
                            (_l = (_k = this.logger) === null || _k === void 0 ? void 0 : _k.warn) === null || _l === void 0 ? void 0 : _l.call(_k, "SMS rate limit exceeded: sub=".concat(sub, ", count=").concat(currentCount, ", max=").concat(rateLimitMax, ", retryAfter=").concat(actualTtl, "s"));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_SMS, "Too many verification SMS sent. Please try again in ".concat(actualTtl > 0 ? actualTtl : rateLimitWindow, " seconds"), {
                                retryAfter: actualTtl > 0 ? actualTtl : rateLimitWindow,
                                currentCount: currentCount,
                                maxAttempts: rateLimitMax,
                            });
                        }
                        return [4 /*yield*/, this.userRepo.findOne({ where: { sub: sub } })];
                    case 6:
                        user = (_z.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        if (!user.phone) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PHONE_REQUIRED, 'No phone number associated with this account');
                        }
                        // Only check "already verified" if not skipping (skip for MFA contexts where codes are needed even if phone is verified)
                        if (!skipAlreadyVerifiedCheck && user.isPhoneVerified) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.ALREADY_VERIFIED, 'Phone already verified');
                        }
                        resendDelay = (_p = (_o = (_m = this.config.signup) === null || _m === void 0 ? void 0 : _m.phoneVerification) === null || _o === void 0 ? void 0 : _o.resendDelay) !== null && _p !== void 0 ? _p : 60;
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: { userId: user.id, type: 'phone' },
                                order: { createdAt: 'DESC' },
                            })];
                    case 7:
                        lastToken = (_z.sent());
                        if (lastToken) {
                            secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
                            if (secondsSinceLastSend < resendDelay) {
                                waitSeconds = Math.ceil(resendDelay - secondsSinceLastSend);
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_RESEND, "Please wait ".concat(waitSeconds, " seconds before requesting another code"), {
                                    retryAfter: waitSeconds,
                                    resendDelay: resendDelay,
                                });
                            }
                        }
                        // Invalidate existing unused tokens for this user
                        return [4 /*yield*/, this.verificationTokenRepo.update({ userId: user.id, type: 'phone', usedAt: (0, typeorm_1.IsNull)() }, { usedAt: new Date() })];
                    case 8:
                        // Invalidate existing unused tokens for this user
                        _z.sent();
                        code = this.generateCode();
                        token = this.generateToken();
                        tokenHash = this.hashToken(token);
                        clientInfo = this.clientInfoService.get();
                        ipAddress = clientInfo.ipAddress, userAgent = clientInfo.userAgent;
                        verificationToken = this.verificationTokenRepo.create({
                            userId: user.id,
                            type: 'phone',
                            token: tokenHash,
                            code: code,
                            expiresAt: new Date(Date.now() + (((_r = (_q = this.config.signup) === null || _q === void 0 ? void 0 : _q.phoneVerification) === null || _r === void 0 ? void 0 : _r.expiresIn) || 300) * 1000),
                            attempts: 0,
                            ipAddress: ipAddress,
                            userAgent: userAgent,
                        });
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 9:
                        saved = (_z.sent());
                        (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.log) === null || _t === void 0 ? void 0 : _t.call(_s, "SMS token created: sub=".concat(sub, ", tokenId=").concat(saved.id, ", code=").concat(code, ", codeType=").concat(typeof code, ", userId=").concat(user.id, ", usedAt=").concat(saved.usedAt || 'null'));
                        return [4 /*yield*/, this.smsProvider.sendOTP(user.phone, code)];
                    case 10:
                        _z.sent();
                        (_v = (_u = this.logger) === null || _u === void 0 ? void 0 : _u.log) === null || _v === void 0 ? void 0 : _v.call(_u, "SMS verification code sent: sub=".concat(sub, ", tokenId=").concat(saved.id, ", phone=").concat(this.maskPhone(user.phone)));
                        _z.label = 11;
                    case 11:
                        _z.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, ((_w = this.auditService) === null || _w === void 0 ? void 0 : _w.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PHONE_VERIFICATION_REQUESTED,
                                eventStatus: 'INFO',
                                metadata: {
                                    // Client info automatically included from context
                                    verificationTokenId: saved.id,
                                    phone: this.maskPhone(user.phone),
                                },
                            }))];
                    case 12:
                        _z.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        auditError_1 = _z.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_y = (_x = this.logger) === null || _x === void 0 ? void 0 : _x.error) === null || _y === void 0 ? void 0 : _y.call(_x, "Failed to record PHONE_VERIFICATION_REQUESTED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                        });
                        return [3 /*break*/, 14];
                    case 14: return [2 /*return*/, { tokenId: saved.id }];
                }
            });
        });
    };
    /**
     * Verify phone by phone number and code.
     * Handles duplicate phone numbers by selecting the token whose user matches the phone provided.
     *
     * @param dto - Request DTO containing phone and code
     * @returns Response DTO with success message
     * @throws {NAuthException} VERIFICATION_CODE_INVALID | VERIFICATION_CODE_EXPIRED | VERIFICATION_TOO_MANY_ATTEMPTS
     */
    PhoneVerificationService.prototype.verifyPhoneWithCode = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var phone, code, candidateTokens, matched, _i, candidateTokens_1, token_1, user_1, token, user, maxAttemptsPerUser, maxAttemptsPerIP, attemptWindow, userRateLimitKey, userAttempts, clientInfo, ipRateLimitKey, ipAttempts, isExpired, maxAttempts, tooManyAttempts, auditError_2, errorMessage, auditError_3, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            return __generator(this, function (_y) {
                switch (_y.label) {
                    case 0:
                        phone = dto.phone, code = dto.code;
                        return [4 /*yield*/, this.verificationTokenRepo.find({
                                where: { type: 'phone', code: code, usedAt: (0, typeorm_1.IsNull)() },
                                order: { createdAt: 'DESC' },
                            })];
                    case 1:
                        candidateTokens = (_y.sent());
                        matched = null;
                        _i = 0, candidateTokens_1 = candidateTokens;
                        _y.label = 2;
                    case 2:
                        if (!(_i < candidateTokens_1.length)) return [3 /*break*/, 5];
                        token_1 = candidateTokens_1[_i];
                        return [4 /*yield*/, this.userRepo.findOne({ where: { id: token_1.userId } })];
                    case 3:
                        user_1 = (_y.sent());
                        if (user_1 && user_1.phone === phone) {
                            matched = { token: token_1, user: user_1 };
                            return [3 /*break*/, 5];
                        }
                        _y.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        if (!matched) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification code');
                        }
                        token = matched.token, user = matched.user;
                        maxAttemptsPerUser = (_c = (_b = (_a = this.config.signup) === null || _a === void 0 ? void 0 : _a.phoneVerification) === null || _b === void 0 ? void 0 : _b.maxAttemptsPerUser) !== null && _c !== void 0 ? _c : 10;
                        maxAttemptsPerIP = (_f = (_e = (_d = this.config.signup) === null || _d === void 0 ? void 0 : _d.phoneVerification) === null || _e === void 0 ? void 0 : _e.maxAttemptsPerIP) !== null && _f !== void 0 ? _f : 20;
                        attemptWindow = (_j = (_h = (_g = this.config.signup) === null || _g === void 0 ? void 0 : _g.phoneVerification) === null || _h === void 0 ? void 0 : _h.attemptWindow) !== null && _j !== void 0 ? _j : 3600;
                        userRateLimitKey = "verify-attempts:user:".concat(user.id);
                        return [4 /*yield*/, this.storageAdapter.incr(userRateLimitKey)];
                    case 6:
                        userAttempts = _y.sent();
                        if (!(userAttempts === 1)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.storageAdapter.expire(userRateLimitKey, attemptWindow)];
                    case 7:
                        _y.sent();
                        _y.label = 8;
                    case 8:
                        if (userAttempts > maxAttemptsPerUser) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many verification attempts. Please try again later.');
                        }
                        clientInfo = this.clientInfoService.get();
                        if (!clientInfo.ipAddress) return [3 /*break*/, 12];
                        ipRateLimitKey = "verify-attempts:ip:".concat(clientInfo.ipAddress);
                        return [4 /*yield*/, this.storageAdapter.incr(ipRateLimitKey)];
                    case 9:
                        ipAttempts = _y.sent();
                        if (!(ipAttempts === 1)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.storageAdapter.expire(ipRateLimitKey, attemptWindow)];
                    case 10:
                        _y.sent();
                        _y.label = 11;
                    case 11:
                        if (ipAttempts > maxAttemptsPerIP) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many verification attempts from this IP. Please try again later.');
                        }
                        _y.label = 12;
                    case 12:
                        isExpired = typeof token.isExpired === 'function' ? !!token.isExpired() : token.expiresAt.getTime() <= Date.now();
                        if (isExpired) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification code has expired');
                        }
                        maxAttempts = (_m = (_l = (_k = this.config.signup) === null || _k === void 0 ? void 0 : _k.phoneVerification) === null || _l === void 0 ? void 0 : _l.maxAttempts) !== null && _m !== void 0 ? _m : 3;
                        tooManyAttempts = typeof token.maxAttemptsExceeded === 'function'
                            ? !!token.maxAttemptsExceeded(maxAttempts)
                            : token.attempts >= maxAttempts;
                        if (tooManyAttempts) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many failed attempts. Request a new code.', {
                                maxAttempts: maxAttempts,
                                currentAttempts: token.attempts,
                            });
                        }
                        // Increment attempts even on success to prevent reuse by race
                        token.attempts += 1;
                        if (!(token.code !== code)) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.verificationTokenRepo.save(token)];
                    case 13:
                        _y.sent();
                        (_p = (_o = this.logger) === null || _o === void 0 ? void 0 : _o.debug) === null || _p === void 0 ? void 0 : _p.call(_o, "Phone verification failed: phone=".concat(this.maskPhone(phone), ", attempts=").concat(token.attempts, "/").concat(maxAttempts));
                        _y.label = 14;
                    case 14:
                        _y.trys.push([14, 16, , 17]);
                        return [4 /*yield*/, ((_q = this.auditService) === null || _q === void 0 ? void 0 : _q.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PHONE_VERIFICATION_FAILED,
                                eventStatus: 'FAILURE',
                                reason: 'invalid_code',
                                // Client info automatically included from context
                                description: 'Invalid verification code provided',
                                metadata: {
                                    verificationTokenId: token.id,
                                    attempts: token.attempts,
                                    phone: this.maskPhone(phone),
                                },
                            }))];
                    case 15:
                        _y.sent();
                        return [3 /*break*/, 17];
                    case 16:
                        auditError_2 = _y.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_s = (_r = this.logger) === null || _r === void 0 ? void 0 : _r.error) === null || _s === void 0 ? void 0 : _s.call(_r, "Failed to record PHONE_VERIFICATION_FAILED audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: user.id,
                        });
                        return [3 /*break*/, 17];
                    case 17: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code', {
                        attemptsRemaining: Math.max(0, maxAttempts - token.attempts),
                    });
                    case 18:
                        // Mark token used
                        token.usedAt = new Date();
                        return [4 /*yield*/, this.verificationTokenRepo.save(token)];
                    case 19:
                        _y.sent();
                        // Update user flags
                        return [4 /*yield*/, this.userRepo.update(user.id, {
                                isPhoneVerified: true,
                                isActive: true,
                            })];
                    case 20:
                        // Update user flags
                        _y.sent();
                        (_u = (_t = this.logger) === null || _t === void 0 ? void 0 : _t.log) === null || _u === void 0 ? void 0 : _u.call(_t, "Phone verification successful: userId=".concat(user.id, ", phone=").concat(this.maskPhone(phone)));
                        _y.label = 21;
                    case 21:
                        _y.trys.push([21, 23, , 24]);
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by AuditService
                        return [4 /*yield*/, ((_v = this.auditService) === null || _v === void 0 ? void 0 : _v.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PHONE_VERIFIED,
                                eventStatus: 'SUCCESS',
                                metadata: {
                                    // Client info automatically included from context
                                    verificationTokenId: token.id,
                                    verificationMethod: 'code',
                                    phone: this.maskPhone(phone),
                                },
                            }))];
                    case 22:
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by AuditService
                        _y.sent();
                        return [3 /*break*/, 24];
                    case 23:
                        auditError_3 = _y.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_x = (_w = this.logger) === null || _w === void 0 ? void 0 : _w.error) === null || _x === void 0 ? void 0 : _x.call(_w, "Failed to record PHONE_VERIFIED audit event: ".concat(errorMessage), {
                            error: auditError_3,
                            userId: user.id,
                        });
                        return [3 /*break*/, 24];
                    case 24: return [2 /*return*/, { message: 'Phone verified successfully. Please log in to continue.' }];
                }
            });
        });
    };
    /**
     * Verify phone by user sub and code.
     *
     * @param dto - Request DTO containing sub and code
     * @returns Response DTO with success message
     */
    PhoneVerificationService.prototype.verifyPhoneWithCodeBySub = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var sub, code, user, wasPhoneVerified, maxAttemptsPerIP, attemptWindow, clientInfo, codeString, verificationToken, incrementIPRateLimit, isExpired, maxAttempts, tooManyAttempts, maxAttemptsPerUser, incrementUserRateLimit, storedCode, providedCode, auditError_4, errorMessage, auditError_5, errorMessage;
            var _this = this;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
            return __generator(this, function (_4) {
                switch (_4.label) {
                    case 0:
                        sub = dto.sub, code = dto.code;
                        return [4 /*yield*/, this.userRepo.findOne({ where: { sub: sub } })];
                    case 1:
                        user = (_4.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        if (!user.phone) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.PHONE_REQUIRED, 'No phone number associated with this account');
                        }
                        wasPhoneVerified = Boolean(user.isPhoneVerified);
                        maxAttemptsPerIP = (_c = (_b = (_a = this.config.signup) === null || _a === void 0 ? void 0 : _a.phoneVerification) === null || _b === void 0 ? void 0 : _b.maxAttemptsPerIP) !== null && _c !== void 0 ? _c : 20;
                        attemptWindow = (_f = (_e = (_d = this.config.signup) === null || _d === void 0 ? void 0 : _d.phoneVerification) === null || _e === void 0 ? void 0 : _e.attemptWindow) !== null && _f !== void 0 ? _f : 3600;
                        clientInfo = this.clientInfoService.get();
                        codeString = String(code);
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.log) === null || _h === void 0 ? void 0 : _h.call(_g, "Looking for verification token: sub=".concat(sub, ", code=").concat(codeString, ", codeType=").concat(typeof code, ", userId=").concat(user.id));
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: { userId: user.id, type: 'phone', code: codeString, usedAt: (0, typeorm_1.IsNull)() },
                                order: { createdAt: 'DESC' },
                            })];
                    case 2:
                        verificationToken = (_4.sent());
                        incrementIPRateLimit = function () { return __awaiter(_this, void 0, void 0, function () {
                            var ipRateLimitKey, ipAttempts;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!clientInfo.ipAddress) return [3 /*break*/, 4];
                                        ipRateLimitKey = "verify-attempts:ip:".concat(clientInfo.ipAddress);
                                        return [4 /*yield*/, this.storageAdapter.incr(ipRateLimitKey)];
                                    case 1:
                                        ipAttempts = _a.sent();
                                        if (!(ipAttempts === 1)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, this.storageAdapter.expire(ipRateLimitKey, attemptWindow)];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        if (ipAttempts > maxAttemptsPerIP) {
                                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many verification attempts from this IP. Please try again later.');
                                        }
                                        _a.label = 4;
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); };
                        if (!!verificationToken) return [3 /*break*/, 4];
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.warn) === null || _k === void 0 ? void 0 : _k.call(_j, "Phone verification token not found: sub=".concat(sub, ", code=").concat(codeString, ", originalCodeType=").concat(typeof code, ", userId=").concat(user.id));
                        // Invalid attempt - increment IP rate limit
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 3:
                        // Invalid attempt - increment IP rate limit
                        _4.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification code');
                    case 4:
                        isExpired = typeof verificationToken.isExpired === 'function'
                            ? !!verificationToken.isExpired()
                            : verificationToken.expiresAt.getTime() <= Date.now();
                        if (!isExpired) return [3 /*break*/, 6];
                        // Expired token - increment IP rate limit
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 5:
                        // Expired token - increment IP rate limit
                        _4.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification code has expired');
                    case 6:
                        maxAttempts = (_o = (_m = (_l = this.config.signup) === null || _l === void 0 ? void 0 : _l.phoneVerification) === null || _m === void 0 ? void 0 : _m.maxAttempts) !== null && _o !== void 0 ? _o : 3;
                        tooManyAttempts = typeof verificationToken.maxAttemptsExceeded === 'function'
                            ? !!verificationToken.maxAttemptsExceeded(maxAttempts)
                            : verificationToken.attempts >= maxAttempts;
                        if (!tooManyAttempts) return [3 /*break*/, 8];
                        // Token exceeded max attempts - increment IP rate limit
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 7:
                        // Token exceeded max attempts - increment IP rate limit
                        _4.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many failed attempts. Request a new code.', {
                            maxAttempts: maxAttempts,
                            currentAttempts: verificationToken.attempts,
                        });
                    case 8:
                        maxAttemptsPerUser = (_r = (_q = (_p = this.config.signup) === null || _p === void 0 ? void 0 : _p.phoneVerification) === null || _q === void 0 ? void 0 : _q.maxAttemptsPerUser) !== null && _r !== void 0 ? _r : 10;
                        incrementUserRateLimit = function () { return __awaiter(_this, void 0, void 0, function () {
                            var userRateLimitKey, userAttempts;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        userRateLimitKey = "verify-attempts:user:".concat(user.id);
                                        return [4 /*yield*/, this.storageAdapter.incr(userRateLimitKey)];
                                    case 1:
                                        userAttempts = _a.sent();
                                        if (!(userAttempts === 1)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, this.storageAdapter.expire(userRateLimitKey, attemptWindow)];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        if (userAttempts > maxAttemptsPerUser) {
                                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many verification attempts. Please try again later.');
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        verificationToken.attempts += 1;
                        storedCode = String(verificationToken.code).trim();
                        providedCode = String(code).trim();
                        if (!(storedCode !== providedCode)) return [3 /*break*/, 16];
                        // Invalid code - increment both IP and user rate limits
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 9:
                        // Invalid code - increment both IP and user rate limits
                        _4.sent();
                        return [4 /*yield*/, incrementUserRateLimit()];
                    case 10:
                        _4.sent();
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 11:
                        _4.sent();
                        (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.debug) === null || _t === void 0 ? void 0 : _t.call(_s, "Phone verification failed: sub=".concat(sub, ", attempts=").concat(verificationToken.attempts, "/").concat(maxAttempts));
                        _4.label = 12;
                    case 12:
                        _4.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, ((_u = this.auditService) === null || _u === void 0 ? void 0 : _u.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PHONE_VERIFICATION_FAILED,
                                eventStatus: 'FAILURE',
                                reason: 'invalid_code',
                                // Client info automatically included from context
                                description: 'Invalid verification code provided',
                                metadata: {
                                    verificationTokenId: verificationToken.id,
                                    attempts: verificationToken.attempts,
                                    phone: this.maskPhone(user.phone || ''),
                                },
                            }))];
                    case 13:
                        _4.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        auditError_4 = _4.sent();
                        errorMessage = auditError_4 instanceof Error ? auditError_4.message : 'Unknown error';
                        (_w = (_v = this.logger) === null || _v === void 0 ? void 0 : _v.error) === null || _w === void 0 ? void 0 : _w.call(_v, "Failed to record PHONE_VERIFICATION_FAILED audit event (by sub): ".concat(errorMessage), {
                            error: auditError_4,
                            userId: user.id,
                        });
                        return [3 /*break*/, 15];
                    case 15: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code', {
                        attemptsRemaining: Math.max(0, maxAttempts - verificationToken.attempts),
                    });
                    case 16:
                        // ============================================================================
                        // Code is valid - proceed without rate limit checks
                        // Valid codes should always be allowed through
                        // ============================================================================
                        verificationToken.usedAt = new Date();
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 17:
                        _4.sent();
                        if (!!wasPhoneVerified) return [3 /*break*/, 19];
                        // Use update() with explicit WHERE clause to ensure the change is persisted
                        // This bypasses entity tracking issues and ensures the update is committed
                        return [4 /*yield*/, this.userRepo.update({ sub: sub }, {
                                isPhoneVerified: true,
                                isActive: true,
                            })];
                    case 18:
                        // Use update() with explicit WHERE clause to ensure the change is persisted
                        // This bypasses entity tracking issues and ensures the update is committed
                        _4.sent();
                        (_y = (_x = this.logger) === null || _x === void 0 ? void 0 : _x.log) === null || _y === void 0 ? void 0 : _y.call(_x, "Phone verification successful: sub=".concat(sub, ", userId=").concat(user.id, " - phone marked as verified"));
                        return [3 /*break*/, 20];
                    case 19:
                        // Phone already verified - just mark token as used, no user update needed
                        (_0 = (_z = this.logger) === null || _z === void 0 ? void 0 : _z.log) === null || _0 === void 0 ? void 0 : _0.call(_z, "Phone verification code validated: sub=".concat(sub, ", userId=").concat(user.id, " - phone already verified"));
                        _4.label = 20;
                    case 20:
                        _4.trys.push([20, 22, , 23]);
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by AuditService
                        return [4 /*yield*/, ((_1 = this.auditService) === null || _1 === void 0 ? void 0 : _1.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.PHONE_VERIFIED,
                                eventStatus: 'SUCCESS',
                                metadata: {
                                    // Client info automatically included from context
                                    verificationTokenId: verificationToken.id,
                                    verificationMethod: 'code',
                                    phone: this.maskPhone(user.phone || ''),
                                },
                            }))];
                    case 21:
                        // Client info (ipAddress, userAgent) automatically extracted from ClientInfoService
                        // Note: ClientInfoService is used transparently by AuditService
                        _4.sent();
                        return [3 /*break*/, 23];
                    case 22:
                        auditError_5 = _4.sent();
                        errorMessage = auditError_5 instanceof Error ? auditError_5.message : 'Unknown error';
                        (_3 = (_2 = this.logger) === null || _2 === void 0 ? void 0 : _2.error) === null || _3 === void 0 ? void 0 : _3.call(_2, "Failed to record PHONE_VERIFIED audit event (by sub): ".concat(errorMessage), {
                            error: auditError_5,
                            userId: user.id,
                        });
                        return [3 /*break*/, 23];
                    case 23: return [2 /*return*/, { message: 'Phone verified successfully. Please log in to continue.' }];
                }
            });
        });
    };
    /**
     * Resend verification SMS
     * Supports both sub and phone-based resend
     *
     * @param dto - Request DTO containing sub or phone
     * @returns Response DTO with verification token ID
     */
    PhoneVerificationService.prototype.resendVerificationSMS = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Validate that either sub or phone is provided
                if (!dto.sub && !dto.phone) {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Either sub or phone must be provided');
                }
                if (dto.sub) {
                    return [2 /*return*/, this.resendVerificationSMSBySub(dto.sub)];
                }
                return [2 /*return*/, this.resendVerificationSMSForPhone(dto.phone)];
            });
        });
    };
    /**
     * Resend verification SMS by user sub (private helper)
     *
     * @param sub - External user identifier
     * @returns New verification token id
     */
    PhoneVerificationService.prototype.resendVerificationSMSBySub = function (sub) {
        return __awaiter(this, void 0, void 0, function () {
            var user, resendDelay, lastToken, secondsSinceLastSend, waitSeconds, sendDto, result;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, this.userRepo.findOne({ where: { sub: sub } })];
                    case 1:
                        user = (_h.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        resendDelay = (_c = (_b = (_a = this.config.signup) === null || _a === void 0 ? void 0 : _a.phoneVerification) === null || _b === void 0 ? void 0 : _b.resendDelay) !== null && _c !== void 0 ? _c : 60;
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: { userId: user.id, type: 'phone' },
                                order: { createdAt: 'DESC' },
                            })];
                    case 2:
                        lastToken = (_h.sent());
                        if (lastToken) {
                            secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
                            if (secondsSinceLastSend < resendDelay) {
                                waitSeconds = Math.ceil(resendDelay - secondsSinceLastSend);
                                (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.debug) === null || _e === void 0 ? void 0 : _e.call(_d, "Resend rate limit: sub=".concat(sub, ", wait=").concat(waitSeconds, "s, delay=").concat(resendDelay, "s"));
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_RESEND, "Please wait ".concat(waitSeconds, " seconds before requesting another code"), {
                                    retryAfter: waitSeconds,
                                    resendDelay: resendDelay,
                                });
                            }
                        }
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "Resending SMS verification code: sub=".concat(sub));
                        sendDto = Object.assign(new verify_phone_dto_1.SendVerificationSMSDTO(), { sub: sub });
                        return [4 /*yield*/, this.sendVerificationSMS(sendDto)];
                    case 3:
                        result = _h.sent();
                        return [2 /*return*/, { tokenId: result.tokenId }];
                }
            });
        });
    };
    /**
     * Resend verification SMS by phone number (private helper)
     *
     * @param phone - Phone number
     * @returns New verification token id
     */
    PhoneVerificationService.prototype.resendVerificationSMSForPhone = function (phone) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepo.findOne({ where: { phone: phone } })];
                    case 1:
                        user = (_a.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        if (user.isPhoneVerified) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.ALREADY_VERIFIED, 'Phone number is already verified');
                        }
                        return [2 /*return*/, this.resendVerificationSMSBySub(user.sub)];
                }
            });
        });
    };
    // ============================================================================
    // Helpers
    // ============================================================================
    /**
     * Generate N-digit OTP code (default 6)
     */
    PhoneVerificationService.prototype.generateCode = function () {
        var _a, _b;
        var codeLength = ((_b = (_a = this.config.signup) === null || _a === void 0 ? void 0 : _a.phoneVerification) === null || _b === void 0 ? void 0 : _b.codeLength) || 6;
        var min = Math.pow(10, codeLength - 1);
        var max = Math.pow(10, codeLength) - 1;
        return Math.floor(min + Math.random() * (max - min + 1)).toString();
    };
    /**
     * Generate secure random token
     */
    PhoneVerificationService.prototype.generateToken = function () {
        return crypto.randomBytes(32).toString('hex');
    };
    /**
     * Hash token with SHA-256
     */
    PhoneVerificationService.prototype.hashToken = function (token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    };
    /**
     * Mask phone number for logging (preserves last 4 digits)
     * @private
     */
    PhoneVerificationService.prototype.maskPhone = function (phone) {
        if (!phone || phone.length < 4)
            return '***';
        return "***".concat(phone.slice(-4));
    };
    return PhoneVerificationService;
}());
exports.PhoneVerificationService = PhoneVerificationService;
