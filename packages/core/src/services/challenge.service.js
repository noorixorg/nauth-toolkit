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
exports.ChallengeService = void 0;
var typeorm_1 = require("typeorm");
var crypto_1 = require("crypto");
var auth_challenge_dto_1 = require("../dto/auth-challenge.dto");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
/**
 * Challenge Session Service
 *
 * Manages authentication challenge sessions for the challenge-response flow.
 * Challenge sessions are temporary, short-lived sessions (typically 15 minutes)
 * that track pending authentication challenges similar to AWS Cognito.
 *
 * Handles:
 * - Challenge session creation and validation
 * - Session expiration and cleanup
 * - Attempt tracking and rate limiting
 * - Secure session token generation
 *
 * @example
 * ```typescript
 * // Create a challenge session
 * const session = await challengeService.createChallengeSession(
 *   user,
 *   AuthChallenge.VERIFY_EMAIL,
 *   { email: user.email }
 * );
 *
 * // Validate and consume a challenge session
 * const validSession = await challengeService.validateAndConsumeSession(
 *   sessionToken,
 *   AuthChallenge.VERIFY_EMAIL
 * );
 * ```
 */
var ChallengeService = /** @class */ (function () {
    function ChallengeService(challengeSessionRepository, clientInfoService, logger, auditService) {
        this.challengeSessionRepository = challengeSessionRepository;
        this.clientInfoService = clientInfoService;
        this.logger = logger;
        this.auditService = auditService;
        /**
         * Default challenge session expiration time (15 minutes)
         */
        this.DEFAULT_EXPIRATION_MINUTES = 15;
        /**
         * Default maximum attempts per challenge session
         */
        this.DEFAULT_MAX_ATTEMPTS = 3;
        /**
         * Per-user cleanup throttle map to avoid frequent cleanup writes
         */
        this.lastCleanupByUserId = new Map();
    }
    // ============================================================================
    // Challenge Session Creation
    // ============================================================================
    /**
     * Create a new challenge session
     *
     * Generates a unique session token and stores challenge metadata.
     * The session token is returned to the client and must be submitted
     * when responding to the challenge.
     *
     * **Deduplication:**
     * If an active (non-completed, non-expired) session already exists for the same user
     * and challenge type, this method returns the existing session instead of creating
     * a duplicate. This prevents:
     * - Excessive `CHALLENGE_CREATED` audit events
     * - Database bloat from duplicate sessions
     * - User confusion from multiple active sessions for the same challenge
     *
     * @param user - User the challenge session belongs to
     * @param challengeName - Type of challenge (VERIFY_EMAIL, VERIFY_PHONE, etc.)
     * @param metadata - Challenge-specific data
     * @returns Challenge session with session token (new or existing)
     * @remarks Client info (ipAddress, userAgent) is automatically extracted from ClientInfoService context
     *
     * @example
     * ```typescript
     * const session = await challengeService.createChallengeSession(
     *   user,
     *   AuthChallenge.VERIFY_EMAIL,
     *   { email: user.email, verificationTokenId: tokenId }
     * );
     * // Returns: { sessionToken: 'uuid-here', expiresAt: Date, ... }
     * // If called again before completion, returns same session (no duplicate audit event)
     * ```
     */
    ChallengeService.prototype.createChallengeSession = function (user, challengeName, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, existingSession, session, now, lastCleanup, sessionToken, expiresAt, challengeSession, auditError_1, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        return [4 /*yield*/, this.challengeSessionRepository.findOne({
                                where: {
                                    userId: user.id,
                                    challengeName: challengeName,
                                    isCompleted: false,
                                },
                                order: { createdAt: 'DESC' },
                                relations: ['user'],
                            })];
                    case 1:
                        existingSession = _k.sent();
                        if (!existingSession) return [3 /*break*/, 3];
                        session = existingSession;
                        // Check if session is still valid (not expired)
                        if (session.expiresAt > new Date()) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "Reusing existing challenge session: user=".concat(user.sub, ", challenge=").concat(challengeName, ", session=").concat(session.sessionToken));
                            return [2 /*return*/, session];
                        }
                        // If expired, delete it and create a new one
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "Existing challenge session expired, creating new one: user=".concat(user.sub, ", challenge=").concat(challengeName));
                        return [4 /*yield*/, this.challengeSessionRepository.delete({ id: session.id })];
                    case 2:
                        _k.sent();
                        _k.label = 3;
                    case 3:
                        now = Date.now();
                        lastCleanup = this.lastCleanupByUserId.get(user.id) || 0;
                        if (!(now - lastCleanup > 5 * 60 * 1000)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.cleanupExpiredSessions(user.id)];
                    case 4:
                        _k.sent();
                        this.lastCleanupByUserId.set(user.id, now);
                        _k.label = 5;
                    case 5:
                        sessionToken = (0, crypto_1.randomUUID)();
                        expiresAt = new Date(Date.now() + this.DEFAULT_EXPIRATION_MINUTES * 60 * 1000);
                        challengeSession = this.challengeSessionRepository.create({
                            userId: user.id,
                            challengeName: challengeName,
                            sessionToken: sessionToken,
                            expiresAt: expiresAt,
                            metadata: metadata,
                            // Client info automatically extracted from ClientInfoService (transparent access)
                            ipAddress: clientInfo.ipAddress || null,
                            userAgent: clientInfo.userAgent || null,
                            maxAttempts: this.DEFAULT_MAX_ATTEMPTS,
                        });
                        return [4 /*yield*/, this.challengeSessionRepository.save(challengeSession)];
                    case 6:
                        _k.sent();
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.log) === null || _f === void 0 ? void 0 : _f.call(_e, "Challenge session created: user=".concat(user.sub, ", challenge=").concat(challengeName));
                        _k.label = 7;
                    case 7:
                        _k.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, ((_g = this.auditService) === null || _g === void 0 ? void 0 : _g.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.CHALLENGE_CREATED,
                                eventStatus: 'INFO',
                                challengeSessionId: challengeSession.id,
                                // Client info automatically included from context (no need to pass explicitly)
                                metadata: {
                                    challengeName: challengeName,
                                    sessionToken: challengeSession.sessionToken,
                                },
                            }))];
                    case 8:
                        _k.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        auditError_1 = _k.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_j = (_h = this.logger) === null || _h === void 0 ? void 0 : _h.error) === null || _j === void 0 ? void 0 : _j.call(_h, "Failed to record CHALLENGE_CREATED audit event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: user.id,
                            challengeName: challengeName,
                        });
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, challengeSession];
                }
            });
        });
    };
    // ============================================================================
    // Challenge Session Validation
    // ============================================================================
    /**
     * Validate a challenge session token for code requests
     *
     * Validates session for requesting new verification codes (SMS, email, etc.).
     * Skips max attempts check since requesting a new code is not a verification attempt.
     * This method is used internally by nauth when sending verification codes.
     *
     * @param sessionToken - Session token to validate
     * @param expectedChallenge - Expected challenge type (optional, for additional verification)
     * @returns Valid challenge session
     * @throws {UnauthorizedException} If session is invalid, expired, or already completed
     *
     * @example
     * ```typescript
     * // Used internally by nauth when sending verification codes
     * const session = await challengeService.validateSessionForCodeRequest(
     *   'session-token-123',
     *   AuthChallenge.MFA_REQUIRED
     * );
     * ```
     */
    ChallengeService.prototype.validateSessionForCodeRequest = function (sessionToken, expectedChallenge) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.validateSessionInternal(sessionToken, expectedChallenge, true)];
            });
        });
    };
    /**
     * Validate a challenge session token
     *
     * Checks if the session token is valid, not expired, not completed,
     * and matches the expected challenge type. Does NOT consume the session.
     * Enforces max attempts check for verification attempts.
     *
     * @param sessionToken - Session token to validate
     * @param expectedChallenge - Expected challenge type (optional, for additional verification)
     * @returns Valid challenge session
     * @throws {UnauthorizedException} If session is invalid, expired, or already completed
     *
     * @example
     * ```typescript
     * try {
     *   const session = await challengeService.validateSession(
     *     'session-token-123',
     *     AuthChallenge.VERIFY_EMAIL
     *   );
     *   // Session is valid, proceed with verification
     * } catch (error) {
     *   // Session is invalid
     * }
     * ```
     */
    ChallengeService.prototype.validateSession = function (sessionToken, expectedChallenge) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.validateSessionInternal(sessionToken, expectedChallenge, false)];
            });
        });
    };
    /**
     * Internal method to validate challenge session
     *
     * @param sessionToken - Session token to validate
     * @param expectedChallenge - Expected challenge type (optional)
     * @param skipMaxAttemptsCheck - If true, skip max attempts check (for code requests)
     * @returns Valid challenge session
     * @private
     */
    ChallengeService.prototype.validateSessionInternal = function (sessionToken_1, expectedChallenge_1) {
        return __awaiter(this, arguments, void 0, function (sessionToken, expectedChallenge, skipMaxAttemptsCheck) {
            var session, challengeSession;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            if (skipMaxAttemptsCheck === void 0) { skipMaxAttemptsCheck = false; }
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0: return [4 /*yield*/, this.challengeSessionRepository.findOne({
                            where: { sessionToken: sessionToken },
                            relations: ['user'],
                        })];
                    case 1:
                        session = _p.sent();
                        if (!session) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, 'Invalid challenge session token');
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'Invalid or expired challenge session');
                        }
                        challengeSession = session;
                        if (challengeSession.expiresAt < new Date()) {
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Expired challenge session: user=".concat((_e = challengeSession.user) === null || _e === void 0 ? void 0 : _e.sub));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_EXPIRED, 'Challenge session has expired');
                        }
                        // Check if already completed
                        if (session.isCompleted) {
                            (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.warn) === null || _g === void 0 ? void 0 : _g.call(_f, "Already completed challenge session: user=".concat((_h = challengeSession.user) === null || _h === void 0 ? void 0 : _h.sub));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_ALREADY_COMPLETED, 'Challenge has already been completed');
                        }
                        // Check max attempts (skip if requesting new code, but enforce for verification attempts)
                        if (!skipMaxAttemptsCheck && challengeSession.attempts >= challengeSession.maxAttempts) {
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.warn) === null || _k === void 0 ? void 0 : _k.call(_j, "Max attempts exceeded for challenge session: user=".concat((_l = challengeSession.user) === null || _l === void 0 ? void 0 : _l.sub));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_MAX_ATTEMPTS, 'Maximum challenge attempts exceeded. Please request a new challenge.');
                        }
                        // Verify challenge type if specified
                        if (expectedChallenge && session.challengeName !== expectedChallenge) {
                            (_o = (_m = this.logger) === null || _m === void 0 ? void 0 : _m.warn) === null || _o === void 0 ? void 0 : _o.call(_m, "Challenge type mismatch: expected=".concat(expectedChallenge, ", actual=").concat(session.challengeName));
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_TYPE_MISMATCH, 'Invalid challenge type');
                        }
                        return [2 /*return*/, session];
                }
            });
        });
    };
    /**
     * Increment attempt counter for a challenge session
     *
     * Tracks failed attempts to complete a challenge.
     * Used to prevent brute-force attacks on verification codes.
     *
     * @param session - Challenge session to increment
     * @returns Updated session
     *
     * @example
     * ```typescript
     * await challengeService.incrementAttempts(session);
     * ```
     */
    ChallengeService.prototype.incrementAttempts = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            var user, auditError_2, errorMessage, sessionUser;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        session.attempts += 1;
                        return [4 /*yield*/, this.challengeSessionRepository.save(session)];
                    case 1:
                        _d.sent();
                        if (!(session.attempts >= session.maxAttempts)) return [3 /*break*/, 6];
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 5, , 6]);
                        user = session.user;
                        if (!user) return [3 /*break*/, 4];
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.CHALLENGE_ATTEMPT_FAILED,
                                eventStatus: 'FAILURE',
                                challengeSessionId: session.id,
                                // Override IP/userAgent with session values if available
                                ipAddress: session.ipAddress || undefined,
                                userAgent: session.userAgent || undefined,
                                reason: 'max_attempts_exceeded',
                                // Client info automatically included from context
                                description: "Challenge attempt failed - maximum attempts (".concat(session.maxAttempts, ") exceeded"),
                                metadata: {
                                    challengeName: session.challengeName,
                                    attempts: session.attempts,
                                    maxAttempts: session.maxAttempts,
                                },
                            }))];
                    case 3:
                        _d.sent();
                        _d.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        auditError_2 = _d.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        sessionUser = session.user;
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record CHALLENGE_ATTEMPT_FAILED audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id,
                            challengeName: session.challengeName,
                        });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, session];
                }
            });
        });
    };
    /**
     * Validate and consume a challenge session
     *
     * Validates the session and marks it as completed if validation succeeds.
     * This method should be called only after successful challenge completion.
     *
     * @param sessionToken - Session token to validate and consume
     * @param expectedChallenge - Expected challenge type
     * @returns Valid, completed challenge session with user
     * @throws {UnauthorizedException} If session is invalid
     *
     * @example
     * ```typescript
     * const session = await challengeService.validateAndConsumeSession(
     *   'session-token-123',
     *   AuthChallenge.VERIFY_EMAIL
     * );
     * // Session is now marked complete and cannot be reused
     * ```
     */
    ChallengeService.prototype.validateAndConsumeSession = function (sessionToken, expectedChallenge) {
        return __awaiter(this, void 0, void 0, function () {
            var session, user, auditMetadata, auditError_3, errorMessage;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.validateSession(sessionToken, expectedChallenge)];
                    case 1:
                        session = _g.sent();
                        // Mark session as completed
                        session.isCompleted = true;
                        session.completedAt = new Date();
                        return [4 /*yield*/, this.challengeSessionRepository.save(session)];
                    case 2:
                        _g.sent();
                        user = session.user;
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found in challenge session');
                        }
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Challenge session completed: user=".concat(user.sub, ", challenge=").concat(session.challengeName));
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 5, , 6]);
                        auditMetadata = {
                            // Client info automatically included from context
                            challengeName: session.challengeName,
                        };
                        // For MFA challenges, include the MFA method used
                        if (session.challengeName === auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED && ((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.mfaMethod)) {
                            auditMetadata.mfaMethod = session.metadata.mfaMethod;
                        }
                        return [4 /*yield*/, ((_d = this.auditService) === null || _d === void 0 ? void 0 : _d.recordEvent({
                                userId: user.id,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.CHALLENGE_COMPLETED,
                                eventStatus: 'SUCCESS',
                                challengeSessionId: session.id,
                                // Override IP/userAgent with session values if available
                                ipAddress: session.ipAddress || undefined,
                                userAgent: session.userAgent || undefined,
                                metadata: auditMetadata,
                            }))];
                    case 4:
                        _g.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_3 = _g.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.call(_e, "Failed to record CHALLENGE_COMPLETED audit event: ".concat(errorMessage), {
                            error: auditError_3,
                            userId: user.id,
                            challengeName: session.challengeName,
                        });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, session];
                }
            });
        });
    };
    /**
     * Update challenge session metadata
     *
     * Updates the metadata field of an existing challenge session.
     * Used to store additional challenge-specific data (e.g., passkey challenge).
     *
     * @param sessionToken - Session token to update
     * @param metadata - Metadata to merge into existing metadata
     * @returns Updated challenge session
     * @throws {NAuthException} If session not found or invalid
     *
     * @example
     * ```typescript
     * await challengeService.updateMetadata('session-token-123', {
     *   passkeyChallenge: 'base64-challenge-string'
     * });
     * ```
     */
    ChallengeService.prototype.updateMetadata = function (sessionToken, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var session, existingMetadata, updatedMetadata, updatedSession;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.validateSession(sessionToken)];
                    case 1:
                        session = _a.sent();
                        existingMetadata = session.metadata || {};
                        updatedMetadata = __assign(__assign({}, existingMetadata), metadata);
                        // Update session metadata
                        return [4 /*yield*/, this.challengeSessionRepository.update({ sessionToken: sessionToken }, { metadata: updatedMetadata })];
                    case 2:
                        // Update session metadata
                        _a.sent();
                        return [4 /*yield*/, this.challengeSessionRepository.findOne({
                                where: { sessionToken: sessionToken },
                                relations: ['user'],
                            })];
                    case 3:
                        updatedSession = _a.sent();
                        if (!updatedSession) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.CHALLENGE_INVALID, 'Failed to update challenge session metadata');
                        }
                        return [2 /*return*/, updatedSession];
                }
            });
        });
    };
    // ============================================================================
    // Challenge Session Cleanup
    // ============================================================================
    /**
     * Clean up expired or completed challenge sessions for a user
     *
     * Removes old sessions to prevent database bloat.
     * Called automatically when creating new challenge sessions.
     *
     * @param userId - User ID to clean up sessions for
     *
     * @example
     * ```typescript
     * await challengeService.cleanupExpiredSessions(user.id);
     * ```
     */
    ChallengeService.prototype.cleanupExpiredSessions = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.challengeSessionRepository.delete({
                            userId: userId,
                            expiresAt: (0, typeorm_1.LessThan)(new Date()),
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.challengeSessionRepository.delete({
                                userId: userId,
                                isCompleted: true,
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clean up all expired challenge sessions (for all users)
     *
     * Should be called periodically (e.g., via cron job) to maintain
     * database health.
     *
     * @returns Number of sessions deleted
     *
     * @example
     * ```typescript
     * // In a scheduled job
     * const deleted = await challengeService.cleanupAllExpiredSessions();
     * logger.log(`Cleaned up ${deleted} expired challenge sessions`);
     * ```
     */
    ChallengeService.prototype.cleanupAllExpiredSessions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, deletedCount;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.challengeSessionRepository.delete({
                            expiresAt: (0, typeorm_1.LessThan)(new Date()),
                        })];
                    case 1:
                        result = _c.sent();
                        deletedCount = result.affected || 0;
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Cleaned up ".concat(deletedCount, " expired challenge sessions"));
                        return [2 /*return*/, deletedCount];
                }
            });
        });
    };
    /**
     * Delete challenge sessions by challenge name for a user
     *
     * Removes all active (not completed, not expired) challenge sessions
     * of the specified type for a user. Used to clean up phantom challenges
     * when user completes the requirement (e.g., sets up MFA).
     *
     * @param userId - Internal user ID
     * @param challengeName - Challenge type to delete
     * @returns Number of sessions deleted
     *
     * @example
     * ```typescript
     * // Clear MFA_SETUP_REQUIRED challenge when user sets up MFA
     * const deleted = await challengeService.deleteUserChallengeSessions(
     *   user.id,
     *   AuthChallenge.MFA_SETUP_REQUIRED
     * );
     * ```
     */
    ChallengeService.prototype.deleteUserChallengeSessions = function (userId, challengeName) {
        return __awaiter(this, void 0, void 0, function () {
            var result, deletedCount;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.challengeSessionRepository.delete({
                            userId: userId,
                            challengeName: challengeName,
                            isCompleted: false,
                        })];
                    case 1:
                        result = _c.sent();
                        deletedCount = result.affected || 0;
                        if (deletedCount > 0) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.log) === null || _b === void 0 ? void 0 : _b.call(_a, "Deleted ".concat(deletedCount, " ").concat(challengeName, " challenge session(s) for user ID ").concat(userId));
                        }
                        return [2 /*return*/, deletedCount];
                }
            });
        });
    };
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Mask email address for display in challenge parameters
     *
     * Shows first character and domain, hides the rest.
     *
     * @param email - Email to mask
     * @returns Masked email
     *
     * @example
     * ```typescript
     * maskEmail('john.doe@example.com')
     * // Returns: 'j***@example.com'
     * ```
     */
    ChallengeService.prototype.maskEmail = function (email) {
        var _a = email.split('@'), localPart = _a[0], domain = _a[1];
        if (!domain)
            return email;
        return "".concat(localPart[0], "***@").concat(domain);
    };
    /**
     * Mask phone number for display in challenge parameters
     *
     * Shows last 4 digits, hides the rest.
     *
     * @param phone - Phone to mask
     * @returns Masked phone
     *
     * @example
     * ```typescript
     * maskPhone('+1234567890')
     * // Returns: '***-***-7890'
     * ```
     */
    ChallengeService.prototype.maskPhone = function (phone) {
        var digits = phone.replace(/\D/g, '');
        if (digits.length < 4)
            return phone;
        return "***-***-".concat(digits.slice(-4));
    };
    return ChallengeService;
}());
exports.ChallengeService = ChallengeService;
