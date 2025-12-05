"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.InternalAuthAuditService = exports.AuthAuditService = void 0;
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
var get_user_auth_history_dto_1 = require("../dto/get-user-auth-history.dto");
var get_events_by_type_dto_1 = require("../dto/get-events-by-type.dto");
var get_suspicious_activity_dto_1 = require("../dto/get-suspicious-activity.dto");
var get_risk_assessment_history_dto_1 = require("../dto/get-risk-assessment-history.dto");
/**
 * Authentication Audit Service (Base Class - Public API)
 *
 * Manages audit trail queries for authentication and security events.
 * Provides query capabilities for retrieving audit history.
 *
 * **Key Features:**
 * - Efficient queries using userId (internal integer ID)
 * - Pagination support for large datasets
 * - Query filtering by event type, status, date ranges
 * - User history queries (resolves userSub to userId automatically)
 *
 * **Design Notes:**
 * - Only stores `userId` (integer) - no userSub duplication
 * - All methods accepting userSub resolve to userId before querying
 * - Risk tracking fields are infrastructure for future adaptive MFA (no business logic)
 *
 * **Note:** This is the public API class. Event recording is handled internally
 * by `InternalAuthAuditService` and is not exposed to consumer applications.
 *
 * @example
 * ```typescript
 * // Get user history (accepts userSub, resolves to userId)
 * const history = await auditService.getUserAuthHistory({
 *   userSub: 'user-uuid',
 *   page: 1,
 *   limit: 50,
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
var AuthAuditService = /** @class */ (function () {
    function AuthAuditService(auditRepository, userRepository, logger, clientInfoService) {
        this.auditRepository = auditRepository;
        this.userRepository = userRepository;
        this.logger = logger;
        this.clientInfoService = clientInfoService;
    }
    // ============================================================================
    // Query Methods
    // ============================================================================
    /**
     * Get paginated authentication history for a user
     *
     * Accepts userSub (external identifier) and resolves to userId for efficient queries.
     * Supports filtering by event types, status, and date ranges.
     *
     * @param request - Request DTO containing userSub and filtering options
     * @returns Response DTO with paginated audit records
     * @throws {NAuthException} If user not found
     *
     * @example
     * ```typescript
     * const history = await auditService.getUserAuthHistory({
     *   userSub: 'user-uuid',
     *   page: 1,
     *   limit: 50,
     *   eventTypes: [AuthAuditEventType.LOGIN_SUCCESS, AuthAuditEventType.LOGIN_FAILED],
     *   startDate: new Date('2025-01-01'),
     * });
     * ```
     */
    AuthAuditService.prototype.getUserAuthHistory = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var user, page, limit, skip, queryBuilder, _a, data, total, response;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.userRepository.findOne({ where: { sub: request.userSub } })];
                    case 1:
                        user = (_b.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        page = request.page || 1;
                        limit = request.limit || 50;
                        skip = (page - 1) * limit;
                        queryBuilder = this.auditRepository
                            .createQueryBuilder('audit')
                            .where('audit.userId = :userId', { userId: user.id });
                        // Date range filter
                        if (request.startDate) {
                            queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate: request.startDate });
                        }
                        if (request.endDate) {
                            queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate: request.endDate });
                        }
                        // Event type filter
                        if (request.eventTypes && request.eventTypes.length > 0) {
                            queryBuilder.andWhere('audit.eventType IN (:...eventTypes)', { eventTypes: request.eventTypes });
                        }
                        // Event status filter
                        if (request.eventStatus && request.eventStatus.length > 0) {
                            queryBuilder.andWhere('audit.eventStatus IN (:...eventStatus)', { eventStatus: request.eventStatus });
                        }
                        // Order by date (newest first)
                        queryBuilder.orderBy('audit.createdAt', 'DESC');
                        // Pagination
                        queryBuilder.skip(skip).take(limit);
                        return [4 /*yield*/, queryBuilder.getManyAndCount()];
                    case 2:
                        _a = _b.sent(), data = _a[0], total = _a[1];
                        response = new get_user_auth_history_dto_1.GetUserAuthHistoryResponseDTO();
                        response.data = data;
                        response.total = total;
                        response.page = page;
                        response.limit = limit;
                        response.totalPages = Math.ceil(total / limit);
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Get events by type with pagination
     *
     * @param request - Request DTO containing eventType and pagination options
     * @returns Response DTO with paginated audit records
     *
     * @example
     * ```typescript
     * const events = await auditService.getEventsByType({
     *   eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
     *   page: 1,
     *   limit: 100,
     * });
     * ```
     */
    AuthAuditService.prototype.getEventsByType = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var page, limit, skip, queryBuilder, _a, data, total, response;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = request.page || 1;
                        limit = request.limit || 50;
                        skip = (page - 1) * limit;
                        queryBuilder = this.auditRepository.createQueryBuilder('audit').where('audit.eventType = :eventType', {
                            eventType: request.eventType,
                        });
                        // Date range filter
                        if (request.startDate) {
                            queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate: request.startDate });
                        }
                        if (request.endDate) {
                            queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate: request.endDate });
                        }
                        queryBuilder.orderBy('audit.createdAt', 'DESC').skip(skip).take(limit);
                        return [4 /*yield*/, queryBuilder.getManyAndCount()];
                    case 1:
                        _a = _b.sent(), data = _a[0], total = _a[1];
                        response = new get_events_by_type_dto_1.GetEventsByTypeResponseDTO();
                        response.data = data;
                        response.total = total;
                        response.page = page;
                        response.limit = limit;
                        response.totalPages = Math.ceil(total / limit);
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Get suspicious activity events
     *
     * Returns events with SUSPICIOUS status or SUSPICIOUS_ACTIVITY event type.
     *
     * @param request - Request DTO containing optional userSub and limit
     * @returns Response DTO with array of suspicious audit events
     *
     * @example
     * ```typescript
     * // Get all suspicious activity
     * const suspicious = await auditService.getSuspiciousActivity({});
     *
     * // Get suspicious activity for specific user
     * const userSuspicious = await auditService.getSuspiciousActivity({
     *   userSub: 'user-uuid',
     *   limit: 50,
     * });
     * ```
     */
    AuthAuditService.prototype.getSuspiciousActivity = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var limit, queryBuilder, user, data, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = request.limit || 100;
                        queryBuilder = this.auditRepository
                            .createQueryBuilder('audit')
                            .where('(audit.eventStatus = :status OR audit.eventType = :eventType)', {
                            status: 'SUSPICIOUS',
                            eventType: auth_audit_event_type_enum_1.AuthAuditEventType.SUSPICIOUS_ACTIVITY,
                        });
                        if (!request.userSub) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: request.userSub } })];
                    case 1:
                        user = (_a.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        queryBuilder.andWhere('audit.userId = :userId', { userId: user.id });
                        _a.label = 2;
                    case 2:
                        queryBuilder.orderBy('audit.createdAt', 'DESC').take(limit);
                        return [4 /*yield*/, queryBuilder.getMany()];
                    case 3:
                        data = _a.sent();
                        response = new get_suspicious_activity_dto_1.GetSuspiciousActivityResponseDTO();
                        response.data = data;
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Get risk assessment history for adaptive MFA analysis
     *
     * Returns events where risk assessment was performed (ADAPTIVE_MFA_RISK_ASSESSED,
     * ADAPTIVE_MFA_TRIGGERED, ADAPTIVE_MFA_BYPASSED).
     *
     * @param request - Request DTO containing userSub and limit
     * @returns Response DTO with array of risk assessment audit events
     * @throws {NAuthException} If user not found
     *
     * @example
     * ```typescript
     * const riskHistory = await auditService.getRiskAssessmentHistory({
     *   userSub: 'user-uuid',
     *   limit: 50,
     * });
     * ```
     */
    AuthAuditService.prototype.getRiskAssessmentHistory = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var limit, user, queryBuilder, data, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = request.limit || 100;
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: request.userSub } })];
                    case 1:
                        user = (_a.sent());
                        if (!user) {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.NOT_FOUND, 'User not found');
                        }
                        queryBuilder = this.auditRepository
                            .createQueryBuilder('audit')
                            .where('audit.userId = :userId', { userId: user.id })
                            .andWhere('audit.eventType IN (:...eventTypes)', {
                            eventTypes: [
                                auth_audit_event_type_enum_1.AuthAuditEventType.ADAPTIVE_MFA_RISK_ASSESSED,
                                auth_audit_event_type_enum_1.AuthAuditEventType.ADAPTIVE_MFA_TRIGGERED,
                                auth_audit_event_type_enum_1.AuthAuditEventType.ADAPTIVE_MFA_BYPASSED,
                            ],
                        })
                            .orderBy('audit.createdAt', 'DESC')
                            .take(limit);
                        return [4 /*yield*/, queryBuilder.getMany()];
                    case 2:
                        data = _a.sent();
                        response = new get_risk_assessment_history_dto_1.GetRiskAssessmentHistoryResponseDTO();
                        response.data = data;
                        return [2 /*return*/, response];
                }
            });
        });
    };
    return AuthAuditService;
}());
exports.AuthAuditService = AuthAuditService;
// ============================================================================
// Internal Service (Framework Adapters Only)
// ============================================================================
/**
 * Internal Authentication Audit Service
 *
 * Extends the base AuthAuditService with event recording capabilities.
 * This service is only available via `@nauth-toolkit/core/internal` and should
 * NOT be used by consumer applications.
 *
 * **Event Recording:**
 * The `recordEvent()` method is internal-only and is used by nauth-toolkit
 * services to log authentication events. Consumer applications should use
 * the query methods from the base `AuthAuditService` class.
 *
 * @internal
 * This class is only exported from `@nauth-toolkit/core/internal` for use
 * by framework adapters. Consumer applications should use the base
 * `AuthAuditService` from `@nauth-toolkit/core`.
 *
 * @example
 * ```typescript
 * // Framework adapter usage
 * import { AuthAuditService } from '@nauth-toolkit/core/internal';
 *
 * const auditService = new AuthAuditService(...);
 * // Can use recordEvent() here (internal only)
 * await auditService.recordEvent({ ... });
 * ```
 */
