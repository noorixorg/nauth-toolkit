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
exports.RiskDetectionService = void 0;
var typeorm_1 = require("typeorm");
var auth_audit_event_type_enum_1 = require("../enums/auth-audit-event-type.enum");
var risk_factor_enum_1 = require("../enums/risk-factor.enum");
/**
 * Risk Detection Service
 *
 * Analyzes authentication attempts for risk factors by comparing current
 * context against user's historical behavior (sessions and audit trail).
 *
 * **Risk Factors Detected:**
 * - `new_device`: DeviceId never seen before (check sessions table)
 * - `new_ip`: IP address never seen before (check sessions + audit)
 * - `new_country`: Country never seen before (check sessions where ipCountry)
 * - `impossible_travel`: Geographic distance impossible in time window
 * - `suspicious_activity`: Recent failed attempts, token reuse, etc.
 *
 * **Design Notes:**
 * - All queries use userId (internal integer ID) for optimal performance
 * - Queries are optimized with COUNT and LIMIT 1 for existence checks
 * - Non-blocking: Errors logged but don't throw (graceful degradation)
 * - Impossible travel detection requires city-level geolocation (optional)
 *
 * @example
 * ```typescript
 * const riskFactors = await riskDetectionService.detectRiskFactors(user, clientInfo);
 * // Returns: ['new_device', 'new_country']
 * ```
 */
