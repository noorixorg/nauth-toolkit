"use strict";
/**
 * Express Framework Adapter
 *
 * Adapts NAuth to work with Express.js
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
exports.ExpressAdapter = void 0;
var ExpressAdapter = /** @class */ (function () {
    function ExpressAdapter() {
    }
    /**
     * Register a middleware handler
     */
    ExpressAdapter.prototype.registerMiddleware = function (name, handler) {
        var _this = this;
        return function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
            var nauthReq, nauthRes, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nauthReq = new ExpressRequestWrapper(req);
                        nauthRes = new ExpressResponseWrapper(res);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, handler(nauthReq, nauthRes, function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    next();
                                    return [2 /*return*/];
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        next(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
    };
    /**
     * Register a response interceptor
     * Used for Token Delivery to modify response body before sending
     */
    ExpressAdapter.prototype.registerResponseInterceptor = function (handler) {
        return function (req, res, next) {
            var originalJson = res.json.bind(res);
            // Monkey-patch res.json
            res.json = function (body) {
                return __awaiter(this, void 0, void 0, function () {
                    var nauthReq, nauthRes, modifiedBody, error_2;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                nauthReq = new ExpressRequestWrapper(req);
                                nauthRes = new ExpressResponseWrapper(res);
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, handler(nauthReq, nauthRes, body)];
                            case 2:
                                modifiedBody = _a.sent();
                                return [2 /*return*/, originalJson(modifiedBody)];
                            case 3:
                                error_2 = _a.sent();
                                // Fallback to original if error
                                console.error('Error in response interceptor:', error_2);
                                return [2 /*return*/, originalJson(body)];
                            case 4: return [2 /*return*/];
                        }
                    });
                });
            };
            next();
        };
    };
    return ExpressAdapter;
}());
exports.ExpressAdapter = ExpressAdapter;
/**
 * Express Request Wrapper
 */
var ExpressRequestWrapper = /** @class */ (function () {
    function ExpressRequestWrapper(raw) {
        this.raw = raw;
    }
    Object.defineProperty(ExpressRequestWrapper.prototype, "body", {
        get: function () {
            return this.raw.body;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExpressRequestWrapper.prototype, "query", {
        get: function () {
            return this.raw.query;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExpressRequestWrapper.prototype, "params", {
        get: function () {
            return this.raw.params;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExpressRequestWrapper.prototype, "headers", {
        get: function () {
            return this.raw.headers;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExpressRequestWrapper.prototype, "cookies", {
        get: function () {
            // Express (with cookie-parser)
            return this.raw.cookies || {};
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExpressRequestWrapper.prototype, "ip", {
        get: function () {
            return this.raw.ip;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExpressRequestWrapper.prototype, "attributes", {
        get: function () {
            // Use the raw request object itself as storage for attributes
            // Ensure nauthPublic is preserved if it was set on the raw request
            return this.raw;
        },
        enumerable: false,
        configurable: true
    });
    ExpressRequestWrapper.prototype.getHeader = function (name) {
        var val = this.raw.get ? this.raw.get(name) : this.raw.headers[name.toLowerCase()];
        if (Array.isArray(val))
            return val[0];
        return val;
    };
    return ExpressRequestWrapper;
}());
/**
 * Express Response Wrapper
 */
var ExpressResponseWrapper = /** @class */ (function () {
    function ExpressResponseWrapper(raw) {
        this.raw = raw;
    }
    ExpressResponseWrapper.prototype.status = function (code) {
        this.raw.status(code);
        return this;
    };
    ExpressResponseWrapper.prototype.header = function (name, value) {
        this.raw.setHeader(name, value);
        return this;
    };
    ExpressResponseWrapper.prototype.setCookie = function (name, value, options) {
        if (typeof this.raw.cookie === 'function') {
            this.raw.cookie(name, value, options);
        }
        else {
            // Fallback if not using Express cookie-parser/middleware?
            // Typically res.cookie is added by express itself
            // If raw node response, we'd need to serialize manually.
            // But this is ExpressAdapter, so we assume Express response.
            this.raw.cookie(name, value, options);
        }
        return this;
    };
    ExpressResponseWrapper.prototype.clearCookie = function (name, options) {
        this.raw.clearCookie(name, options);
        return this;
    };
    ExpressResponseWrapper.prototype.send = function (body) {
        this.raw.send(body);
    };
    ExpressResponseWrapper.prototype.json = function (body) {
        this.raw.json(body);
    };
    ExpressResponseWrapper.prototype.redirect = function (url, status) {
        if (status) {
            this.raw.redirect(status, url);
        }
        else {
            this.raw.redirect(url);
        }
    };
    return ExpressResponseWrapper;
}());