var InternalAuthAuditService = /** @class */ (function (_super) {
    __extends(InternalAuthAuditService, _super);
    function InternalAuthAuditService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Record an authentication audit event
     *
     * Creates an audit record for an authentication or security event.
     * Automatically extracts client information from request context when available.
     * This method is non-blocking - errors are logged but don't throw exceptions.
     *
     * **Automatic Client Info Extraction:**
     * When ClientInfoService is available, the following fields are automatically populated:
     * - ipAddress, ipCountry, ipCity (from request and geolocation)
     * - userAgent, platform, browser (from user agent parsing)
     * - deviceId, deviceName, deviceType (from request context)
     *
     * Explicitly provided fields in `data` will override auto-extracted values.
     *
     * @internal
     * This method is only available in InternalAuthAuditService and should not
     * be exposed to consumer applications.
     *
     * @param data - Audit event data (only event-specific fields needed)
     * @param data.userId - Internal user ID (preferred, more efficient)
     * @param data.userSub - External user identifier (will lookup userId if userId not provided)
     * @param data.eventType - Type of event
     * @param data.eventStatus - Event classification status
     * @returns Created audit record
     *
     * @example
     * ```typescript
     * // Simple recording - client info auto-populated
     * await auditService.recordEvent({
     *   userId: user.id,
     *   eventType: AuthAuditEventType.LOGIN_SUCCESS,
     *   eventStatus: 'SUCCESS',
     *   authMethod: 'password',
     *   // ipAddress, userAgent, deviceName, etc. automatically included!
     * });
     *
     * // Override specific fields if needed
     * await auditService.recordEvent({
     *   userId: user.id,
     *   eventType: AuthAuditEventType.LOGIN_SUCCESS,
     *   eventStatus: 'SUCCESS',
     *   ipAddress: 'custom-ip', // Overrides auto-extracted IP
     * });
     * ```
     */
    InternalAuthAuditService.prototype.recordEvent = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, user, clientInfo, clientInfoFromContext, mergedData, auditRecord, saved, error_1, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
            return __generator(this, function (_13) {
                switch (_13.label) {
                    case 0:
                        _13.trys.push([0, 4, , 5]);
                        userId = data.userId;
                        if (!(!userId && data.userSub)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.userRepository.findOne({ where: { sub: data.userSub } })];
                    case 1:
                        user = (_13.sent());
                        if (!user) {
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Cannot record audit event - user not found: ".concat(data.userSub));
                            return [2 /*return*/, null];
                        }
                        userId = user.id;
                        _13.label = 2;
                    case 2:
                        if (!userId) {
                            (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, 'Cannot record audit event - userId or userSub required');
                            return [2 /*return*/, null];
                        }
                        clientInfo = {};
                        if (this.clientInfoService) {
                            try {
                                clientInfoFromContext = this.clientInfoService.get();
                                // Only populate if not explicitly provided (allows override)
                                clientInfo = {
                                    ipAddress: clientInfoFromContext.ipAddress || undefined,
                                    ipCountry: clientInfoFromContext.ipCountry || undefined,
                                    ipCity: clientInfoFromContext.ipCity || undefined,
                                    userAgent: clientInfoFromContext.userAgent || undefined,
                                    platform: clientInfoFromContext.platform || undefined,
                                    browser: clientInfoFromContext.browser || undefined,
                                    deviceId: clientInfoFromContext.deviceToken || undefined,
                                    deviceName: clientInfoFromContext.deviceName || undefined,
                                    deviceType: clientInfoFromContext.deviceType || undefined,
                                    sessionId: clientInfoFromContext.sessionId || undefined,
                                };
                            }
                            catch (error) {
                                // Non-blocking: If client info extraction fails, continue without it
                                // This can happen if called outside request context (e.g., cron jobs)
                                (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.debug) === null || _f === void 0 ? void 0 : _f.call(_e, "Failed to extract client info for audit: ".concat(error instanceof Error ? error.message : 'Unknown error'));
                            }
                        }
                        mergedData = {
                            ipAddress: (_h = (_g = data.ipAddress) !== null && _g !== void 0 ? _g : clientInfo.ipAddress) !== null && _h !== void 0 ? _h : null,
                            ipCountry: (_k = (_j = data.ipCountry) !== null && _j !== void 0 ? _j : clientInfo.ipCountry) !== null && _k !== void 0 ? _k : null,
                            ipCity: (_m = (_l = data.ipCity) !== null && _l !== void 0 ? _l : clientInfo.ipCity) !== null && _m !== void 0 ? _m : null,
                            userAgent: (_p = (_o = data.userAgent) !== null && _o !== void 0 ? _o : clientInfo.userAgent) !== null && _p !== void 0 ? _p : null,
                            platform: (_r = (_q = data.platform) !== null && _q !== void 0 ? _q : clientInfo.platform) !== null && _r !== void 0 ? _r : null,
                            browser: (_t = (_s = data.browser) !== null && _s !== void 0 ? _s : clientInfo.browser) !== null && _t !== void 0 ? _t : null,
                            deviceId: (_v = (_u = data.deviceId) !== null && _u !== void 0 ? _u : clientInfo.deviceId) !== null && _v !== void 0 ? _v : null,
                            deviceName: (_x = (_w = data.deviceName) !== null && _w !== void 0 ? _w : clientInfo.deviceName) !== null && _x !== void 0 ? _x : null,
                            deviceType: (_z = (_y = data.deviceType) !== null && _y !== void 0 ? _y : clientInfo.deviceType) !== null && _z !== void 0 ? _z : null,
                            sessionId: (_1 = (_0 = data.sessionId) !== null && _0 !== void 0 ? _0 : clientInfo.sessionId) !== null && _1 !== void 0 ? _1 : null,
                        };
                        auditRecord = this.auditRepository.create({
                            userId: userId,
                            eventType: data.eventType,
                            eventStatus: data.eventStatus,
                            riskFactor: (_2 = data.riskFactor) !== null && _2 !== void 0 ? _2 : null,
                            riskFactors: (_3 = data.riskFactors) !== null && _3 !== void 0 ? _3 : null,
                            adaptiveMfaTriggered: (_4 = data.adaptiveMfaTriggered) !== null && _4 !== void 0 ? _4 : null,
                            ipAddress: mergedData.ipAddress,
                            ipCountry: mergedData.ipCountry,
                            ipCity: mergedData.ipCity,
                            userAgent: mergedData.userAgent,
                            platform: mergedData.platform,
                            browser: mergedData.browser,
                            deviceId: mergedData.deviceId,
                            deviceName: mergedData.deviceName,
                            deviceType: mergedData.deviceType,
                            sessionId: mergedData.sessionId,
                            challengeSessionId: (_5 = data.challengeSessionId) !== null && _5 !== void 0 ? _5 : null,
                            authMethod: (_6 = data.authMethod) !== null && _6 !== void 0 ? _6 : null,
                            performedBy: (_7 = data.performedBy) !== null && _7 !== void 0 ? _7 : null,
                            reason: (_8 = data.reason) !== null && _8 !== void 0 ? _8 : null,
                            description: (_9 = data.description) !== null && _9 !== void 0 ? _9 : null,
                            metadata: (_10 = data.metadata) !== null && _10 !== void 0 ? _10 : null,
                        });
                        return [4 /*yield*/, this.auditRepository.save(auditRecord)];
                    case 3:
                        saved = _13.sent();
                        return [2 /*return*/, saved];
                    case 4:
                        error_1 = _13.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        (_12 = (_11 = this.logger) === null || _11 === void 0 ? void 0 : _11.error) === null || _12 === void 0 ? void 0 : _12.call(_11, "Failed to record audit event: ".concat(errorMessage), { eventType: data.eventType, error: error_1 });
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return InternalAuthAuditService;
}(AuthAuditService));
exports.InternalAuthAuditService = InternalAuthAuditService;
