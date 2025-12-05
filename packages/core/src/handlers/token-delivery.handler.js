"use strict";
/**
 * Token Delivery Handler
 *
 * Handles response interception to deliver tokens via Cookies or JSON.
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
exports.TokenDeliveryHandler = void 0;
var index_1 = require("../index");
var TokenDeliveryHandler = /** @class */ (function () {
    function TokenDeliveryHandler(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * Process the response body.
     * If it contains tokens, handle delivery and return sanitized body.
     * If not, return original body.
     */
    TokenDeliveryHandler.prototype.handleResponse = function (req, res, body) {
        return __awaiter(this, void 0, void 0, function () {
            var deliveryMode, sanitizedBody;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                // Check if this is an auth response
                if (body && typeof body === 'object' && body.accessToken && body.refreshToken) {
                    deliveryMode = this.resolveDeliveryMode(req);
                    if (deliveryMode === 'cookies') {
                        this.setTokenCookies(res, body);
                        sanitizedBody = __assign({}, body);
                        delete sanitizedBody.accessToken;
                        delete sanitizedBody.refreshToken;
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, 'Tokens delivered via cookies');
                        return [2 /*return*/, sanitizedBody];
                    }
                    else {
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, 'Tokens delivered via JSON');
                        return [2 /*return*/, body];
                    }
                }
                return [2 /*return*/, body];
            });
        });
    };
    TokenDeliveryHandler.prototype.resolveDeliveryMode = function (req) {
        var _a, _b;
        var method = ((_a = this.config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.method) || 'json';
        // Route override
        if (req.attributes['nauthTokenDelivery']) {
            return req.attributes['nauthTokenDelivery'];
        }
        // Hybrid mode
        if (method === 'hybrid') {
            return (0, index_1.resolveDeliveryForRequest)(req.raw, (_b = this.config.tokenDelivery) === null || _b === void 0 ? void 0 : _b.hybridPolicy);
        }
        return method === 'cookies' ? 'cookies' : 'json';
    };
    TokenDeliveryHandler.prototype.setTokenCookies = function (res, body) {
        var _a, _b, _c, _d, _e, _f, _g;
        var accessTokenCookieName = (0, index_1.getAccessTokenCookieName)(this.config);
        var refreshTokenCookieName = (0, index_1.getRefreshTokenCookieName)(this.config);
        var cookieOptions = {
            httpOnly: true,
            secure: (_c = (_b = (_a = this.config.tokenDelivery) === null || _a === void 0 ? void 0 : _a.cookieOptions) === null || _b === void 0 ? void 0 : _b.secure) !== null && _c !== void 0 ? _c : true,
            sameSite: (((_e = (_d = this.config.tokenDelivery) === null || _d === void 0 ? void 0 : _d.cookieOptions) === null || _e === void 0 ? void 0 : _e.sameSite) || 'strict'),
            domain: (_g = (_f = this.config.tokenDelivery) === null || _f === void 0 ? void 0 : _f.cookieOptions) === null || _g === void 0 ? void 0 : _g.domain,
            path: '/',
        };
        var accessMaxAge = this.parseExpiry(this.config.jwt.accessToken.expiresIn) * 1000;
        var refreshMaxAge = this.parseExpiry(this.config.jwt.refreshToken.expiresIn) * 1000;
        res.setCookie(accessTokenCookieName, body.accessToken, __assign(__assign({}, cookieOptions), { maxAge: accessMaxAge }));
        res.setCookie(refreshTokenCookieName, body.refreshToken, __assign(__assign({}, cookieOptions), { maxAge: refreshMaxAge }));
    };
    TokenDeliveryHandler.prototype.parseExpiry = function (expiry) {
        if (typeof expiry === 'number')
            return expiry;
        var match = expiry.match(/^(\d+)([smhd])$/);
        if (!match)
            return 900; // Default 15m
        var value = parseInt(match[1], 10);
        var unit = match[2];
        switch (unit) {
            case 's':
                return value;
            case 'm':
                return value * 60;
            case 'h':
                return value * 3600;
            case 'd':
                return value * 86400;
            default:
                return 900;
        }
    };
    return TokenDeliveryHandler;
}());
exports.TokenDeliveryHandler = TokenDeliveryHandler;
