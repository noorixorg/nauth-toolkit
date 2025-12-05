"use strict";
/**
 * Authentication Handler
 *
 * Validates JWT tokens and attaches user to request.
 * Platform-agnostic implementation.
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
exports.AuthHandler = void 0;
var index_1 = require("../index");
var AuthHandler = /** @class */ (function () {
    function AuthHandler(jwtService, sessionService, userRepository, config, logger) {
        this.jwtService = jwtService;
        this.sessionService = sessionService;
        this.userRepository = userRepository;
        this.config = config;
        this.logger = logger;
    }
    AuthHandler.prototype.handle = function (req, _res, next) {
        return __awaiter(this, void 0, void 0, function () {
            var existingStore;
            var _this = this;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        existingStore = req.attributes['__nauthContextStore'];
                        if (existingStore && !index_1.ContextStorage.getStore()) {
                            // Re-enter the context created by ClientInfoHandler
                            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, 'AuthHandler: Re-entering existing context');
                            return [2 /*return*/, index_1.ContextStorage.enterStore(existingStore, function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.handleInternal(req, _res, next)];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        }
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, 'AuthHandler: Using current context');
                        return [4 /*yield*/, this.handleInternal(req, _res, next)];
                    case 1:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AuthHandler.prototype.handleInternal = function (req, _res, next) {
        return __awaiter(this, void 0, void 0, function () {
            var token, validation, sessionId, session, initialVersion, user, revalidated, error_1;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return __generator(this, function (_u) {
                switch (_u.label) {
                    case 0:
                        _u.trys.push([0, 24, , 26]);
                        if (!req.attributes['nauthPublic']) return [3 /*break*/, 2];
                        return [4 /*yield*/, next()];
                    case 1:
                        _u.sent();
                        return [2 /*return*/];
                    case 2:
                        token = this.extractToken(req);
                        if (!!token) return [3 /*break*/, 4];
                        return [4 /*yield*/, next()];
                    case 3:
                        _u.sent();
                        return [2 /*return*/];
                    case 4: return [4 /*yield*/, this.jwtService.validateAccessToken(token)];
                    case 5:
                        validation = _u.sent();
                        if (!!validation.valid) return [3 /*break*/, 7];
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, 'Invalid token:', validation.error);
                        return [4 /*yield*/, next()];
                    case 6:
                        _u.sent();
                        return [2 /*return*/];
                    case 7:
                        sessionId = validation.payload.sessionId;
                        return [4 /*yield*/, this.sessionService.findByIdLight(sessionId)];
                    case 8:
                        session = _u.sent();
                        if (!!session) return [3 /*break*/, 10];
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, 'Session not found:', sessionId);
                        return [4 /*yield*/, next()];
                    case 9:
                        _u.sent();
                        return [2 /*return*/];
                    case 10:
                        initialVersion = session.version;
                        if (!session.isRevoked) return [3 /*break*/, 12];
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.warn) === null || _f === void 0 ? void 0 : _f.call(_e, 'Session has been revoked:', sessionId);
                        return [4 /*yield*/, next()];
                    case 11:
                        _u.sent();
                        return [2 /*return*/];
                    case 12:
                        if (!(session.expiresAt < new Date())) return [3 /*break*/, 14];
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.debug) === null || _h === void 0 ? void 0 : _h.call(_g, 'Session has expired:', sessionId);
                        return [4 /*yield*/, next()];
                    case 13:
                        _u.sent();
                        return [2 /*return*/];
                    case 14: return [4 /*yield*/, this.userRepository.findOne({
                            select: [
                                'id',
                                'sub',
                                'username',
                                'firstName',
                                'lastName',
                                'email',
                                'phone',
                                'isEmailVerified',
                                'isPhoneVerified',
                                'isActive',
                                'mustChangePassword',
                                'isLocked',
                                'lockReason',
                                'lockedAt',
                                'lockedUntil',
                                'failedLoginAttempts',
                                'lastFailedLoginAt',
                                'lastLoginAt',
                                'lastLoginIp',
                                'hasSocialAuth',
                                'socialProviders',
                                'mfaEnabled',
                                'mfaMethods',
                                'preferredMfaMethod',
                                'mfaExempt',
                                'mfaExemptReason',
                                'mfaExemptGrantedAt',
                                'metadata',
                                'createdAt',
                                'updatedAt',
                            ],
                            where: { sub: validation.payload.sub },
                        })];
                    case 15:
                        user = _u.sent();
                        if (!!user) return [3 /*break*/, 17];
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.warn) === null || _k === void 0 ? void 0 : _k.call(_j, 'User not found:', validation.payload.sub);
                        return [4 /*yield*/, next()];
                    case 16:
                        _u.sent();
                        return [2 /*return*/];
                    case 17:
                        if (!!user.isActive) return [3 /*break*/, 19];
                        (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.warn) === null || _m === void 0 ? void 0 : _m.call(_l, 'Account is not active:', user.sub);
                        return [4 /*yield*/, next()];
                    case 18:
                        _u.sent();
                        return [2 /*return*/];
                    case 19: return [4 /*yield*/, this.sessionService.findByIdLight(sessionId)];
                    case 20:
                        revalidated = _u.sent();
                        if (!(!revalidated || revalidated.version !== initialVersion || revalidated.isRevoked)) return [3 /*break*/, 22];
                        (_p = (_o = this.logger) === null || _o === void 0 ? void 0 : _o.error) === null || _p === void 0 ? void 0 : _p.call(_o, 'Session was modified during request - possible security breach');
                        return [4 /*yield*/, next()];
                    case 21:
                        _u.sent();
                        return [2 /*return*/];
                    case 22:
                        // Attach to request attributes
                        req.attributes['user'] = user;
                        req.attributes['token'] = validation.payload;
                        // Also modify raw request for backward compatibility if needed/possible by adapter?
                        // Ideally adapters should map attributes to req.user
                        // Store in ContextStorage for helpers
                        index_1.ContextStorage.set('CURRENT_USER', user);
                        index_1.ContextStorage.set('JWT_PAYLOAD', validation.payload);
                        index_1.ContextStorage.set('CURRENT_SESSION', sessionId);
                        (_r = (_q = this.logger) === null || _q === void 0 ? void 0 : _q.debug) === null || _r === void 0 ? void 0 : _r.call(_q, "Auth handler: User ".concat(user.sub, " authenticated successfully"));
                        // Update Client Info with Session ID
                        this.updateClientInfoSessionId(sessionId);
                        return [4 /*yield*/, next()];
                    case 23:
                        _u.sent();
                        return [3 /*break*/, 26];
                    case 24:
                        error_1 = _u.sent();
                        (_t = (_s = this.logger) === null || _s === void 0 ? void 0 : _s.error) === null || _t === void 0 ? void 0 : _t.call(_s, 'Error in auth handler:', error_1 instanceof Error ? error_1.message : String(error_1), error_1 instanceof Error ? error_1.stack : undefined);
                        return [4 /*yield*/, next()];
                    case 25:
                        _u.sent();
                        return [3 /*break*/, 26];
                    case 26: return [2 /*return*/];
                }
            });
        });
    };
    AuthHandler.prototype.extractToken = function (req) {
        var _a, _b;
        var method = ((_a = this.config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.method) || 'json';
        var authHeader = req.getHeader('authorization');
        var headerToken = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : null;
        var accessTokenCookieName = (0, index_1.getAccessTokenCookieName)(this.config);
        var cookieToken = req.cookies[accessTokenCookieName];
        var routeMode = req.attributes['nauthTokenDelivery']; // Route specific override
        var effective = 'json';
        if (routeMode) {
            effective = routeMode;
        }
        else if (method === 'hybrid') {
            // Logic for hybrid needs to know if it's web or mobile.
            // Assuming logic is: if cookies present, prefer cookies? Or checks header?
            // Existing logic used resolveDeliveryForRequest(req.raw).
            // Let's reimplement simple logic here or delegate to existing helper if it can handle generic req?
            // The existing resolveDeliveryForRequest takes 'any' and checks headers.
            effective = (0, index_1.resolveDeliveryForRequest)(req.raw, (_b = this.config.tokenDelivery) === null || _b === void 0 ? void 0 : _b.hybridPolicy);
        }
        else {
            effective = method === 'cookies' ? 'cookies' : 'json';
        }
        if (effective === 'cookies') {
            if (headerToken && !cookieToken) {
                throw new index_1.NAuthException(index_1.AuthErrorCode.BEARER_NOT_ALLOWED, 'Bearer tokens are not allowed in cookie-only path.');
            }
            return cookieToken || null;
        }
        // effective === 'json'
        if (cookieToken && !headerToken) {
            throw new index_1.NAuthException(index_1.AuthErrorCode.COOKIES_NOT_ALLOWED, 'Cookie tokens are not allowed in JSON-only path.');
        }
        return headerToken || null;
    };
    AuthHandler.prototype.updateClientInfoSessionId = function (sessionId) {
        var clientInfo = index_1.ContextStorage.get('CLIENT_INFO');
        if (clientInfo) {
            var sessionIdNumber = void 0;
            if (typeof sessionId === 'number') {
                sessionIdNumber = sessionId;
            }
            else {
                sessionIdNumber = parseInt(String(sessionId), 10);
            }
            if (!isNaN(sessionIdNumber) && sessionIdNumber > 0) {
                clientInfo.sessionId = sessionIdNumber;
                index_1.ContextStorage.set('CLIENT_INFO', clientInfo);
            }
        }
    };
    return AuthHandler;
}());
exports.AuthHandler = AuthHandler;
