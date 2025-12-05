"use strict";
/**
 * MFA Provider Registration
 *
 * Dynamically loads and registers MFA providers with the MFAService.
 */
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
exports.registerMFAProviders = registerMFAProviders;
/**
 * Register MFA providers with the MFA service
 *
 * Dynamically imports MFA provider packages based on configuration.
 * Each provider is initialized with required services and registered.
 *
 * @param config - NAuth configuration
 * @param mfaService - MFA management service
 * @param mfaDeviceRepository - MFA device repository
 * @param userRepository - User repository
 * @param logger - Logger instance
 * @param passwordService - Password service (required by base provider)
 * @param phoneVerificationService - Phone verification service (optional, for SMS MFA)
 * @param challengeService - Challenge service (optional)
 * @param auditService - Audit service (optional)
 * @param clientInfoService - Client info service (optional)
 */
function registerMFAProviders(config, mfaService, mfaDeviceRepository, userRepository, logger, passwordService, emailVerificationService, phoneVerificationService, challengeService, auditService, clientInfoService) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, TOTPMFAProviderService, TOTPService, totpService, totpProvider, error_1, SMSMFAProviderService, smsProvider, error_2, EmailMFAProviderService, emailProvider, error_3, _b, PasskeyMFAProviderService, PasskeyService, passkeyService, passkeyProvider, error_4;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    if (!((_c = config.mfa) === null || _c === void 0 ? void 0 : _c.enabled)) {
                        return [2 /*return*/];
                    }
                    _o.label = 1;
                case 1:
                    _o.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/mfa-totp'); })];
                case 2:
                    _a = _o.sent(), TOTPMFAProviderService = _a.TOTPMFAProviderService, TOTPService = _a.TOTPService;
                    totpService = new TOTPService(config, logger);
                    totpProvider = new TOTPMFAProviderService(mfaDeviceRepository, userRepository, config, logger, passwordService, totpService, challengeService, auditService, clientInfoService);
                    mfaService.registerProvider(totpProvider);
                    (_d = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _d === void 0 ? void 0 : _d.call(logger, 'TOTP MFA provider registered');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _o.sent();
                    (_e = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _e === void 0 ? void 0 : _e.call(logger, 'TOTP MFA package not found. Install @nauth-toolkit/mfa-totp to enable TOTP MFA.');
                    return [3 /*break*/, 4];
                case 4:
                    if (!phoneVerificationService) return [3 /*break*/, 9];
                    _o.label = 5;
                case 5:
                    _o.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/mfa-sms'); })];
                case 6:
                    SMSMFAProviderService = (_o.sent()).SMSMFAProviderService;
                    smsProvider = new SMSMFAProviderService(mfaDeviceRepository, userRepository, config, logger, passwordService, phoneVerificationService, challengeService, auditService, clientInfoService);
                    mfaService.registerProvider(smsProvider);
                    (_f = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _f === void 0 ? void 0 : _f.call(logger, 'SMS MFA provider registered');
                    return [3 /*break*/, 8];
                case 7:
                    error_2 = _o.sent();
                    (_g = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _g === void 0 ? void 0 : _g.call(logger, 'SMS MFA package not found. Install @nauth-toolkit/mfa-sms to enable SMS MFA.');
                    return [3 /*break*/, 8];
                case 8: return [3 /*break*/, 10];
                case 9:
                    (_h = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _h === void 0 ? void 0 : _h.call(logger, 'Phone verification service not configured. Skipping SMS MFA registration.');
                    _o.label = 10;
                case 10:
                    _o.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/mfa-email'); })];
                case 11:
                    EmailMFAProviderService = (_o.sent()).EmailMFAProviderService;
                    emailProvider = new EmailMFAProviderService(mfaDeviceRepository, userRepository, config, logger, passwordService, emailVerificationService, challengeService, auditService, clientInfoService);
                    mfaService.registerProvider(emailProvider);
                    (_j = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _j === void 0 ? void 0 : _j.call(logger, 'Email MFA provider registered');
                    return [3 /*break*/, 13];
                case 12:
                    error_3 = _o.sent();
                    (_k = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _k === void 0 ? void 0 : _k.call(logger, 'Email MFA package not found. Install @nauth-toolkit/mfa-email to enable Email MFA.');
                    return [3 /*break*/, 13];
                case 13:
                    _o.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/mfa-passkey'); })];
                case 14:
                    _b = _o.sent(), PasskeyMFAProviderService = _b.PasskeyMFAProviderService, PasskeyService = _b.PasskeyService;
                    passkeyService = new PasskeyService(config, logger);
                    passkeyProvider = new PasskeyMFAProviderService(mfaDeviceRepository, userRepository, config, logger, passwordService, passkeyService, challengeService, auditService, clientInfoService);
                    mfaService.registerProvider(passkeyProvider);
                    (_l = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _l === void 0 ? void 0 : _l.call(logger, 'Passkey MFA provider registered');
                    return [3 /*break*/, 16];
                case 15:
                    error_4 = _o.sent();
                    (_m = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _m === void 0 ? void 0 : _m.call(logger, 'Passkey MFA package not found. Install @nauth-toolkit/mfa-passkey to enable Passkey MFA.');
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/];
            }
        });
    });
}
