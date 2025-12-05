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
exports.EmailVerificationService = void 0;
var typeorm_1 = require("typeorm");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var verify_email_dto_1 = require("../dto/verify-email.dto");
var crypto = require("crypto");
/**
 * Email Verification Service
 *
 * Handles email verification workflow:
 * - Generate verification codes
 * - Send verification emails
 * - Verify codes with token generation
 * - Resend with rate limiting
 *
 * Supports both code-based (6-digit OTP) and link-based verification.
 */
var EmailVerificationService = /** @class */ (function () {
    function EmailVerificationService(verificationTokenRepo, userRepo, emailProvider, storageAdapter, config, clientInfoService, logger, auditService) {
        this.verificationTokenRepo = verificationTokenRepo;
        this.userRepo = userRepo;
        this.emailProvider = emailProvider;
        this.storageAdapter = storageAdapter;
        this.config = config;
        this.clientInfoService = clientInfoService;
        this.logger = logger;
        this.auditService = auditService;
    }
    /**
     * Send verification email to user
     * Generates a new verification code and sends it via email
     *
     * @param dto - Request DTO containing sub, baseUrl, and skipAlreadyVerifiedCheck
     * @returns Response DTO with verification token ID
     */
    EmailVerificationService.prototype.sendVerificationEmail = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var sub, baseUrl, _a, skipAlreadyVerifiedCheck, rateLimitMax, rateLimitWindow, rateLimitKey, ttlBefore, isWindowExpired, currentCount, actualTtl, user, resendDelay, lastToken, secondsSinceLastSend, waitSeconds, code, token, tokenHash, clientInfo, ipAddress, userAgent, verificationToken, verificationLink, auditError_1, errorMessage;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            return __generator(this, function (_r) {
                switch (_r.label) {
                    case 0:
                        sub = dto.sub, baseUrl = dto.baseUrl, _a = dto.skipAlreadyVerifiedCheck, skipAlreadyVerifiedCheck = _a === void 0 ? false : _a;
                        rateLimitMax = ((_c = (_b = this.config.signup) === null || _b === void 0 ? void 0 : _b.emailVerification) === null || _c === void 0 ? void 0 : _c.rateLimitMax) || 3;
                        rateLimitWindow = ((_e = (_d = this.config.signup) === null || _d === void 0 ? void 0 : _d.emailVerification) === null || _e === void 0 ? void 0 : _e.rateLimitWindow) || 3600;
                        rateLimitKey = "email-verification:".concat(sub);
                        return [4 /*yield*/, this.storageAdapter.ttl(rateLimitKey)];
                    case 1:
                        ttlBefore = _r.sent();
                        isWindowExpired = ttlBefore === -1 || ttlBefore < 0 || ttlBefore > rateLimitWindow;
                        if (!(ttlBefore > rateLimitWindow)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.storageAdapter.del(rateLimitKey)];
                    case 2:
                        _r.sent();
                        _r.label = 3;
                    case 3: return [4 /*yield*/, this.storageAdapter.incr(rateLimitKey, isWindowExpired ? rateLimitWindow : undefined)];
                    case 4:
                        currentCount = _r.sent();
                        // If we created a new window, log it
                        if (isWindowExpired && currentCount === 1) {
                            (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "Rate limit window reset for email verification: sub=".concat(sub, ", window=").concat(rateLimitWindow, "s, max=").concat(rateLimitMax));
                        }
                        return [4 /*yield*/, this.storageAdapter.ttl(rateLimitKey)];
                    case 5:
                        actualTtl = _r.sent();
                        if (currentCount > rateLimitMax) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_EMAIL, 'Too many verification emails sent. Please try again later.', {
                                retryAfter: actualTtl > 0 ? actualTtl : rateLimitWindow,
                                currentCount: currentCount,
                                maxAttempts: rateLimitMax,
                            });
                        }
                        return [4 /*yield*/, this.userRepo.findOne({ where: { sub: sub } })];
                    case 6:
                        user = (_r.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        resendDelay = (_k = (_j = (_h = this.config.signup) === null || _h === void 0 ? void 0 : _h.emailVerification) === null || _j === void 0 ? void 0 : _j.resendDelay) !== null && _k !== void 0 ? _k : 60;
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: { userId: user.id, type: 'email' },
                                order: { createdAt: 'DESC' },
                            })];
                    case 7:
                        lastToken = (_r.sent());
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
                        // Only check "already verified" if not skipping (skip for MFA contexts where codes are needed even if email is verified)
                        if (!skipAlreadyVerifiedCheck && user.isEmailVerified) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.ALREADY_VERIFIED, 'Email already verified');
                        }
                        // Invalidate existing tokens - use internal id for database query
                        return [4 /*yield*/, this.verificationTokenRepo.update({
                                userId: user.id, // Use internal id for foreign key query
                                type: 'email',
                                usedAt: (0, typeorm_1.IsNull)(), // Only invalidate unused tokens
                            }, {
                                usedAt: new Date(), // Mark as used to invalidate
                            })];
                    case 8:
                        // Invalidate existing tokens - use internal id for database query
                        _r.sent();
                        code = this.generateCode();
                        token = this.generateToken();
                        tokenHash = this.hashToken(token);
                        clientInfo = this.clientInfoService.get();
                        ipAddress = clientInfo.ipAddress;
                        userAgent = clientInfo.userAgent;
                        verificationToken = this.verificationTokenRepo.create({
                            userId: user.id, // Use internal id for foreign key
                            type: 'email',
                            token: tokenHash,
                            code: code,
                            expiresAt: new Date(Date.now() + (((_m = (_l = this.config.signup) === null || _l === void 0 ? void 0 : _l.emailVerification) === null || _m === void 0 ? void 0 : _m.expiresIn) || 3600) * 1000), // Default: 1 hour
                            attempts: 0,
                            ipAddress: ipAddress,
                            userAgent: userAgent,
                        });
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 9:
                        _r.sent();
                        verificationLink = baseUrl ? "".concat(baseUrl, "/verify-email?token=").concat(token) : undefined;
                        // Send email (link is optional - only sent if provided)
                        return [4 /*yield*/, this.emailProvider.sendVerificationEmail(user.email, code, verificationLink)];
                    case 10:
                        // Send email (link is optional - only sent if provided)
                        _r.sent();
                        _r.label = 11;
                    case 11:
                        _r.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, ((_o = this.auditService) === null || _o === void 0 ? void 0 : _o.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.EMAIL_VERIFICATION_REQUESTED,
                                eventStatus: 'INFO',
                                metadata: {
                                    verificationTokenId: verificationToken.id,
                                },
                                // Client info automatically included from context
                            }))];
                    case 12:
                        _r.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        auditError_1 = _r.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_q = (_p = this.logger) === null || _p === void 0 ? void 0 : _p.error) === null || _q === void 0 ? void 0 : _q.call(_p, "Failed to record EMAIL_VERIFICATION_REQUESTED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                        });
                        return [3 /*break*/, 14];
                    case 14: return [2 /*return*/, { tokenId: verificationToken.id }];
                }
            });
        });
    };
    /**
     * Verify email with code (6-digit OTP)
     * Marks email as verified and activates user account
     *
     * @param dto - Request DTO containing email and code
     * @returns Response DTO with success message
     */
    EmailVerificationService.prototype.verifyEmailWithCode = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var email, code, maxAttemptsPerIP, attemptWindow, clientInfo, user, verificationToken, incrementIPRateLimit, isExpired, maxAttemptsExceeded, maxAttemptsPerUser, incrementUserRateLimit, auditError_2, errorMessage, auditError_3, errorMessage;
            var _this = this;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            return __generator(this, function (_r) {
                switch (_r.label) {
                    case 0:
                        email = dto.email, code = dto.code;
                        maxAttemptsPerIP = (_c = (_b = (_a = this.config.signup) === null || _a === void 0 ? void 0 : _a.emailVerification) === null || _b === void 0 ? void 0 : _b.maxAttemptsPerIP) !== null && _c !== void 0 ? _c : 20;
                        attemptWindow = (_f = (_e = (_d = this.config.signup) === null || _d === void 0 ? void 0 : _d.emailVerification) === null || _e === void 0 ? void 0 : _e.attemptWindow) !== null && _f !== void 0 ? _f : 3600;
                        clientInfo = this.clientInfoService.get();
                        return [4 /*yield*/, this.userRepo.findOne({ where: { email: email } })];
                    case 1:
                        user = _r.sent();
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: {
                                    userId: user.id,
                                    type: 'email',
                                    code: code,
                                    usedAt: (0, typeorm_1.IsNull)(),
                                },
                            })];
                    case 2:
                        verificationToken = (_r.sent());
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
                        // Invalid attempt - increment IP rate limit
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 3:
                        // Invalid attempt - increment IP rate limit
                        _r.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification code');
                    case 4:
                        isExpired = verificationToken.isExpired
                            ? verificationToken.isExpired()
                            : verificationToken.expiresAt < new Date();
                        if (!isExpired) return [3 /*break*/, 6];
                        // Expired token - increment IP rate limit
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 5:
                        // Expired token - increment IP rate limit
                        _r.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification code has expired');
                    case 6:
                        maxAttemptsExceeded = verificationToken.maxAttemptsExceeded
                            ? verificationToken.maxAttemptsExceeded(3)
                            : verificationToken.attempts >= 3;
                        if (!maxAttemptsExceeded) return [3 /*break*/, 8];
                        // Token exceeded max attempts - increment IP rate limit
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 7:
                        // Token exceeded max attempts - increment IP rate limit
                        _r.sent();
                        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS, 'Too many failed attempts. Request a new code.');
                    case 8:
                        maxAttemptsPerUser = (_j = (_h = (_g = this.config.signup) === null || _g === void 0 ? void 0 : _g.emailVerification) === null || _h === void 0 ? void 0 : _h.maxAttemptsPerUser) !== null && _j !== void 0 ? _j : 10;
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
                        // Increment attempts (even on success to prevent reuse)
                        verificationToken.attempts += 1;
                        if (!(verificationToken.code !== code)) return [3 /*break*/, 16];
                        // Invalid code - increment both IP and user rate limits
                        return [4 /*yield*/, incrementIPRateLimit()];
                    case 9:
                        // Invalid code - increment both IP and user rate limits
                        _r.sent();
                        return [4 /*yield*/, incrementUserRateLimit()];
                    case 10:
                        _r.sent();
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 11:
                        _r.sent();
                        _r.label = 12;
                    case 12:
                        _r.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, ((_k = this.auditService) === null || _k === void 0 ? void 0 : _k.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.EMAIL_VERIFICATION_FAILED,
                                eventStatus: 'FAILURE',
                                reason: 'invalid_code',
                                description: 'Invalid verification code provided',
                                // Client info automatically included from context
                                metadata: {
                                    verificationTokenId: verificationToken.id,
                                    attempts: verificationToken.attempts,
                                },
                            }))];
                    case 13:
                        _r.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        auditError_2 = _r.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.error) === null || _m === void 0 ? void 0 : _m.call(_l, "Failed to record EMAIL_VERIFICATION_FAILED audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: user.id,
                        });
                        return [3 /*break*/, 15];
                    case 15: throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid verification code');
                    case 16:
                        // ============================================================================
                        // Code is valid - proceed without rate limit checks
                        // Valid codes should always be allowed through
                        // ============================================================================
                        // Mark token as used
                        verificationToken.usedAt = new Date();
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 17:
                        _r.sent();
                        // Update user - use internal id for database update
                        return [4 /*yield*/, this.userRepo.update(user.id, {
                                isEmailVerified: true,
                                // Auto-activate if not already active
                                isActive: true,
                            })];
                    case 18:
                        // Update user - use internal id for database update
                        _r.sent();
                        _r.label = 19;
                    case 19:
                        _r.trys.push([19, 21, , 22]);
                        return [4 /*yield*/, ((_o = this.auditService) === null || _o === void 0 ? void 0 : _o.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.EMAIL_VERIFIED,
                                eventStatus: 'SUCCESS',
                                metadata: {
                                    verificationTokenId: verificationToken.id,
                                    verificationMethod: 'code',
                                    // Client info automatically included from context
                                },
                            }))];
                    case 20:
                        _r.sent();
                        return [3 /*break*/, 22];
                    case 21:
                        auditError_3 = _r.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_q = (_p = this.logger) === null || _p === void 0 ? void 0 : _p.error) === null || _q === void 0 ? void 0 : _q.call(_p, "Failed to record EMAIL_VERIFIED audit event: ".concat(errorMessage), {
                            error: auditError_3,
                            userId: user.id,
                        });
                        return [3 /*break*/, 22];
                    case 22: 
                    // TODO: maybe refactor to return user save user query in parent function
                    return [2 /*return*/, {
                            message: 'Email verified successfully. Please log in to continue.',
                        }];
                }
            });
        });
    };
    /**
     * Verify email with link token
     * Marks email as verified and activates user account
     *
     * @param dto - Request DTO containing token
     * @returns Response DTO with success message
     */
    EmailVerificationService.prototype.verifyEmailWithToken = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            var token, tokenHash, verificationToken, isExpired, user, auditError_4, errorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        token = dto.token;
                        tokenHash = this.hashToken(token);
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: {
                                    token: tokenHash,
                                    type: 'email',
                                    usedAt: (0, typeorm_1.IsNull)(),
                                },
                            })];
                    case 1:
                        verificationToken = (_d.sent());
                        if (!verificationToken) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid or expired verification link');
                        }
                        isExpired = verificationToken.isExpired
                            ? verificationToken.isExpired()
                            : verificationToken.expiresAt < new Date();
                        if (isExpired) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Verification link has expired');
                        }
                        // Mark token as used
                        verificationToken.usedAt = new Date();
                        return [4 /*yield*/, this.verificationTokenRepo.save(verificationToken)];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, this.userRepo.findOne({
                                where: { id: verificationToken.userId },
                            })];
                    case 3:
                        user = (_d.sent());
                        // Update user
                        return [4 /*yield*/, this.userRepo.update(verificationToken.userId, {
                                isEmailVerified: true,
                                // Auto-activate if not already active
                                isActive: true,
                            })];
                    case 4:
                        // Update user
                        _d.sent();
                        if (!user) return [3 /*break*/, 8];
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.EMAIL_VERIFIED,
                                eventStatus: 'SUCCESS',
                                metadata: {
                                    verificationTokenId: verificationToken.id,
                                    verificationMethod: 'token',
                                    // Client info automatically included from context
                                },
                            }))];
                    case 6:
                        _d.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        auditError_4 = _d.sent();
                        errorMessage = auditError_4 instanceof Error ? auditError_4.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record EMAIL_VERIFIED audit event (token-based): ".concat(errorMessage), {
                            error: auditError_4,
                            userId: user === null || user === void 0 ? void 0 : user.id,
                        });
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, {
                            message: 'Email verified successfully. Please log in to continue.',
                        }];
                }
            });
        });
    };
    /**
     * Resend verification email
     * Supports both sub and email-based resend
     *
     * @param dto - Request DTO containing sub or email, and optional baseUrl
     * @returns Response DTO with verification token ID
     */
    EmailVerificationService.prototype.resendVerificationEmail = function (dto) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Validate that either sub or email is provided
                if (!dto.sub && !dto.email) {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, 'Either sub or email must be provided');
                }
                if (dto.sub) {
                    return [2 /*return*/, this.resendVerificationEmailBySub(dto.sub, dto.baseUrl)];
                }
                return [2 /*return*/, this.resendVerificationEmailByEmail(dto.email, dto.baseUrl)];
            });
        });
    };
    EmailVerificationService.prototype.resendVerificationEmailBySub = function (sub, baseUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var user, lastToken, secondsSinceLastSend, waitSeconds, dto;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepo.findOne({ where: { sub: sub } })];
                    case 1:
                        user = _a.sent();
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [4 /*yield*/, this.verificationTokenRepo.findOne({
                                where: { userId: user.id, type: 'email' },
                                order: { createdAt: 'DESC' },
                            })];
                    case 2:
                        lastToken = (_a.sent());
                        if (lastToken) {
                            secondsSinceLastSend = (Date.now() - lastToken.createdAt.getTime()) / 1000;
                            if (secondsSinceLastSend < 60) {
                                waitSeconds = Math.ceil(60 - secondsSinceLastSend);
                                throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.RATE_LIMIT_RESEND, "Please wait ".concat(waitSeconds, " seconds before requesting another code"), {
                                    retryAfter: waitSeconds,
                                    resendDelay: 60,
                                });
                            }
                        }
                        dto = Object.assign(new verify_email_dto_1.SendVerificationEmailDTO(), { sub: sub, baseUrl: baseUrl });
                        return [2 /*return*/, this.sendVerificationEmail(dto)];
                }
            });
        });
    };
    EmailVerificationService.prototype.resendVerificationEmailByEmail = function (email, baseUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.userRepo.findOne({ where: { email: email } })];
                    case 1:
                        user = (_a.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        return [2 /*return*/, this.resendVerificationEmailBySub(user.sub, baseUrl)];
                }
            });
        });
    };
    /**
     * Generate 6-digit verification code
     * @returns 6-digit numeric code
     */
    EmailVerificationService.prototype.generateCode = function () {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };
    /**
     * Generate secure random token
     * @returns Random token (32 bytes, hex encoded)
     */
    EmailVerificationService.prototype.generateToken = function () {
        return crypto.randomBytes(32).toString('hex');
    };
    /**
     * Hash token with SHA-256
     * @param token - Plain token
     * @returns Hashed token
     */
    EmailVerificationService.prototype.hashToken = function (token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    };
    return EmailVerificationService;
}());
exports.EmailVerificationService = EmailVerificationService;
