"use strict";
/**
 * Social Authentication Provider Initialization
 *
 * Dynamically loads and initializes social auth providers based on configuration.
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
exports.initSocialAuth = initSocialAuth;
/**
 * Initialize and register social authentication providers
 *
 * Dynamically imports social provider packages based on configuration.
 * Each provider is initialized with all required services and registered
 * with the SocialAuthService registry.
 *
 * @param config - NAuth configuration
 * @param providerRegistry - Social provider registry (internal)
 * @param authService - Core authentication service
 * @param socialAuthService - Social authentication service
 * @param jwtService - JWT token service
 * @param sessionService - Session management service
 * @param challengeHelper - Auth challenge helper service
 * @param clientInfoService - Client information service
 * @param logger - Logger instance
 * @param socialAuthStateStore - Shared state store for OAuth CSRF protection
 * @param phoneVerificationService - Phone verification service (optional)
 * @param auditService - Audit logging service (optional)
 * @returns Object containing initialized social providers
 */
function initSocialAuth(config, providerRegistry, authService, socialAuthService, jwtService, sessionService, challengeHelper, clientInfoService, logger, socialAuthStateStore, userRepository, phoneVerificationService, auditService) {
    return __awaiter(this, void 0, void 0, function () {
        var providers, _a, GoogleSocialAuthService, TokenVerifierService, tokenVerifier, error_1, _b, AppleSocialAuthService, TokenVerifierService, tokenVerifier, error_2, _c, FacebookSocialAuthService, TokenVerifierService, tokenVerifier, error_3;
        var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return __generator(this, function (_r) {
            switch (_r.label) {
                case 0:
                    providers = {};
                    if (!((_e = (_d = config.social) === null || _d === void 0 ? void 0 : _d.google) === null || _e === void 0 ? void 0 : _e.enabled)) return [3 /*break*/, 4];
                    _r.label = 1;
                case 1:
                    _r.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/social-google'); })];
                case 2:
                    _a = _r.sent(), GoogleSocialAuthService = _a.GoogleSocialAuthService, TokenVerifierService = _a.TokenVerifierService;
                    tokenVerifier = new TokenVerifierService(config);
                    providers.googleAuth = new GoogleSocialAuthService(config, logger, authService, socialAuthService, jwtService, sessionService, challengeHelper, clientInfoService, socialAuthStateStore, userRepository, phoneVerificationService, auditService, tokenVerifier);
                    // Register with registry
                    providerRegistry.registerProvider(providers.googleAuth);
                    (_f = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _f === void 0 ? void 0 : _f.call(logger, 'Google OAuth provider initialized');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _r.sent();
                    (_g = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _g === void 0 ? void 0 : _g.call(logger, 'Google OAuth provider not available. Install @nauth-toolkit/social-google to enable Google authentication.');
                    return [3 /*break*/, 4];
                case 4:
                    if (!((_j = (_h = config.social) === null || _h === void 0 ? void 0 : _h.apple) === null || _j === void 0 ? void 0 : _j.enabled)) return [3 /*break*/, 8];
                    _r.label = 5;
                case 5:
                    _r.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/social-apple'); })];
                case 6:
                    _b = _r.sent(), AppleSocialAuthService = _b.AppleSocialAuthService, TokenVerifierService = _b.TokenVerifierService;
                    tokenVerifier = new TokenVerifierService(config);
                    providers.appleAuth = new AppleSocialAuthService(config, logger, authService, socialAuthService, jwtService, sessionService, challengeHelper, clientInfoService, socialAuthStateStore, userRepository, phoneVerificationService, auditService, tokenVerifier);
                    // Register with registry
                    providerRegistry.registerProvider(providers.appleAuth);
                    (_k = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _k === void 0 ? void 0 : _k.call(logger, 'Apple Sign-In provider initialized');
                    return [3 /*break*/, 8];
                case 7:
                    error_2 = _r.sent();
                    (_l = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _l === void 0 ? void 0 : _l.call(logger, 'Apple Sign-In provider not available. Install @nauth-toolkit/social-apple to enable Apple authentication.');
                    return [3 /*break*/, 8];
                case 8:
                    if (!((_o = (_m = config.social) === null || _m === void 0 ? void 0 : _m.facebook) === null || _o === void 0 ? void 0 : _o.enabled)) return [3 /*break*/, 12];
                    _r.label = 9;
                case 9:
                    _r.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@nauth-toolkit/social-facebook'); })];
                case 10:
                    _c = _r.sent(), FacebookSocialAuthService = _c.FacebookSocialAuthService, TokenVerifierService = _c.TokenVerifierService;
                    tokenVerifier = new TokenVerifierService(config);
                    providers.facebookAuth = new FacebookSocialAuthService(config, logger, authService, socialAuthService, jwtService, sessionService, challengeHelper, clientInfoService, socialAuthStateStore, userRepository, phoneVerificationService, auditService, tokenVerifier);
                    // Register with registry
                    providerRegistry.registerProvider(providers.facebookAuth);
                    (_p = logger === null || logger === void 0 ? void 0 : logger.debug) === null || _p === void 0 ? void 0 : _p.call(logger, 'Facebook OAuth provider initialized');
                    return [3 /*break*/, 12];
                case 11:
                    error_3 = _r.sent();
                    (_q = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _q === void 0 ? void 0 : _q.call(logger, 'Facebook OAuth provider not available. Install @nauth-toolkit/social-facebook to enable Facebook authentication.');
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/, providers];
            }
        });
    });
}
