"use strict";
/**
 * CSRF Handler
 *
 * Generates and validates CSRF tokens.
 */
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
exports.CsrfHandler = void 0;
var index_1 = require("../index");
var SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
var CsrfHandler = /** @class */ (function () {
    function CsrfHandler(csrfService, config, logger) {
        this.csrfService = csrfService;
        this.config = config;
        this.logger = logger;
    }
    CsrfHandler.prototype.handle = function (req, res, next) {
        return __awaiter(this, void 0, void 0, function () {
            var existingStore;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        existingStore = req.attributes['__nauthContextStore'];
                        if (existingStore && !index_1.ContextStorage.getStore()) {
                            // Re-enter the context
                            return [2 /*return*/, index_1.ContextStorage.enterStore(existingStore, function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.handleInternal(req, res, next)];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        }
                        return [4 /*yield*/, this.handleInternal(req, res, next)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CsrfHandler.prototype.handleInternal = function (req, res, next) {
        return __awaiter(this, void 0, void 0, function () {
            var method, methodUpper, cookieName_1, existingToken, token, cookieOptions, excludedPaths, path, headerName, cookieName, tokenFromRequest, cookieToken, isValid;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0:
                        method = ((_a = this.config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.method) || 'json';
                        if (!(method !== 'cookies' && method !== 'hybrid')) return [3 /*break*/, 2];
                        return [4 /*yield*/, next()];
                    case 1:
                        _q.sent();
                        return [2 /*return*/];
                    case 2:
                        methodUpper = req.raw.method ? req.raw.method.toUpperCase() : 'GET';
                        if (!SAFE_METHODS.includes(methodUpper)) return [3 /*break*/, 4];
                        cookieName_1 = this.csrfService.getCookieName();
                        existingToken = req.cookies[cookieName_1];
                        if (!existingToken) {
                            token = this.csrfService.generateToken();
                            cookieOptions = __assign({ httpOnly: true, secure: (_d = (_c = (_b = this.config.tokenDelivery) === null || _b === void 0 ? void 0 : _b.cookieOptions) === null || _c === void 0 ? void 0 : _c.secure) !== null && _d !== void 0 ? _d : true, sameSite: (((_f = (_e = this.config.tokenDelivery) === null || _e === void 0 ? void 0 : _e.cookieOptions) === null || _f === void 0 ? void 0 : _f.sameSite) || 'strict'), domain: (_h = (_g = this.config.tokenDelivery) === null || _g === void 0 ? void 0 : _g.cookieOptions) === null || _h === void 0 ? void 0 : _h.domain, path: '/' }, this.csrfService.getCookieOptions());
                            res.setCookie(cookieName_1, token, cookieOptions);
                            // Also set the token in a response header so clients can read it (since cookie is httpOnly)
                            res.header(this.csrfService.getHeaderName(), token);
                            (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.debug) === null || _k === void 0 ? void 0 : _k.call(_j, 'CSRF token generated and set');
                        }
                        // Ensure we don't carry over error from previous state logic if any
                        if (req.attributes['nauthCsrfError']) {
                            delete req.attributes['nauthCsrfError'];
                        }
                        return [4 /*yield*/, next()];
                    case 3:
                        _q.sent();
                        return [2 /*return*/];
                    case 4:
                        if (!req.attributes['nauthPublic']) return [3 /*break*/, 6];
                        return [4 /*yield*/, next()];
                    case 5:
                        _q.sent();
                        return [2 /*return*/];
                    case 6:
                        excludedPaths = ((_m = (_l = this.config.security) === null || _l === void 0 ? void 0 : _l.csrf) === null || _m === void 0 ? void 0 : _m.excludedPaths) || [];
                        path = req.raw.path || req.raw.url;
                        if (!(path && excludedPaths.some(function (p) { return path.startsWith(p); }))) return [3 /*break*/, 8];
                        return [4 /*yield*/, next()];
                    case 7:
                        _q.sent();
                        return [2 /*return*/];
                    case 8:
                        headerName = this.csrfService.getHeaderName();
                        cookieName = this.csrfService.getCookieName();
                        tokenFromRequest = req.getHeader(headerName);
                        if (!tokenFromRequest && req.body) {
                            // Check common body fields if not in header
                            tokenFromRequest = req.body[headerName] || req.body['_csrf'] || req.body['csrfToken'];
                        }
                        cookieToken = req.cookies[cookieName];
                        // LAZY VALIDATION: Attach error to request instead of throwing immediately
                        if (!tokenFromRequest) {
                            req.attributes['nauthCsrfError'] = new index_1.NAuthException(index_1.AuthErrorCode.CSRF_TOKEN_MISSING, "CSRF token required. Include ".concat(headerName, " header or _csrf/csrfToken in body with the value from ").concat(cookieName, " cookie."));
                        }
                        else if (!cookieToken) {
                            req.attributes['nauthCsrfError'] = new index_1.NAuthException(index_1.AuthErrorCode.CSRF_TOKEN_MISSING, 'CSRF cookie missing. Make a GET request first.');
                        }
                        else {
                            isValid = this.csrfService.validateToken(String(tokenFromRequest), cookieToken);
                            if (!isValid) {
                                req.attributes['nauthCsrfError'] = new index_1.NAuthException(index_1.AuthErrorCode.CSRF_TOKEN_INVALID, 'CSRF token mismatch.');
                            }
                            else {
                                (_p = (_o = this.logger) === null || _o === void 0 ? void 0 : _o.debug) === null || _p === void 0 ? void 0 : _p.call(_o, 'CSRF token validated successfully');
                            }
                        }
                        return [4 /*yield*/, next()];
                    case 9:
                        _q.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return CsrfHandler;
}());
exports.CsrfHandler = CsrfHandler;
