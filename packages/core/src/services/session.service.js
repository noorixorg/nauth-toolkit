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
exports.SessionService = void 0;
var typeorm_1 = require("typeorm");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
/**
 * Session Service
 *
 * Manages user sessions and device tracking including:
 * - Creating new sessions with device information
 * - Finding sessions by ID or refresh token
 * - Updating session activity and tokens (rotation)
 * - Revoking individual or all user sessions
 * - Token family management for reuse detection
 * - Token reuse detection with storage tracking
 * - Cleanup of expired sessions
 *
 * Security Features:
 * - Token family tracking for reuse detection
 * - Used refresh token tracking (prevents reuse attacks)
 * - Session expiration management
 * - Device fingerprinting support
 * - Revocation with reason tracking
 * - Activity timestamp updates
 *
 * @example
 * ```typescript
 * // Create session
 * const session = await sessionService.createSession({
 *   userId: user.id, // Internal ID (integer)
 *   accessTokenHash: 'hash1',
 *   refreshTokenHash: 'hash2',
 *   tokenFamily: 'family-abc',
 *   // Client info (ipAddress, userAgent, etc.) automatically extracted from ClientInfoService
 *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
 * });
 *
 * // Revoke all user sessions (global signout)
 * const revokedCount = await sessionService.revokeAllUserSessions(
 *   user.id, // Internal ID (integer)
 *   'User requested global signout'
 * );
 * ```
 */
