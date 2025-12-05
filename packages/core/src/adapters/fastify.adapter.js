"use strict";
/**
 * Fastify Framework Adapter
 *
 * Adapts NAuth to work with Fastify with proper AsyncLocalStorage support
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
exports.FastifyAdapter = void 0;
exports.withNAuthContext = withNAuthContext;
var context_storage_1 = require("../utils/context-storage");
var FastifyAdapter = /** @class */ (function () {
    function FastifyAdapter() {
    }
    /**
     * Register a middleware handler
     * Maps generic handler to Fastify Hook
     */
    FastifyAdapter.prototype.registerMiddleware = function (name, handler) {
        var _this = this;
        // Fastify hook signature
        return function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
            var nauthReq, nauthRes, existingStore;
            var _this = this;
            return __generator(this, function (_a) {
                nauthReq = new FastifyRequestWrapper(request);
                nauthRes = new FastifyResponseWrapper(reply);
                existingStore = request.__nauthContextStore;
                if (!existingStore) {
                    // First handler - create context
                    return [2 /*return*/, context_storage_1.ContextStorage.run(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        // Store the context on the request for other handlers and route handlers
                                        request.__nauthContextStore = context_storage_1.ContextStorage.getStore();
                                        return [4 /*yield*/, this.executeHandler(handler, nauthReq, nauthRes)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                else {
                    // Subsequent handler - reuse context
                    return [2 /*return*/, context_storage_1.ContextStorage.enterStore(existingStore, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.executeHandler(handler, nauthReq, nauthRes)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                return [2 /*return*/];
            });
        }); };
    };
    /**
     * Execute a handler with proper async handling
     */
    FastifyAdapter.prototype.executeHandler = function (handler, req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var nextCalled;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nextCalled = false;
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var result = handler(req, res, function () {
                                    nextCalled = true;
                                    resolve();
                                });
                                if (result instanceof Promise) {
                                    result
                                        .then(function () {
                                        if (!nextCalled) {
                                            resolve();
                                        }
                                    })
                                        .catch(reject);
                                }
                                else {
                                    if (!nextCalled) {
                                        resolve();
                                    }
                                }
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Register a response interceptor
     * Uses Fastify 'onSend' hook
     */
    FastifyAdapter.prototype.registerResponseInterceptor = function (handler) {
        var _this = this;
        // Fastify onSend hook: async (request, reply, payload)
        return function (request, reply, payload) { return __awaiter(_this, void 0, void 0, function () {
            var nauthReq, nauthRes, existingStore;
            var _this = this;
            return __generator(this, function (_a) {
                nauthReq = new FastifyRequestWrapper(request);
                nauthRes = new FastifyResponseWrapper(reply);
                existingStore = request.__nauthContextStore;
                if (existingStore) {
                    return [2 /*return*/, context_storage_1.ContextStorage.enterStore(existingStore, function () { return __awaiter(_this, void 0, void 0, function () {
                            var parsedPayload, contentType, isJson, modifiedBody, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        parsedPayload = payload;
                                        contentType = reply.getHeader('content-type');
                                        isJson = contentType && contentType.includes('application/json');
                                        if (isJson && typeof payload === 'string') {
                                            try {
                                                parsedPayload = JSON.parse(payload);
                                            }
                                            catch (_c) {
                                                // Not valid JSON, ignore
                                            }
                                        }
                                        return [4 /*yield*/, handler(nauthReq, nauthRes, parsedPayload)];
                                    case 1:
                                        modifiedBody = _b.sent();
                                        if (modifiedBody !== parsedPayload) {
                                            // If body modified, re-serialize if it was parsed
                                            if (isJson && typeof modifiedBody === 'object') {
                                                return [2 /*return*/, JSON.stringify(modifiedBody)];
                                            }
                                            return [2 /*return*/, modifiedBody];
                                        }
                                        return [2 /*return*/, payload];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, payload];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                // No context - just pass through
                return [2 /*return*/, payload];
            });
        }); };
    };
    /**
     * Create a global preHandler hook that restores context for ALL route handlers
     * This must be registered on the Fastify instance after NAuth hooks are registered
     */
    FastifyAdapter.prototype.createContextRestorationHook = function () {
        var _this = this;
        return function (request, _reply) { return __awaiter(_this, void 0, void 0, function () {
            var existingStore;
            return __generator(this, function (_a) {
                existingStore = request.__nauthContextStore;
                if (existingStore && !context_storage_1.ContextStorage.getStore()) {
                    // Restore context for route handlers
                    // We do this by storing a flag that the route execution should happen within this context
                    request.__nauthContextRestored = true;
                }
                return [2 /*return*/];
            });
        }); };
    };
    return FastifyAdapter;
}());
exports.FastifyAdapter = FastifyAdapter;
/**
 * Fastify Request Wrapper
 */
var FastifyRequestWrapper = /** @class */ (function () {
    function FastifyRequestWrapper(raw) {
        this.raw = raw;
    }
    Object.defineProperty(FastifyRequestWrapper.prototype, "body", {
        get: function () {
            return this.raw.body;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FastifyRequestWrapper.prototype, "query", {
        get: function () {
            return this.raw.query;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FastifyRequestWrapper.prototype, "params", {
        get: function () {
            return this.raw.params;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FastifyRequestWrapper.prototype, "headers", {
        get: function () {
            return this.raw.headers;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FastifyRequestWrapper.prototype, "cookies", {
        get: function () {
            // Fastify requires @fastify/cookie
            return this.raw.cookies || {};
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FastifyRequestWrapper.prototype, "ip", {
        get: function () {
            return this.raw.ip;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FastifyRequestWrapper.prototype, "attributes", {
        get: function () {
            // Attach to request object
            return this.raw;
        },
        enumerable: false,
        configurable: true
    });
    FastifyRequestWrapper.prototype.getHeader = function (name) {
        var val = this.raw.headers[name.toLowerCase()];
        if (Array.isArray(val))
            return val[0];
        return val;
    };
    return FastifyRequestWrapper;
}());
/**
 * Fastify Response Wrapper
 */
var FastifyResponseWrapper = /** @class */ (function () {
    function FastifyResponseWrapper(raw) {
        this.raw = raw;
    }
    FastifyResponseWrapper.prototype.status = function (code) {
        this.raw.code(code);
        return this;
    };
    FastifyResponseWrapper.prototype.header = function (name, value) {
        this.raw.header(name, value);
        return this;
    };
    FastifyResponseWrapper.prototype.setCookie = function (name, value, options) {
        // Fastify requires @fastify/cookie
        if (typeof this.raw.setCookie === 'function') {
            this.raw.setCookie(name, value, options);
        }
        return this;
    };
    FastifyResponseWrapper.prototype.clearCookie = function (name, options) {
        if (typeof this.raw.clearCookie === 'function') {
            this.raw.clearCookie(name, options);
        }
        else {
            // Manual clear if needed or if function differs
            // Usually clearCookie is available or we set empty cookie with maxAge=0
            this.raw.setCookie(name, '', __assign(__assign({}, options), { maxAge: 0, expires: new Date(0) }));
        }
        return this;
    };
    FastifyResponseWrapper.prototype.send = function (body) {
        this.raw.send(body);
    };
    FastifyResponseWrapper.prototype.json = function (body) {
        this.raw.send(body);
    };
    FastifyResponseWrapper.prototype.redirect = function (url, status) {
        if (status) {
            this.raw.redirect(status, url);
        }
        else {
            this.raw.redirect(url);
        }
    };
    return FastifyResponseWrapper;
}());
/**
 * Fastify route wrapper that ensures ContextStorage is available
 *
 * Use this to wrap your route handlers to ensure they have access to ContextStorage
 *
 * @example
 * ```typescript
 * import { withNAuthContext } from '@nauth-toolkit/core';
 *
 * fastify.get('/me', withNAuthContext(async (request, reply) => {
 *   const user = nauth.helpers.getCurrentUser();
 *   return user;
 * }));
 * ```
 */
function withNAuthContext(handler) {
    var _this = this;
    return function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
        var existingStore;
        var _this = this;
        return __generator(this, function (_a) {
            existingStore = request.__nauthContextStore;
            if (existingStore) {
                return [2 /*return*/, context_storage_1.ContextStorage.enterStore(existingStore, function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, handler(request, reply)];
                        });
                    }); })];
            }
            // No context available - just execute
            return [2 /*return*/, handler(request, reply)];
        });
    }); };
}
