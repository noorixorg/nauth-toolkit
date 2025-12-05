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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustedDeviceService = void 0;
var crypto_1 = require("crypto");
/**
 * Trusted Device Service
 *
 * Manages device trust for "remember device" feature.
 * Devices can be trusted after successful MFA verification, allowing
 * users to skip MFA for a configured period (rememberDeviceDays).
 *
 * Security:
 * - Device tokens are server-generated UUIDs
 * - Only hash stored in database (SHA-256)
 * - Tokens persist across logouts and session expiry
 * - Independent of refresh token lifecycle
 *
 * @example
 * ```typescript
 * // Mark device as trusted after MFA
 * const deviceToken = await trustedDeviceService.createTrustedDevice(
 *   userId,
 *   deviceName,
 *   deviceType,
 *   ipAddress,
 *   userAgent,
 *   platform,
 *   browser
 * );
 *
 * // Check if device is trusted
 * const isTrusted = await trustedDeviceService.isDeviceTrusted(
 *   deviceToken,
 *   userId
 * );
 * ```
 */
var TrustedDeviceService = /** @class */ (function () {
    function TrustedDeviceService(config, logger, trustedDeviceRepository) {
        this.config = config;
        this.logger = logger;
        this.trustedDeviceRepository = trustedDeviceRepository;
    }
    /**
     * Create trusted device record
     *
     * Generates a secure device token, stores its hash in database,
     * and returns the plain token for client storage.
     *
     * @param userId - Internal user ID
     * @param deviceName - Optional device name
     * @param deviceType - Optional device type (mobile/desktop/tablet)
     * @param ipAddress - IP address when device was trusted
     * @param userAgent - User agent string
     * @param platform - Platform from user agent
     * @param browser - Browser from user agent
     * @returns Device token (UUID) to be stored by client
     *
     * @throws {Error} If rememberDevice is not enabled or repository not available
     */
    TrustedDeviceService.prototype.createTrustedDevice = function (userId, deviceName, deviceType, ipAddress, userAgent, platform, browser) {
        return __awaiter(this, void 0, void 0, function () {
            var crypto, deviceToken, deviceTokenHash, rememberDeviceDays, trustedUntil, existing, trustedDevice;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        if (!((_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.rememberDevices) || this.config.mfa.rememberDevices === 'never') {
                            throw new Error('rememberDevices is not enabled in configuration');
                        }
                        if (!this.trustedDeviceRepository) {
                            (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.warn) === null || _c === void 0 ? void 0 : _c.call(_b, 'TrustedDeviceRepository not available - trusted device feature disabled');
                            throw new Error('TrustedDeviceRepository not available');
                        }
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('crypto'); })];
                    case 1:
                        crypto = _h.sent();
                        deviceToken = crypto.randomUUID();
                        deviceTokenHash = this.hashDeviceToken(deviceToken);
                        rememberDeviceDays = this.config.mfa.rememberDeviceDays || 30;
                        trustedUntil = new Date();
                        trustedUntil.setDate(trustedUntil.getDate() + rememberDeviceDays);
                        return [4 /*yield*/, this.trustedDeviceRepository.findOne({
                                where: {
                                    userId: userId,
                                    deviceTokenHash: deviceTokenHash,
                                },
                            })];
                    case 2:
                        existing = _h.sent();
                        if (!existing) return [3 /*break*/, 4];
                        // Update existing record
                        return [4 /*yield*/, this.trustedDeviceRepository.update({ userId: userId, deviceTokenHash: deviceTokenHash }, {
                                trustedUntil: trustedUntil,
                                lastUsedAt: new Date(),
                                deviceName: deviceName || null,
                                deviceType: deviceType || null,
                                ipAddress: ipAddress || null,
                                userAgent: userAgent || null,
                                platform: platform || null,
                                browser: browser || null,
                            })];
                    case 3:
                        // Update existing record
                        _h.sent();
                        (_e = (_d = this.logger) === null || _d === void 0 ? void 0 : _d.debug) === null || _e === void 0 ? void 0 : _e.call(_d, "Updated trusted device for user ".concat(userId));
                        return [2 /*return*/, deviceToken];
                    case 4:
                        trustedDevice = this.trustedDeviceRepository.create({
                            userId: userId,
                            deviceTokenHash: deviceTokenHash,
                            deviceId: null, // Not used, kept for backward compatibility
                            deviceName: deviceName || null,
                            deviceType: deviceType || null,
                            ipAddress: ipAddress || null,
                            userAgent: userAgent || null,
                            platform: platform || null,
                            browser: browser || null,
                            trustedUntil: trustedUntil,
                            lastUsedAt: new Date(),
                        });
                        return [4 /*yield*/, this.trustedDeviceRepository.save(trustedDevice)];
                    case 5:
                        _h.sent();
                        (_g = (_f = this.logger) === null || _f === void 0 ? void 0 : _f.debug) === null || _g === void 0 ? void 0 : _g.call(_f, "Created trusted device for user ".concat(userId, ", expires ").concat(trustedUntil.toISOString()));
                        return [2 /*return*/, deviceToken];
                }
            });
        });
    };
    /**
     * Check if device is trusted
     *
     * Validates device token against trusted devices table.
     * Updates lastUsedAt if device is found and valid.
     *
     * Security:
     * - Returns false for invalid/tampered tokens (silent - MFA required)
     * - Detection of tampered tokens should be handled by caller for audit logging
     *
     * @param deviceToken - Device token from client (plain UUID)
     * @param userId - Internal user ID
     * @returns True if device is trusted and not expired
     */
    TrustedDeviceService.prototype.isDeviceTrusted = function (deviceToken, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var deviceTokenHash, trustedDevice, trustedUntil, lastUsedAt, now, fifteenMinutesMs;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!deviceToken || !this.trustedDeviceRepository) {
                            return [2 /*return*/, false];
                        }
                        if (!((_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.rememberDevices) || this.config.mfa.rememberDevices === 'never') {
                            return [2 /*return*/, false];
                        }
                        deviceTokenHash = this.hashDeviceToken(deviceToken);
                        return [4 /*yield*/, this.trustedDeviceRepository.findOne({
                                where: {
                                    userId: userId,
                                    deviceTokenHash: deviceTokenHash,
                                },
                            })];
                    case 1:
                        trustedDevice = _d.sent();
                        if (!trustedDevice) {
                            // Device token not found - could be tampered/fake
                            // Caller should check if token was provided and audit suspicious activity
                            return [2 /*return*/, false];
                        }
                        trustedUntil = trustedDevice.trustedUntil;
                        if (!(new Date() > new Date(trustedUntil))) return [3 /*break*/, 3];
                        // Trust expired - delete record
                        return [4 /*yield*/, this.trustedDeviceRepository.delete({
                                userId: userId,
                                deviceTokenHash: deviceTokenHash,
                            })];
                    case 2:
                        // Trust expired - delete record
                        _d.sent();
                        (_c = (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug) === null || _c === void 0 ? void 0 : _c.call(_b, "Trusted device expired for user ".concat(userId));
                        return [2 /*return*/, false];
                    case 3:
                        lastUsedAt = trustedDevice.lastUsedAt;
                        now = new Date();
                        fifteenMinutesMs = 15 * 60 * 1000;
                        if (!(!lastUsedAt || now.getTime() - new Date(lastUsedAt).getTime() > fifteenMinutesMs)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.trustedDeviceRepository.update({ userId: userId, deviceTokenHash: deviceTokenHash }, { lastUsedAt: now })];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5: return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Validate device token and detect tampering attempts
     *
     * Checks if device token is valid and returns validation result.
     * Used to detect suspicious tampered/fake token attempts for audit logging.
     *
     * @param deviceToken - Device token from client (can be null/undefined)
     * @param userId - Internal user ID
     * @returns Validation result with suspicious flag
     */
    TrustedDeviceService.prototype.validateDeviceToken = function (deviceToken, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var isTrusted, isSuspicious;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // No token provided - not suspicious (user just doesn't have trusted device)
                        if (!deviceToken) {
                            return [2 /*return*/, { isValid: false, isSuspicious: false }];
                        }
                        return [4 /*yield*/, this.isDeviceTrusted(deviceToken, userId)];
                    case 1:
                        isTrusted = _a.sent();
                        isSuspicious = !isTrusted && deviceToken !== null && deviceToken !== undefined;
                        return [2 /*return*/, { isValid: isTrusted, isSuspicious: isSuspicious }];
                }
            });
        });
    };
    /**
     * Revoke trusted device
     *
     * Removes device from trusted devices table.
     * Used when user explicitly untrusts a device.
     *
     * @param deviceToken - Device token to revoke
     * @param userId - Internal user ID
     */
    TrustedDeviceService.prototype.revokeTrustedDevice = function (deviceToken, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var deviceTokenHash;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.trustedDeviceRepository) {
                            return [2 /*return*/];
                        }
                        deviceTokenHash = this.hashDeviceToken(deviceToken);
                        return [4 /*yield*/, this.trustedDeviceRepository.delete({
                                userId: userId,
                                deviceTokenHash: deviceTokenHash,
                            })];
                    case 1:
                        _c.sent();
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "Revoked trusted device for user ".concat(userId));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get user's trusted devices
     *
     * Returns list of trusted devices for management UI.
     *
     * @param userId - Internal user ID
     * @returns Array of trusted device records (without tokens)
     */
    TrustedDeviceService.prototype.getUserTrustedDevices = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var devices, now, validDevices;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.trustedDeviceRepository) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.trustedDeviceRepository.find({
                                where: { userId: userId },
                                order: { lastUsedAt: 'DESC' },
                            })];
                    case 1:
                        devices = _a.sent();
                        now = new Date();
                        validDevices = devices.filter(function (d) { return new Date(d.trustedUntil) > now; });
                        // Return without sensitive data
                        return [2 /*return*/, validDevices.map(function (d) {
                                var deviceTokenHash = d.deviceTokenHash, rest = __rest(d, ["deviceTokenHash"]);
                                return rest;
                            })];
                }
            });
        });
    };
    /**
     * Hash device token (SHA-256)
     *
     * @private
     */
    TrustedDeviceService.prototype.hashDeviceToken = function (token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    };
    return TrustedDeviceService;
}());
exports.TrustedDeviceService = TrustedDeviceService;
