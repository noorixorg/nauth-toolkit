"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetPasswordForSocialUserResponseDTO = exports.SetPasswordForSocialUserDTO = exports.CanSetPasswordResponseDTO = exports.CanSetPasswordDTO = exports.UnlinkSocialAccountResponseDTO = exports.UnlinkSocialAccountDTO = exports.GetLinkedAccountsResponseDTO = exports.GetLinkedAccountsDTO = exports.LinkSocialAccountResponseDTO = exports.LinkSocialAccountDTO = exports.HandleSocialCallbackDTO = exports.GetSocialAuthUrlResponseDTO = exports.GetSocialAuthUrlDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for getting social authentication URL
 *
 * Security:
 * - Provider name validated as string
 * - State parameter validated for length (CSRF protection)
 */
var GetSocialAuthUrlDTO = function () {
    var _a;
    var _provider_decorators;
    var _provider_initializers = [];
    var _provider_extraInitializers = [];
    var _state_decorators;
    var _state_initializers = [];
    var _state_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GetSocialAuthUrlDTO() {
                /**
                 * Social provider name (e.g., 'google', 'apple', 'facebook')
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 50 characters
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.provider = __runInitializers(this, _provider_initializers, void 0);
                /**
                 * Optional CSRF state parameter
                 *
                 * Validation:
                 * - Max 500 characters (typical state token length)
                 * - Optional field
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.state = (__runInitializers(this, _provider_extraInitializers), __runInitializers(this, _state_initializers, void 0));
                __runInitializers(this, _state_extraInitializers);
            }
            return GetSocialAuthUrlDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _provider_decorators = [(0, class_validator_1.IsString)({ message: 'Provider must be a string' }), (0, class_validator_1.MaxLength)(50, { message: 'Provider name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _state_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'State must be a string' }), (0, class_validator_1.MaxLength)(500, { message: 'State must not exceed 500 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            __esDecorate(null, null, _provider_decorators, { kind: "field", name: "provider", static: false, private: false, access: { has: function (obj) { return "provider" in obj; }, get: function (obj) { return obj.provider; }, set: function (obj, value) { obj.provider = value; } }, metadata: _metadata }, _provider_initializers, _provider_extraInitializers);
            __esDecorate(null, null, _state_decorators, { kind: "field", name: "state", static: false, private: false, access: { has: function (obj) { return "state" in obj; }, get: function (obj) { return obj.state; }, set: function (obj, value) { obj.state = value; } }, metadata: _metadata }, _state_initializers, _state_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GetSocialAuthUrlDTO = GetSocialAuthUrlDTO;
/**
 * Response DTO for getSocialAuthUrl
 */
var GetSocialAuthUrlResponseDTO = /** @class */ (function () {
    function GetSocialAuthUrlResponseDTO() {
    }
    return GetSocialAuthUrlResponseDTO;
}());
exports.GetSocialAuthUrlResponseDTO = GetSocialAuthUrlResponseDTO;
/**
 * DTO for handling social authentication callback
 *
 * Security:
 * - Provider name validated
 * - Code validated for length
 * - State validated for CSRF protection
 */
var HandleSocialCallbackDTO = function () {
    var _a;
    var _provider_decorators;
    var _provider_initializers = [];
    var _provider_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _state_decorators;
    var _state_initializers = [];
    var _state_extraInitializers = [];
    return _a = /** @class */ (function () {
            function HandleSocialCallbackDTO() {
                /**
                 * Social provider name (e.g., 'google', 'apple', 'facebook')
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 50 characters
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.provider = __runInitializers(this, _provider_initializers, void 0);
                /**
                 * Authorization code from OAuth callback
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 1000 characters (OAuth codes can be long)
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.code = (__runInitializers(this, _provider_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                /**
                 * State parameter from OAuth callback (for CSRF validation)
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 500 characters
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.state = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _state_initializers, void 0));
                __runInitializers(this, _state_extraInitializers);
            }
            return HandleSocialCallbackDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _provider_decorators = [(0, class_validator_1.IsString)({ message: 'Provider must be a string' }), (0, class_validator_1.MaxLength)(50, { message: 'Provider name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _code_decorators = [(0, class_validator_1.IsString)({ message: 'Code must be a string' }), (0, class_validator_1.MaxLength)(1000, { message: 'Authorization code must not exceed 1000 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _state_decorators = [(0, class_validator_1.IsString)({ message: 'State must be a string' }), (0, class_validator_1.MaxLength)(500, { message: 'State must not exceed 500 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            __esDecorate(null, null, _provider_decorators, { kind: "field", name: "provider", static: false, private: false, access: { has: function (obj) { return "provider" in obj; }, get: function (obj) { return obj.provider; }, set: function (obj, value) { obj.provider = value; } }, metadata: _metadata }, _provider_initializers, _provider_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _state_decorators, { kind: "field", name: "state", static: false, private: false, access: { has: function (obj) { return "state" in obj; }, get: function (obj) { return obj.state; }, set: function (obj, value) { obj.state = value; } }, metadata: _metadata }, _state_initializers, _state_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.HandleSocialCallbackDTO = HandleSocialCallbackDTO;
/**
 * DTO for linking social account
 *
 * Security:
 * - User ID validated as UUID v4
 * - Provider name validated
 * - Code and state validated for length
 */
var LinkSocialAccountDTO = function () {
    var _a;
    var _userId_decorators;
    var _userId_initializers = [];
    var _userId_extraInitializers = [];
    var _provider_decorators;
    var _provider_initializers = [];
    var _provider_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _state_decorators;
    var _state_initializers = [];
    var _state_extraInitializers = [];
    return _a = /** @class */ (function () {
            function LinkSocialAccountDTO() {
                /**
                 * User identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be valid UUID v4 format
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.userId = __runInitializers(this, _userId_initializers, void 0);
                /**
                 * Social provider name (e.g., 'google', 'apple', 'facebook')
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 50 characters
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.provider = (__runInitializers(this, _userId_extraInitializers), __runInitializers(this, _provider_initializers, void 0));
                /**
                 * Authorization code from OAuth callback
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 1000 characters
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.code = (__runInitializers(this, _provider_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                /**
                 * State parameter from OAuth callback (for CSRF validation)
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 500 characters
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.state = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _state_initializers, void 0));
                __runInitializers(this, _state_extraInitializers);
            }
            return LinkSocialAccountDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userId_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _provider_decorators = [(0, class_validator_1.IsString)({ message: 'Provider must be a string' }), (0, class_validator_1.MaxLength)(50, { message: 'Provider name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _code_decorators = [(0, class_validator_1.IsString)({ message: 'Code must be a string' }), (0, class_validator_1.MaxLength)(1000, { message: 'Authorization code must not exceed 1000 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _state_decorators = [(0, class_validator_1.IsString)({ message: 'State must be a string' }), (0, class_validator_1.MaxLength)(500, { message: 'State must not exceed 500 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: function (obj) { return "userId" in obj; }, get: function (obj) { return obj.userId; }, set: function (obj, value) { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            __esDecorate(null, null, _provider_decorators, { kind: "field", name: "provider", static: false, private: false, access: { has: function (obj) { return "provider" in obj; }, get: function (obj) { return obj.provider; }, set: function (obj, value) { obj.provider = value; } }, metadata: _metadata }, _provider_initializers, _provider_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _state_decorators, { kind: "field", name: "state", static: false, private: false, access: { has: function (obj) { return "state" in obj; }, get: function (obj) { return obj.state; }, set: function (obj, value) { obj.state = value; } }, metadata: _metadata }, _state_initializers, _state_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.LinkSocialAccountDTO = LinkSocialAccountDTO;
/**
 * Response DTO for linkSocialAccount
 */
var LinkSocialAccountResponseDTO = /** @class */ (function () {
    function LinkSocialAccountResponseDTO() {
    }
    return LinkSocialAccountResponseDTO;
}());
exports.LinkSocialAccountResponseDTO = LinkSocialAccountResponseDTO;
/**
 * DTO for getting linked social accounts
 *
 * Security:
 * - User ID validated as UUID v4
 */
var GetLinkedAccountsDTO = function () {
    var _a;
    var _userId_decorators;
    var _userId_initializers = [];
    var _userId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GetLinkedAccountsDTO() {
                /**
                 * User identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be valid UUID v4 format
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.userId = __runInitializers(this, _userId_initializers, void 0);
                __runInitializers(this, _userId_extraInitializers);
            }
            return GetLinkedAccountsDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userId_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: function (obj) { return "userId" in obj; }, get: function (obj) { return obj.userId; }, set: function (obj, value) { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GetLinkedAccountsDTO = GetLinkedAccountsDTO;
/**
 * Response DTO for getLinkedAccounts
 */
var GetLinkedAccountsResponseDTO = /** @class */ (function () {
    function GetLinkedAccountsResponseDTO() {
    }
    return GetLinkedAccountsResponseDTO;
}());
exports.GetLinkedAccountsResponseDTO = GetLinkedAccountsResponseDTO;
/**
 * DTO for unlinking social account
 *
 * Security:
 * - User ID validated as UUID v4
 * - Provider name validated
 */
var UnlinkSocialAccountDTO = function () {
    var _a;
    var _userId_decorators;
    var _userId_initializers = [];
    var _userId_extraInitializers = [];
    var _provider_decorators;
    var _provider_initializers = [];
    var _provider_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UnlinkSocialAccountDTO() {
                /**
                 * User identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be valid UUID v4 format
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.userId = __runInitializers(this, _userId_initializers, void 0);
                /**
                 * Social provider name (e.g., 'google', 'apple', 'facebook')
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Max 50 characters
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.provider = (__runInitializers(this, _userId_extraInitializers), __runInitializers(this, _provider_initializers, void 0));
                __runInitializers(this, _provider_extraInitializers);
            }
            return UnlinkSocialAccountDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userId_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _provider_decorators = [(0, class_validator_1.IsString)({ message: 'Provider must be a string' }), (0, class_validator_1.MaxLength)(50, { message: 'Provider name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: function (obj) { return "userId" in obj; }, get: function (obj) { return obj.userId; }, set: function (obj, value) { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            __esDecorate(null, null, _provider_decorators, { kind: "field", name: "provider", static: false, private: false, access: { has: function (obj) { return "provider" in obj; }, get: function (obj) { return obj.provider; }, set: function (obj, value) { obj.provider = value; } }, metadata: _metadata }, _provider_initializers, _provider_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UnlinkSocialAccountDTO = UnlinkSocialAccountDTO;
/**
 * Response DTO for unlinkSocialAccount
 */
var UnlinkSocialAccountResponseDTO = /** @class */ (function () {
    function UnlinkSocialAccountResponseDTO() {
    }
    return UnlinkSocialAccountResponseDTO;
}());
exports.UnlinkSocialAccountResponseDTO = UnlinkSocialAccountResponseDTO;
/**
 * DTO for checking if user can set password
 *
 * Security:
 * - User ID validated as UUID v4
 */
var CanSetPasswordDTO = function () {
    var _a;
    var _userId_decorators;
    var _userId_initializers = [];
    var _userId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CanSetPasswordDTO() {
                /**
                 * User identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be valid UUID v4 format
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.userId = __runInitializers(this, _userId_initializers, void 0);
                __runInitializers(this, _userId_extraInitializers);
            }
            return CanSetPasswordDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userId_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: function (obj) { return "userId" in obj; }, get: function (obj) { return obj.userId; }, set: function (obj, value) { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CanSetPasswordDTO = CanSetPasswordDTO;
/**
 * Response DTO for canSetPassword
 */
var CanSetPasswordResponseDTO = /** @class */ (function () {
    function CanSetPasswordResponseDTO() {
    }
    return CanSetPasswordResponseDTO;
}());
exports.CanSetPasswordResponseDTO = CanSetPasswordResponseDTO;
/**
 * DTO for setting password for social-only user
 *
 * Security:
 * - User ID validated as UUID v4
 * - Password validated for strength (delegated to AuthService)
 */
var SetPasswordForSocialUserDTO = function () {
    var _a;
    var _userId_decorators;
    var _userId_initializers = [];
    var _userId_extraInitializers = [];
    var _password_decorators;
    var _password_initializers = [];
    var _password_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SetPasswordForSocialUserDTO() {
                /**
                 * User identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be valid UUID v4 format
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.userId = __runInitializers(this, _userId_initializers, void 0);
                /**
                 * New password
                 *
                 * Validation:
                 * - Must be non-empty string
                 * - Min 1 character (actual validation in AuthService)
                 * - Max 128 characters (matches DB constraint)
                 *
                 * Sanitization:
                 * - Not trimmed (passwords may have leading/trailing spaces intentionally)
                 */
                this.password = (__runInitializers(this, _userId_extraInitializers), __runInitializers(this, _password_initializers, void 0));
                __runInitializers(this, _password_extraInitializers);
            }
            return SetPasswordForSocialUserDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userId_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _password_decorators = [(0, class_validator_1.IsString)({ message: 'Password must be a string' }), (0, class_validator_1.MinLength)(1, { message: 'Password is required' }), (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })];
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: function (obj) { return "userId" in obj; }, get: function (obj) { return obj.userId; }, set: function (obj, value) { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } }, metadata: _metadata }, _password_initializers, _password_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SetPasswordForSocialUserDTO = SetPasswordForSocialUserDTO;
/**
 * Response DTO for setPasswordForSocialUser
 */
var SetPasswordForSocialUserResponseDTO = /** @class */ (function () {
    function SetPasswordForSocialUserResponseDTO() {
    }
    return SetPasswordForSocialUserResponseDTO;
}());
exports.SetPasswordForSocialUserResponseDTO = SetPasswordForSocialUserResponseDTO;
