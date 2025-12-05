"use strict";
/**
 * NAuth Bootstrap
 *
 * Entry point for initializing NAuth with platform adapters.
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
exports.NAuth = void 0;
var nauth_logger_1 = require("./utils/nauth-logger");
var nauth_exception_1 = require("./exceptions/nauth.exception");
var error_codes_enum_1 = require("./enums/error-codes.enum");
var express_adapter_1 = require("./adapters/express.adapter");
var context_storage_1 = require("./utils/context-storage");
// Handlers
var client_info_handler_1 = require("./handlers/client-info.handler");
var auth_handler_1 = require("./handlers/auth.handler");
var token_delivery_handler_1 = require("./handlers/token-delivery.handler");
var csrf_handler_1 = require("./handlers/csrf.handler");
var csrf_service_1 = require("./services/csrf.service");
// Setup Helpers
var get_repositories_1 = require("./utils/setup/get-repositories");
var init_storage_1 = require("./utils/setup/init-storage");
var init_services_1 = require("./utils/setup/init-services");
var register_mfa_1 = require("./utils/setup/register-mfa");
var init_social_1 = require("./utils/setup/init-social");
var internal_1 = require("./internal");
var NAuth = /** @class */ (function () {
    function NAuth() {
    }
    /**
     * Create NAuth instance
     */
    NAuth.create = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var config, dataSource, adapter, logger, repos, storage, emailProvider, smsProvider, services, contextBuilder, stateMachine, socialAuthStateStore, socialProviders, clientInfoHandler, authHandler, tokenDeliveryHandler, csrfService, csrfHandler, middleware, helpers, challengeService, authChallengeHelperService, publicServices;
            var _this = this;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        config = options.config, dataSource = options.dataSource;
                        adapter = options.adapter || new express_adapter_1.ExpressAdapter();
                        logger = new nauth_logger_1.NAuthLogger(config.logger);
                        logger.log("Initializing NAuth with ".concat(adapter.constructor.name, "..."));
                        repos = (0, get_repositories_1.getRepositories)(dataSource);
                        return [4 /*yield*/, (0, init_storage_1.initStorage)(config, repos.rateLimitRepository, repos.storageLockRepository, logger)];
                    case 1:
                        storage = _d.sent();
                        emailProvider = config.emailProvider;
                        smsProvider = config.smsProvider;
                        services = (0, init_services_1.initServices)(config, repos, storage, logger, emailProvider, smsProvider);
                        contextBuilder = new internal_1.AuthFlowContextBuilder(services.trustedDeviceService, services.adaptiveMFADecisionService, services.clientInfoService, logger);
                        stateMachine = new internal_1.AuthFlowStateMachineService(contextBuilder, logger);
                        if (services.authChallengeHelperService) {
                            services.authChallengeHelperService.stateMachine = stateMachine;
                            services.authChallengeHelperService.contextBuilder = contextBuilder;
                        }
                        else {
                            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, 'AuthChallengeHelperService not initialized.');
                        }
                        socialAuthStateStore = new Map();
                        if (!(((_a = config.mfa) === null || _a === void 0 ? void 0 : _a.enabled) && services.mfaService)) return [3 /*break*/, 3];
                        return [4 /*yield*/, (0, register_mfa_1.registerMFAProviders)(config, services.mfaService, repos.mfaDeviceRepository, repos.userRepository, logger, services.passwordService, services.emailVerificationService, services.phoneVerificationService, services.challengeService, services.auditService, services.clientInfoService)];
                    case 2:
                        _d.sent();
                        _d.label = 3;
                    case 3: return [4 /*yield*/, (0, init_social_1.initSocialAuth)(config, services.socialProviderRegistry, services.authService, services.socialAuthService, services.jwtService, services.sessionService, services.authChallengeHelperService, services.clientInfoService, logger, socialAuthStateStore, repos.userRepository, services.phoneVerificationService, services.auditService)];
                    case 4:
                        socialProviders = _d.sent();
                        clientInfoHandler = new client_info_handler_1.ClientInfoHandler(services.clientInfoService, services.geoLocationService, logger);
                        authHandler = new auth_handler_1.AuthHandler(services.jwtService, services.sessionService, repos.userRepository, config, logger);
                        tokenDeliveryHandler = new token_delivery_handler_1.TokenDeliveryHandler(config, logger);
                        csrfService = ((_b = config.tokenDelivery) === null || _b === void 0 ? void 0 : _b.method) === 'cookies' || ((_c = config.tokenDelivery) === null || _c === void 0 ? void 0 : _c.method) === 'hybrid'
                            ? new csrf_service_1.CsrfService(config)
                            : undefined;
                        csrfHandler = csrfService ? new csrf_handler_1.CsrfHandler(csrfService, config, logger) : null;
                        middleware = {
                            clientInfo: adapter.registerMiddleware('clientInfo', clientInfoHandler.handle.bind(clientInfoHandler)),
                            auth: adapter.registerMiddleware('auth', authHandler.handle.bind(authHandler)),
                            csrf: csrfHandler
                                ? adapter.registerMiddleware('csrf', csrfHandler.handle.bind(csrfHandler))
                                : adapter.registerMiddleware('noop', function (_req, _res, next) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, next()];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); }),
                            tokenDelivery: adapter.registerResponseInterceptor(tokenDeliveryHandler.handleResponse.bind(tokenDeliveryHandler)),
                        };
                        helpers = {
                            public: function () {
                                return adapter.registerMiddleware('public', function (req, _res, next) {
                                    // Ensure nauthPublic is set on both the wrapper and underlying raw request if possible
                                    req.attributes['nauthPublic'] = true;
                                    // For adapters like Express that use raw request as attributes store, this is enough.
                                    // But if we have other adapters, we need to ensure this persists.
                                    return next();
                                });
                            },
                            requireAuth: function (options) {
                                return adapter.registerMiddleware('requireAuth', function (req, res, next) {
                                    // 1. Enforce Deferred CSRF Check (unless disabled)
                                    if ((options === null || options === void 0 ? void 0 : options.csrf) !== false && req.attributes['nauthCsrfError']) {
                                        throw req.attributes['nauthCsrfError'];
                                    }
                                    // 2. Enforce Authentication
                                    if (!req.attributes['user']) {
                                        // If not authenticated, return 401
                                        // Logic can be more complex (check generic response helper?)
                                        // For now simple 401
                                        res.status(401).json({
                                            statusCode: 401,
                                            error: 'Unauthorized',
                                            message: 'Authentication required',
                                            code: 'AUTH_REQUIRED',
                                        });
                                        return;
                                    }
                                    return next();
                                });
                            },
                            optionalAuth: function () {
                                return adapter.registerMiddleware('optionalAuth', function (_req, _res, next) {
                                    // Auth middleware already does optional auth by default.
                                    // This helper is usually just a marker or explicitly ensures auth middleware ran.
                                    return next();
                                });
                            },
                            tokenDelivery: function (mode) {
                                return adapter.registerMiddleware('tokenDeliveryConfig', function (req, _res, next) {
                                    req.attributes['nauthTokenDelivery'] = mode;
                                    return next();
                                });
                            },
                            // Context helpers (work anywhere - read from ContextStorage)
                            getCurrentUser: function () { return context_storage_1.ContextStorage.get('CURRENT_USER'); },
                            getCurrentSession: function () { return context_storage_1.ContextStorage.get('CURRENT_SESSION'); },
                            getClientInfo: function () { return context_storage_1.ContextStorage.get('CLIENT_INFO'); },
                        };
                        challengeService = services.challengeService, authChallengeHelperService = services.authChallengeHelperService, publicServices = __rest(services, ["challengeService", "authChallengeHelperService"]);
                        return [2 /*return*/, __assign(__assign(__assign({}, publicServices), socialProviders), { middleware: middleware, helpers: helpers, config: config, logger: logger, socialAuthService: services.socialAuthService, csrfService: csrfService })];
                }
            });
        });
    };
    return NAuth;
}());
exports.NAuth = NAuth;
