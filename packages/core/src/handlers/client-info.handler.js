"use strict";
/**
 * Client Info Handler
 *
 * Extracts client information (IP, user agent, device info) from generic NAuthRequest
 * and stores in AsyncLocalStorage.
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
exports.ClientInfoHandler = void 0;
var index_1 = require("../index");
var ClientInfoHandler = /** @class */ (function () {
    function ClientInfoHandler(clientInfoService, geoLocationService, logger) {
        this.clientInfoService = clientInfoService;
        this.geoLocationService = geoLocationService;
        this.logger = logger;
    }
    ClientInfoHandler.prototype.handle = function (req, res, next) {
        return __awaiter(this, void 0, void 0, function () {
            var existingStore;
            var _this = this;
            return __generator(this, function (_a) {
                existingStore = req.attributes['__nauthContextStore'];
                if (existingStore) {
                    // Re-enter the existing context
                    return [2 /*return*/, index_1.ContextStorage.enterStore(existingStore, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.extractAndStore(req, res)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, next()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                // Initialize context storage for this request and save it
                return [2 /*return*/, index_1.ContextStorage.run(function () { return __awaiter(_this, void 0, void 0, function () {
                        var store;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    store = index_1.ContextStorage.getStore();
                                    if (store) {
                                        req.attributes['__nauthContextStore'] = store;
                                    }
                                    return [4 /*yield*/, this.extractAndStore(req, res)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, next()];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    ClientInfoHandler.prototype.extractAndStore = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userAgent, userAgentString, parsedUA, deviceTokenCookie, deviceTokenHeader, deviceToken, clientInfo, geo, error_1, error_2;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 5, , 6]);
                        userAgent = req.getHeader('user-agent');
                        userAgentString = typeof userAgent === 'string' ? userAgent : 'unknown';
                        parsedUA = this.clientInfoService.parseUserAgent(userAgentString);
                        deviceTokenCookie = req.cookies['nauth_device_id'];
                        deviceTokenHeader = req.getHeader('x-device-token') || req.getHeader('X-Device-Token');
                        deviceToken = deviceTokenCookie || deviceTokenHeader || undefined;
                        clientInfo = {
                            ipAddress: req.ip || (0, index_1.extractClientIp)(req.raw) || '0.0.0.0', // Fallback to raw if needed
                            userAgent: userAgentString,
                            deviceToken: deviceToken,
                            deviceName: ((_a = req.body) === null || _a === void 0 ? void 0 : _a.deviceName) || parsedUA.deviceName || undefined,
                            deviceType: ((_b = req.body) === null || _b === void 0 ? void 0 : _b.deviceType) || parsedUA.deviceType || undefined,
                            platform: parsedUA.platform || undefined,
                            browser: parsedUA.browser || undefined,
                            sessionId: undefined, // Set later by AuthHandler
                            ipCountry: undefined,
                            ipCity: undefined,
                        };
                        if (!(this.geoLocationService && clientInfo.ipAddress && clientInfo.ipAddress !== '0.0.0.0')) return [3 /*break*/, 4];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.geoLocationService.getIpGeolocation(clientInfo.ipAddress)];
                    case 2:
                        geo = _e.sent();
                        clientInfo.ipCountry = geo.country;
                        clientInfo.ipCity = geo.city;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _e.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        // Store in context
                        index_1.ContextStorage.set('CLIENT_INFO', clientInfo);
                        index_1.ContextStorage.set('HTTP_RESPONSE', res.raw); // Store raw response for services
                        // Attach to attributes for other handlers
                        req.attributes['clientInfo'] = clientInfo;
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _e.sent();
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.call(_c, 'Error extracting client info:', error_2);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return ClientInfoHandler;
}());
exports.ClientInfoHandler = ClientInfoHandler;