var SessionService = /** @class */ (function () {
    function SessionService(sessionRepository, storageAdapter, clientInfoService, config, logger, auditService) {
        this.sessionRepository = sessionRepository;
        this.storageAdapter = storageAdapter;
        this.clientInfoService = clientInfoService;
        this.config = config;
        this.logger = logger;
        this.auditService = auditService;
    }
    /**
     * Calculate session expiration date from config
     *
     * Parses session.maxLifetime config (e.g., '30d', '7d', '5h') and returns
     * the expiration Date. Defaults to 30 days if not configured.
     *
     * @returns Session expiration date
     */
    SessionService.prototype.getSessionExpirationDate = function () {
        var _a;
        var maxLifetime = ((_a = this.config.session) === null || _a === void 0 ? void 0 : _a.maxLifetime) || '30d';
        var expiresInSeconds = this.parseMaxLifetime(maxLifetime);
        return new Date(Date.now() + expiresInSeconds * 1000);
    };
    /**
     * Parse maxLifetime from string or number
     *
     * @param maxLifetime - Max lifetime (e.g., '30d', '7d', '5h', 2592000)
     * @returns Max lifetime in seconds
     * @private
     */
    SessionService.prototype.parseMaxLifetime = function (maxLifetime) {
        var _a, _b;
        if (typeof maxLifetime === 'number') {
            return maxLifetime;
        }
        // Parse time strings (e.g., '15m', '1h', '30d')
        var units = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };
        var match = maxLifetime.match(/^(\d+)([smhd])$/);
        if (!match) {
            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Invalid session.maxLifetime format: ".concat(maxLifetime, ". Using default 30 days."));
            return 30 * 86400; // Default to 30 days in seconds
        }
        var value = match[1], unit = match[2];
        return parseInt(value, 10) * units[unit];
    };
    /**
     * Create a new session
     *
     * Creates a session record with token hashes, device information,
     * and expiration time. Used during login and signup.
     *
     * @param data - Session creation data
     * @param data.userId - Internal user ID (integer, not sub)
     * @param data.accessTokenHash - SHA-256 hash of access token
     * @param data.refreshTokenHash - SHA-256 hash of refresh token
     * @param data.tokenFamily - Token family ID for rotation detection
     * @param data.deviceId - Optional device identifier (UUID). Auto-generated if not provided.
     * @param data.deviceName - Optional device name. Falls back to parsed value from ClientInfoService if not provided.
     * @param data.deviceType - Optional device type (mobile, desktop, tablet). Falls back to parsed value from ClientInfoService if not provided.
     * @param data.expiresAt - Session expiration date
     * @remarks Client info (ipAddress, ipCountry, ipCity, userAgent, platform, browser) is automatically extracted from ClientInfoService context
     * @param data.isRemembered - Whether session is from "remember me"
     * @param data.authMethod - Authentication method: 'password', 'google', 'facebook', 'github', etc.
     * @returns Created session
     *
     * @example
     * ```typescript
     * const session = await sessionService.createSession({
     *   userId: user.id, // Internal ID (integer)
     *   accessTokenHash: jwtService.hashToken(accessToken),
     *   refreshTokenHash: jwtService.hashToken(refreshToken),
     *   tokenFamily: jwtService.generateTokenFamily(),
     *   // Client info (ipAddress, userAgent, etc.) automatically extracted from ClientInfoService
     *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
     * });
     * ```
     */
    SessionService.prototype.createSession = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var maxConcurrent, now, activeIds, toRevokeCount, idsToRevoke, nowTs, result, affected, auditError_1, errorMessage, clientInfo, deviceType, deviceName, platform, browser, deviceId, crypto_1, session;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        maxConcurrent = (_a = this.config.session) === null || _a === void 0 ? void 0 : _a.maxConcurrent;
                        if (!(maxConcurrent && maxConcurrent > 0)) return [3 /*break*/, 6];
                        now = new Date();
                        return [4 /*yield*/, this.sessionRepository.find({
                                select: ['id'],
                                where: { userId: data.userId, isRevoked: false, expiresAt: (0, typeorm_1.MoreThan)(now) },
                                order: { lastActivityAt: 'ASC' },
                            })];
                    case 1:
                        activeIds = (_e.sent());
                        if (!(activeIds.length >= maxConcurrent)) return [3 /*break*/, 6];
                        toRevokeCount = activeIds.length - maxConcurrent + 1;
                        idsToRevoke = activeIds.slice(0, toRevokeCount).map(function (s) { return s.id; });
                        if (!(idsToRevoke.length > 0)) return [3 /*break*/, 6];
                        nowTs = new Date();
                        return [4 /*yield*/, this.sessionRepository.update({ id: (0, typeorm_1.In)(idsToRevoke) }, { isRevoked: true, revokedAt: nowTs, revokeReason: 'Max concurrent sessions exceeded' })];
                    case 2:
                        result = _e.sent();
                        affected = result.affected || idsToRevoke.length;
                        if (!(affected > 0)) return [3 /*break*/, 6];
                        _e.label = 3;
                    case 3:
                        _e.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, ((_b = this.auditService) === null || _b === void 0 ? void 0 : _b.recordEvent({
                                userId: data.userId,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SESSION_REVOKED,
                                eventStatus: 'INFO',
                                reason: 'Max concurrent sessions exceeded',
                                description: "Revoked ".concat(affected, " session(s) due to max concurrent sessions limit"),
                                metadata: {
                                    revokedCount: affected,
                                    sessionIds: idsToRevoke,
                                },
                            }))];
                    case 4:
                        _e.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_1 = _e.sent();
                        errorMessage = auditError_1 instanceof Error ? auditError_1.message : 'Unknown error';
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to record SESSION_REVOKED summary event: ".concat(errorMessage), {
                            error: auditError_1,
                            userId: data.userId,
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        clientInfo = this.clientInfoService.get();
                        deviceType = data.deviceType || clientInfo.deviceType || null;
                        deviceName = data.deviceName || clientInfo.deviceName || null;
                        platform = clientInfo.platform || null;
                        browser = clientInfo.browser || null;
                        deviceId = data.deviceId;
                        if (!!deviceId) return [3 /*break*/, 8];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('crypto'); })];
                    case 7:
                        crypto_1 = _e.sent();
                        deviceId = crypto_1.randomUUID();
                        _e.label = 8;
                    case 8:
                        session = this.sessionRepository.create({
                            userId: data.userId,
                            accessTokenHash: data.accessTokenHash,
                            refreshTokenHash: data.refreshTokenHash,
                            tokenFamily: data.tokenFamily,
                            deviceId: deviceId,
                            deviceName: deviceName,
                            deviceType: deviceType,
                            // Client info automatically extracted from ClientInfoService (transparent access)
                            ipAddress: clientInfo.ipAddress || null,
                            ipCountry: clientInfo.ipCountry || null,
                            ipCity: clientInfo.ipCity || null,
                            userAgent: clientInfo.userAgent || null,
                            platform: platform,
                            browser: browser,
                            authMethod: data.authMethod || null,
                            expiresAt: data.expiresAt,
                            isRemembered: data.isRemembered || false,
                            lastActivityAt: new Date(),
                        });
                        return [4 /*yield*/, this.sessionRepository.save(session)];
                    case 9: return [2 /*return*/, (_e.sent())];
                }
            });
        });
    };
    /**
     * Find session by ID
     * @param sessionId - Session ID (can be string from JWT or number)
     */
    SessionService.prototype.findById = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sessionRepository.findOne({
                            where: { id: typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId },
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Find session by ID with minimal fields (hot-path)
     * @param sessionId - Session ID (string or number)
     */
    SessionService.prototype.findByIdLight = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var id, record, versionValue, light;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
                        return [4 /*yield*/, this.sessionRepository.findOne({
                                select: ['id', 'version', 'isRevoked', 'expiresAt', 'userId'],
                                where: { id: id },
                            })];
                    case 1:
                        record = (_b.sent());
                        if (!record)
                            return [2 /*return*/, null];
                        versionValue = (_a = record.version) !== null && _a !== void 0 ? _a : undefined;
                        light = {
                            id: record.id,
                            version: versionValue,
                            isRevoked: record.isRevoked,
                            expiresAt: record.expiresAt,
                            userId: record.userId,
                        };
                        return [2 /*return*/, light];
                }
            });
        });
    };
    /**
     * Find session by refresh token hash
     */
    SessionService.prototype.findByRefreshToken = function (refreshTokenHash) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sessionRepository.findOne({
                            select: ['id', 'userId', 'isRevoked', 'tokenFamily', 'expiresAt'],
                            where: { refreshTokenHash: refreshTokenHash, isRevoked: false },
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Find all active sessions for a user
     * @param userId - Internal user ID (integer)
     * @returns Array of active sessions
     */
    SessionService.prototype.findUserSessions = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sessionRepository.find({
                            where: { userId: userId, isRevoked: false },
                            order: { createdAt: 'DESC' },
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Update session activity timestamp
     * @param sessionId - Session ID (can be string from JWT or number)
     */
    SessionService.prototype.updateActivity = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
                        return [4 /*yield*/, this.sessionRepository.update(id, {
                                lastActivityAt: new Date(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update session with new tokens (for rotation)
     * @param sessionId - Session ID (can be string from JWT or number)
     */
    SessionService.prototype.updateTokens = function (sessionId, accessTokenHash, refreshTokenHash) {
        return __awaiter(this, void 0, void 0, function () {
            var id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
                        return [4 /*yield*/, this.sessionRepository.update(id, {
                                accessTokenHash: accessTokenHash,
                                refreshTokenHash: refreshTokenHash,
                                lastActivityAt: new Date(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a session and update token hashes atomically within one transaction
     *
     * Uses a callback to generate token hashes after obtaining the session ID.
     * This allows callers to embed sessionId in JWTs, then persist hashes atomically.
     */
    SessionService.prototype.createSessionAtomic = function (data, generateHashes) {
        return __awaiter(this, void 0, void 0, function () {
            var clientInfo, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        clientInfo = this.clientInfoService.get();
                        return [4 /*yield*/, this.sessionRepository.manager.transaction(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                                var deviceType, deviceName, platform, browser, deviceId, crypto_2, sessionEntity, saved, savedId, _a, accessTokenHash, refreshTokenHash, extra, sessionLight;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            deviceType = data.deviceType || clientInfo.deviceType || null;
                                            deviceName = data.deviceName || clientInfo.deviceName || null;
                                            platform = clientInfo.platform || null;
                                            browser = clientInfo.browser || null;
                                            deviceId = data.deviceId;
                                            if (!!deviceId) return [3 /*break*/, 2];
                                            return [4 /*yield*/, Promise.resolve().then(function () { return require('crypto'); })];
                                        case 1:
                                            crypto_2 = _b.sent();
                                            deviceId = crypto_2.randomUUID();
                                            _b.label = 2;
                                        case 2:
                                            sessionEntity = this.sessionRepository.create({
                                                userId: data.userId,
                                                accessTokenHash: '',
                                                refreshTokenHash: '',
                                                tokenFamily: data.tokenFamily,
                                                deviceId: deviceId,
                                                deviceName: deviceName,
                                                deviceType: deviceType,
                                                // Client info automatically extracted from ClientInfoService (transparent access)
                                                ipAddress: clientInfo.ipAddress || null,
                                                ipCountry: clientInfo.ipCountry || null,
                                                ipCity: clientInfo.ipCity || null,
                                                userAgent: clientInfo.userAgent || null,
                                                platform: platform,
                                                browser: browser,
                                                authMethod: data.authMethod || null,
                                                expiresAt: data.expiresAt,
                                                isRemembered: data.isRemembered || false,
                                                lastActivityAt: new Date(),
                                            });
                                            return [4 /*yield*/, trx.save(sessionEntity)];
                                        case 3:
                                            saved = _b.sent();
                                            savedId = saved.id;
                                            return [4 /*yield*/, generateHashes(savedId)];
                                        case 4:
                                            _a = _b.sent(), accessTokenHash = _a.accessTokenHash, refreshTokenHash = _a.refreshTokenHash, extra = _a.extra;
                                            return [4 /*yield*/, trx
                                                    .createQueryBuilder()
                                                    .update(this.sessionRepository.target)
                                                    .set({ accessTokenHash: accessTokenHash, refreshTokenHash: refreshTokenHash, lastActivityAt: new Date() })
                                                    .where({ id: savedId })
                                                    .execute()];
                                        case 5:
                                            _b.sent();
                                            return [4 /*yield*/, trx.findOne(this.sessionRepository.target, {
                                                    where: { id: savedId },
                                                })];
                                        case 6:
                                            sessionLight = (_b.sent());
                                            if (!sessionLight) {
                                                throw new Error('Failed to load session after creation');
                                            }
                                            return [2 /*return*/, { session: sessionLight, extra: extra }];
                                    }
                                });
                            }); })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Revoke a single session
     * @param sessionId - Session ID (can be string from JWT or number)
     * @param reason - Optional reason for revocation
     * @param metadata - Optional metadata to include in audit trail
     */
    SessionService.prototype.revokeSession = function (sessionId, reason, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var id, session, auditError_2, errorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
                        return [4 /*yield*/, this.findById(id)];
                    case 1:
                        session = _d.sent();
                        if (!session) {
                            return [2 /*return*/]; // Session doesn't exist, nothing to revoke
                        }
                        return [4 /*yield*/, this.sessionRepository.update(id, {
                                isRevoked: true,
                                revokedAt: new Date(),
                                revokeReason: reason,
                            })];
                    case 2:
                        _d.sent();
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: session.userId,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SESSION_REVOKED,
                                eventStatus: 'INFO',
                                sessionId: id,
                                reason: reason || 'User logout',
                                description: "Session revoked: ".concat(reason || 'User logout'),
                                // Client info automatically included from context
                                metadata: metadata || undefined,
                            }))];
                    case 4:
                        _d.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_2 = _d.sent();
                        errorMessage = auditError_2 instanceof Error ? auditError_2.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record SESSION_REVOKED audit event: ".concat(errorMessage), {
                            error: auditError_2,
                            userId: session.userId,
                            sessionId: id,
                        });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Revoke all sessions for a user (global signout)
     * @param userId - Internal user ID (integer)
     * @param reason - Optional reason for revocation
     * @returns Number of sessions revoked
     */
    SessionService.prototype.revokeAllUserSessions = function (userId, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var sessions, result, revokedCount, auditError_3, errorMessage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.findUserSessions(userId)];
                    case 1:
                        sessions = _d.sent();
                        return [4 /*yield*/, this.sessionRepository.update({ userId: userId, isRevoked: false }, {
                                isRevoked: true,
                                revokedAt: new Date(),
                                revokeReason: reason,
                            })];
                    case 2:
                        result = _d.sent();
                        revokedCount = result.affected || 0;
                        if (!(revokedCount > 0)) return [3 /*break*/, 6];
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        // Log one audit event summarizing all revoked sessions
                        return [4 /*yield*/, ((_a = this.auditService) === null || _a === void 0 ? void 0 : _a.recordEvent({
                                userId: userId,
                                eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SESSION_REVOKED,
                                eventStatus: 'INFO',
                                reason: reason || 'Global signout',
                                description: "All user sessions revoked (".concat(revokedCount, " session(s))"),
                                // Client info automatically included from context
                                metadata: {
                                    revokedCount: revokedCount,
                                    sessionIds: sessions.map(function (s) { return s.id; }),
                                },
                            }))];
                    case 4:
                        // Log one audit event summarizing all revoked sessions
                        _d.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        auditError_3 = _d.sent();
                        errorMessage = auditError_3 instanceof Error ? auditError_3.message : 'Unknown error';
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.call(_b, "Failed to record SESSION_REVOKED audit event (all sessions): ".concat(errorMessage), {
                            error: auditError_3,
                            userId: userId,
                            revokedCount: revokedCount,
                        });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, revokedCount];
                }
            });
        });
    };
    /**
     * Revoke all sessions in a token family (for reuse detection)
     */
    SessionService.prototype.revokeTokenFamily = function (tokenFamily, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sessionRepository.update({ tokenFamily: tokenFamily, isRevoked: false }, {
                            isRevoked: true,
                            revokedAt: new Date(),
                            revokeReason: reason || 'Token reuse detected',
                        })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.affected || 0];
                }
            });
        });
    };
    /**
     * Cleanup expired sessions
     */
    SessionService.prototype.cleanupExpiredSessions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sessionRepository.delete({
                            expiresAt: (0, typeorm_1.LessThan)(new Date()),
                        })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.affected || 0];
                }
            });
        });
    };
    /**
     * Count active sessions for a user
     * @param userId - Internal user ID (integer)
     * @returns Number of active sessions
     */
    SessionService.prototype.countUserSessions = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sessionRepository.count({
                            where: { userId: userId, isRevoked: false },
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ============================================================================
    // Token Reuse Detection (Security Feature)
    // ============================================================================
    /**
     * Mark a refresh token as used
     *
     * Stores the token hash in cache with expiration matching the refresh token TTL.
     * Used to detect token reuse attacks where stolen tokens are reused multiple times.
     *
     * ⚠️ SECURITY CRITICAL: This prevents token replay attacks
     *
     * @param tokenHash - SHA-256 hash of the refresh token
     * @param ttlSeconds - Time to live in seconds (should match refresh token expiry)
     *
     * @example
     * ```typescript
     * // Mark token as used during refresh
     * await sessionService.markRefreshTokenAsUsed(tokenHash, 30 * 24 * 60 * 60);
     * ```
     */
    SessionService.prototype.markRefreshTokenAsUsed = function (tokenHash, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function () {
            var key, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = "used-token:".concat(tokenHash);
                        return [4 /*yield*/, this.storageAdapter.set(key, 'true', ttlSeconds, { nx: true })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result !== null]; // True if successfully set, false if already existed
                }
            });
        });
    };
    /**
     * Check if a refresh token has been used before
     *
     * If token has been used, it indicates a token reuse attack and the entire
     * token family should be revoked immediately.
     *
     * @param tokenHash - SHA-256 hash of the refresh token
     * @returns True if token has been used before, false otherwise
     *
     * @example
     * ```typescript
     * const isReused = await sessionService.isRefreshTokenUsed(tokenHash);
     * if (isReused) {
     *   // TOKEN REUSE DETECTED - SECURITY BREACH!
     *   await sessionService.revokeTokenFamily(session.tokenFamily);
     *   throw new UnauthorizedException('Token reuse detected');
     * }
     * ```
     */
    SessionService.prototype.isRefreshTokenUsed = function (tokenHash) {
        return __awaiter(this, void 0, void 0, function () {
            var key;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = "used-token:".concat(tokenHash);
                        return [4 /*yield*/, this.storageAdapter.exists(key)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Acquire a distributed lock for token refresh
     *
     * Uses atomic set-if-not-exists (NX) operation to prevent concurrent refresh attempts.
     * Lock is automatically released after TTL expires, or manually via releaseRefreshLock.
     *
     * @param lockKey - Lock key (e.g., `session-refresh:${sessionId}` or `refresh-lock:${tokenHash}`)
     * @param ttlMs - Lock TTL in milliseconds (default: 10000ms)
     * @returns True if lock was acquired, false if already locked by another request
     *
     * @example
     * ```typescript
     * const lockKey = `session-refresh:${sessionId}`;
     * const lockAcquired = await sessionService.acquireRefreshLock(lockKey, 10000);
     * if (!lockAcquired) {
     *   throw new Error('Refresh already in progress');
     * }
     * try {
     *   // ... perform refresh ...
     * } finally {
     *   await sessionService.releaseRefreshLock(lockKey);
     * }
     * ```
     */
    SessionService.prototype.acquireRefreshLock = function (lockKey_1) {
        return __awaiter(this, arguments, void 0, function (lockKey, ttlMs) {
            var baseTtlSeconds, jitterMax, jitter, ttlWithJitter, result, acquired;
            if (ttlMs === void 0) { ttlMs = 10000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        baseTtlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
                        jitterMax = Math.max(1, Math.floor(baseTtlSeconds * 0.05));
                        jitter = Math.floor(Math.random() * (jitterMax * 2 + 1)) - jitterMax;
                        ttlWithJitter = Math.max(1, baseTtlSeconds + jitter);
                        return [4 /*yield*/, this.storageAdapter.set(lockKey, 'locked', ttlWithJitter, { nx: true })];
                    case 1:
                        result = _a.sent();
                        acquired = result !== null;
                        // Debug logging to help diagnose lock issues
                        if (!acquired) {
                            // Lock acquisition failed - another request has it
                            // This is expected behavior when multiple requests try to refresh simultaneously
                        }
                        return [2 /*return*/, acquired];
                }
            });
        });
    };
    /**
     * Release a distributed lock for token refresh
     *
     * @param lockKey - Lock key (must match the key used in acquireRefreshLock)
     */
    SessionService.prototype.releaseRefreshLock = function (lockKey) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.storageAdapter.del(lockKey)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return SessionService;
}());
exports.SessionService = SessionService;