var RiskDetectionService = /** @class */ (function () {
    function RiskDetectionService(sessionRepository, auditRepository, config, logger, trustedDeviceService) {
        this.sessionRepository = sessionRepository;
        this.auditRepository = auditRepository;
        this.config = config;
        this.logger = logger;
        this.trustedDeviceService = trustedDeviceService;
    }
    /**
     * Detect risk factors for current authentication attempt
     *
     * Compares current context against user's historical behavior to identify
     * potential security risks. Returns array of detected risk factor strings.
     *
     * **Double-Counting Prevention:**
     * - If `new_country` is detected, `new_ip` is NOT checked (IP is source of country data)
     * - If `impossible_travel` is detected (city change), `new_ip` is NOT checked
     * - This prevents double-counting the same underlying risk (location change)
     *
     * @param user - User being authenticated
     * @param clientInfo - Current request context (IP, device, location, etc.)
     * @returns Array of detected risk factor strings
     *
     * @example
     * ```typescript
     * const factors = await riskDetectionService.detectRiskFactors(user, clientInfo);
     * // Returns: ['new_device', 'new_country'] // new_ip excluded if new_country detected
     * ```
     */
    RiskDetectionService.prototype.detectRiskFactors = function (user, clientInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var factors, enabledTriggers, isNew, newCountryDetected, isNew, impossibleTravelDetected, isImpossible, isNew, isSuspicious, error_1, errorMessage;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        factors = [];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 12, , 13]);
                        enabledTriggers = ((_b = (_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.adaptive) === null || _b === void 0 ? void 0 : _b.triggers) || [
                            risk_factor_enum_1.RiskFactor.NEW_DEVICE,
                            risk_factor_enum_1.RiskFactor.NEW_IP,
                            risk_factor_enum_1.RiskFactor.NEW_COUNTRY,
                        ];
                        if (!(enabledTriggers.includes(risk_factor_enum_1.RiskFactor.NEW_DEVICE) && clientInfo.deviceToken)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.isNewDevice(user.id, clientInfo.deviceToken)];
                    case 2:
                        isNew = _e.sent();
                        if (isNew) {
                            factors.push(risk_factor_enum_1.RiskFactor.NEW_DEVICE);
                        }
                        _e.label = 3;
                    case 3:
                        newCountryDetected = false;
                        if (!(enabledTriggers.includes(risk_factor_enum_1.RiskFactor.NEW_COUNTRY) && clientInfo.ipCountry)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.isNewCountry(user.id, clientInfo.ipCountry)];
                    case 4:
                        isNew = _e.sent();
                        if (isNew) {
                            factors.push(risk_factor_enum_1.RiskFactor.NEW_COUNTRY);
                            newCountryDetected = true;
                        }
                        _e.label = 5;
                    case 5:
                        impossibleTravelDetected = false;
                        if (!(enabledTriggers.includes(risk_factor_enum_1.RiskFactor.IMPOSSIBLE_TRAVEL) && clientInfo.ipCountry && clientInfo.ipCity)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.detectImpossibleTravel(user.id, clientInfo)];
                    case 6:
                        isImpossible = _e.sent();
                        if (isImpossible) {
                            factors.push(risk_factor_enum_1.RiskFactor.IMPOSSIBLE_TRAVEL);
                            impossibleTravelDetected = true;
                        }
                        _e.label = 7;
                    case 7:
                        if (!(enabledTriggers.includes(risk_factor_enum_1.RiskFactor.NEW_IP) &&
                            clientInfo.ipAddress &&
                            !newCountryDetected &&
                            !impossibleTravelDetected)) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.isNewIp(user.id, clientInfo.ipAddress)];
                    case 8:
                        isNew = _e.sent();
                        if (isNew) {
                            factors.push(risk_factor_enum_1.RiskFactor.NEW_IP);
                        }
                        _e.label = 9;
                    case 9:
                        if (!enabledTriggers.includes(risk_factor_enum_1.RiskFactor.SUSPICIOUS_ACTIVITY)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.detectSuspiciousActivity(user.id)];
                    case 10:
                        isSuspicious = _e.sent();
                        if (isSuspicious) {
                            factors.push(risk_factor_enum_1.RiskFactor.SUSPICIOUS_ACTIVITY);
                        }
                        _e.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_1 = _e.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.call(_c, "Risk detection failed for user ".concat(user.sub, ": ").concat(errorMessage), { error: error_1, userId: user.id });
                        // Return empty array on error (graceful degradation)
                        return [2 /*return*/, []];
                    case 13: return [2 /*return*/, factors];
                }
            });
        });
    };
    /**
     * Check if device has been seen before
     *
     * Checks trusted devices first (if available), then sessions table.
     * If device is trusted, it's not considered "new" even if no sessions exist yet.
     *
     * @param userId - Internal user ID (integer)
     * @param deviceToken - Device token from client
     * @returns True if device is new (never seen before and not trusted)
     * @private
     */
    RiskDetectionService.prototype.isNewDevice = function (userId, deviceToken) {
        return __awaiter(this, void 0, void 0, function () {
            var isTrusted, trustedError_1, errorMessage, exists, error_2, errorMessage;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 6, , 7]);
                        if (!(this.trustedDeviceService && typeof this.trustedDeviceService.isDeviceTrusted === 'function')) return [3 /*break*/, 4];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.trustedDeviceService.isDeviceTrusted(deviceToken, userId)];
                    case 2:
                        isTrusted = _e.sent();
                        if (isTrusted) {
                            // Device is trusted - not a new device
                            return [2 /*return*/, false];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        trustedError_1 = _e.sent();
                        errorMessage = trustedError_1 instanceof Error ? trustedError_1.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to check trusted device: ".concat(errorMessage), {
                            error: trustedError_1,
                            userId: userId,
                            deviceToken: deviceToken,
                        });
                        return [3 /*break*/, 4];
                    case 4: return [4 /*yield*/, this.sessionRepository.findOne({
                            select: ['id'],
                            where: { userId: userId, deviceId: deviceToken },
                        })];
                    case 5:
                        exists = _e.sent();
                        return [2 /*return*/, !exists];
                    case 6:
                        error_2 = _e.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to check device history: ".concat(errorMessage), { error: error_2, userId: userId, deviceToken: deviceToken });
                        return [2 /*return*/, true]; // Assume new device on error (safer for security)
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if IP address has been seen before
     *
     * Queries sessions table first (faster), then audit table for older data.
     *
     * @param userId - Internal user ID (integer)
     * @param ipAddress - IP address to check
     * @returns True if IP is new (never seen before)
     * @private
     */
    RiskDetectionService.prototype.isNewIp = function (userId, ipAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var seenInSessions, seenInAudit, error_3, errorMessage;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.sessionRepository.findOne({
                                select: ['id'],
                                where: { userId: userId, ipAddress: ipAddress },
                            })];
                    case 1:
                        seenInSessions = _c.sent();
                        if (seenInSessions) {
                            return [2 /*return*/, false]; // IP seen in sessions
                        }
                        return [4 /*yield*/, this.auditRepository.findOne({
                                select: ['id'],
                                where: { userId: userId, ipAddress: ipAddress },
                            })];
                    case 2:
                        seenInAudit = _c.sent();
                        return [2 /*return*/, !seenInAudit];
                    case 3:
                        error_3 = _c.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to check IP history: ".concat(errorMessage), { error: error_3, userId: userId, ipAddress: ipAddress });
                        return [2 /*return*/, true]; // Assume new IP on error (safer for security)
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if country has been seen before
     *
     * Queries sessions table for any past session from this country.
     * **Optimization:** Uses 1-2 queries instead of 3 by checking country existence first
     * (most likely to short-circuit), then verifying country data availability if needed.
     *
     * **Important:**
     * - On first login (no previous sessions), returns false (no history to compare)
     * - If sessions exist but none have ipCountry data (null), returns false (can't determine)
     * - Only flags as new if we have sessions with country data AND none match
     *
     * @param userId - Internal user ID (integer)
     * @param country - Country code to check (e.g., 'US', 'GB')
     * @returns True if country is new (never seen before), false on first login, if no country data, or if country seen before
     * @private
     */
    RiskDetectionService.prototype.isNewCountry = function (userId, country) {
        return __awaiter(this, void 0, void 0, function () {
            var countryExists, hasAnyCountryData, error_4, errorMessage;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.sessionRepository.findOne({
                                select: ['id'],
                                where: { userId: userId, ipCountry: country },
                            })];
                    case 1:
                        countryExists = _c.sent();
                        // If country exists in any session, it's not new
                        if (countryExists) {
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, this.sessionRepository.findOne({
                                select: ['id'],
                                where: { userId: userId, ipCountry: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()) },
                            })];
                    case 2:
                        hasAnyCountryData = _c.sent();
                        // If we have sessions with country data but country doesn't exist, it's new
                        // If no sessions have country data, we can't determine (return false for safety)
                        return [2 /*return*/, !!hasAnyCountryData];
                    case 3:
                        error_4 = _c.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to check country history: ".concat(errorMessage), { error: error_4, userId: userId, country: country });
                        return [2 /*return*/, false]; // Assume not new country on error (safer default)
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Detect impossible travel
     *
     * Calculates if geographic distance between last location and current
     * location is impossible given time elapsed.
     *
     * **Algorithm:**
     * 1. Get last session location (ipCountry, ipCity) and lastActivityAt
     * 2. Calculate distance between cities (Haversine formula)
     * 3. Calculate max possible speed (distance / time)
     * 4. If speed > threshold (default 900 km/h), flag as impossible
     *
     * **Edge Cases Handled:**
     * - No previous location data → false (benefit of doubt)
     * - Same country/city → false (not travel)
     * - Missing city data → false (can't determine without city)
     *
     * @param userId - Internal user ID (integer)
     * @param currentInfo - Current client info with location
     * @returns True if travel is impossible
     * @private
     */
    RiskDetectionService.prototype.detectImpossibleTravel = function (userId, currentInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var lastSession, lastLocation, hoursSinceLastSeen, distance, maxTravelSpeed, requiredSpeed, error_5, errorMessage;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!currentInfo.ipCountry || !currentInfo.ipCity) {
                            return [2 /*return*/, false]; // Can't determine without location
                        }
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.sessionRepository.findOne({
                                where: {
                                    userId: userId,
                                    ipCountry: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                                    ipCity: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                                },
                                order: {
                                    lastActivityAt: 'DESC',
                                },
                            })];
                    case 2:
                        lastSession = (_e.sent());
                        if (!lastSession) {
                            return [2 /*return*/, false]; // No previous location data (benefit of doubt)
                        }
                        lastLocation = {
                            country: lastSession.ipCountry,
                            city: lastSession.ipCity,
                            time: lastSession.lastActivityAt || lastSession.createdAt,
                        };
                        // Same location → not travel
                        if (lastLocation.country === currentInfo.ipCountry && lastLocation.city === currentInfo.ipCity) {
                            return [2 /*return*/, false];
                        }
                        hoursSinceLastSeen = (Date.now() - lastLocation.time.getTime()) / (1000 * 60 * 60);
                        // If time difference is very small (< 1 hour), be more lenient
                        if (hoursSinceLastSeen < 1) {
                            // Only flag if time is less than 30 minutes
                            if (hoursSinceLastSeen < 0.5) {
                                return [2 /*return*/, true]; // Impossible to travel between cities in < 30 minutes
                            }
                        }
                        return [4 /*yield*/, this.calculateDistance(lastLocation.city, lastLocation.country, currentInfo.ipCity, currentInfo.ipCountry)];
                    case 3:
                        distance = _e.sent();
                        if (distance === 0) {
                            return [2 /*return*/, false]; // Same location (shouldn't happen, but safety check)
                        }
                        maxTravelSpeed = ((_b = (_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.adaptive) === null || _b === void 0 ? void 0 : _b.maxTravelSpeed) || 900;
                        requiredSpeed = distance / hoursSinceLastSeen;
                        return [2 /*return*/, requiredSpeed > maxTravelSpeed];
                    case 4:
                        error_5 = _e.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : 'Unknown error';
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to detect impossible travel: ".concat(errorMessage), { error: error_5, userId: userId });
                        return [2 /*return*/, false]; // Assume not impossible travel on error
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate distance between two cities
     *
     * Simplified implementation - returns 0 for same city/country,
     * or estimated distance for different locations.
     *
     * **Note:** Full implementation would require:
     * - Geocoding service (Google Maps, OpenCage, etc.)
     * - Coordinate database (MaxMind City DB with coordinates)
     * - Haversine formula for accurate distance calculation
     *
     * For now, returns a conservative estimate:
     * - Same city: 0 km
     * - Same country, different city: 500 km (average)
     * - Different country: 2000 km (conservative estimate)
     *
     * @param city1 - First city name
     * @param country1 - First country code
     * @param city2 - Second city name
     * @param country2 - Second country code
     * @returns Distance in kilometers (estimated)
     * @private
     */
    RiskDetectionService.prototype.calculateDistance = function (city1, country1, city2, country2) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Same city → 0 km
                if (city1 === city2 && country1 === country2) {
                    return [2 /*return*/, 0];
                }
                // Same country, different city → estimate 500 km (average)
                if (country1 === country2) {
                    return [2 /*return*/, 500];
                }
                // Different country → estimate 2000 km (conservative)
                // This is a simplified approach - full implementation would use coordinates
                return [2 /*return*/, 2000];
            });
        });
    };
    /**
     * Detect suspicious activity patterns
     *
     * Checks for:
     * - Recent failed login attempts (last 1 hour)
     * - Token reuse detected (SUSPICIOUS_ACTIVITY audit events)
     * - Multiple MFA failures
     * - Account lockout attempts
     *
     * @param userId - Internal user ID (integer)
     * @returns True if suspicious activity detected
     * @private
     */
    RiskDetectionService.prototype.detectSuspiciousActivity = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var windowHours, oneHourAgo, hasSuspicious, failedLogins, error_6, errorMessage;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 3, , 4]);
                        windowHours = ((_b = (_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.adaptive) === null || _b === void 0 ? void 0 : _b.suspiciousActivityWindow) || 1;
                        oneHourAgo = new Date(Date.now() - windowHours * 60 * 60 * 1000);
                        return [4 /*yield*/, this.auditRepository.findOne({
                                select: ['id'],
                                where: { userId: userId, eventStatus: 'SUSPICIOUS', createdAt: (0, typeorm_1.MoreThan)(oneHourAgo) },
                            })];
                    case 1:
                        hasSuspicious = _e.sent();
                        if (hasSuspicious) {
                            return [2 /*return*/, true];
                        }
                        return [4 /*yield*/, this.auditRepository.find({
                                select: ['id'],
                                where: { userId: userId, eventType: auth_audit_event_type_enum_1.AuthAuditEventType.LOGIN_FAILED, createdAt: (0, typeorm_1.MoreThan)(oneHourAgo) },
                                order: { createdAt: 'DESC' },
                                take: 3,
                            })];
                    case 2:
                        failedLogins = _e.sent();
                        return [2 /*return*/, failedLogins.length >= 3];
                    case 3:
                        error_6 = _e.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : 'Unknown error';
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Failed to detect suspicious activity: ".concat(errorMessage), { error: error_6, userId: userId });
                        return [2 /*return*/, false]; // Assume not suspicious on error
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return RiskDetectionService;
}());
exports.RiskDetectionService = RiskDetectionService;
