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
exports.ResetPasswordDTO = exports.ResetPasswordRequestDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * Reset Password Request DTO
 *
 * Used to request a password reset token via email or phone.
 *
 * Security:
 * - Identifier validated (email or phone)
 * - Input sanitization applied
 *
 * @example
 * ```typescript
 * POST /auth/reset-password/request
 * {
 *   "identifier": "user@example.com"
 * }
 * ```
 */
var ResetPasswordRequestDTO = function () {
    var _a;
    var _identifier_decorators;
    var _identifier_initializers = [];
    var _identifier_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ResetPasswordRequestDTO() {
                /**
                 * User identifier (email or phone)
                 *
                 * Validation:
                 * - Must be a string
                 * - Min 1 character
                 * - Max 255 characters (matches DB constraint for email)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Lowercased if email format detected
                 */
                this.identifier = __runInitializers(this, _identifier_initializers, void 0); // email or phone
                __runInitializers(this, _identifier_extraInitializers);
            }
            return ResetPasswordRequestDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _identifier_decorators = [(0, class_validator_1.IsString)({ message: 'Identifier must be a string' }), (0, class_validator_1.IsNotEmpty)({ message: 'Identifier is required' }), (0, class_validator_1.MinLength)(1, { message: 'Identifier is required' }), (0, class_validator_1.MaxLength)(255, { message: 'Identifier must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        var trimmed = value.trim();
                        // If it contains @, treat as email and lowercase
                        if (trimmed.includes('@')) {
                            return trimmed.toLowerCase();
                        }
                        return trimmed;
                    }
                    return value;
                })];
            __esDecorate(null, null, _identifier_decorators, { kind: "field", name: "identifier", static: false, private: false, access: { has: function (obj) { return "identifier" in obj; }, get: function (obj) { return obj.identifier; }, set: function (obj, value) { obj.identifier = value; } }, metadata: _metadata }, _identifier_initializers, _identifier_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ResetPasswordRequestDTO = ResetPasswordRequestDTO;
/**
 * Reset Password DTO
 *
 * Used to reset password with a valid reset token.
 *
 * Security:
 * - Token length validated (matches DB constraint: varchar(255))
 * - Password strength enforced (8-128 chars)
 * - Token format validated in service layer
 *
 * @example
 * ```typescript
 * POST /auth/reset-password
 * {
 *   "token": "reset-token-from-email",
 *   "newPassword": "NewSecurePassword123!"
 * }
 * ```
 */
var ResetPasswordDTO = function () {
    var _a;
    var _token_decorators;
    var _token_initializers = [];
    var _token_extraInitializers = [];
    var _newPassword_decorators;
    var _newPassword_initializers = [];
    var _newPassword_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ResetPasswordDTO() {
                /**
                 * Password reset token from email
                 *
                 * Validation:
                 * - Must be a string
                 * - Min 1 character (prevents empty strings)
                 * - Max 255 characters (matches DB constraint: varchar(255))
                 *
                 * Sanitization:
                 * - Trimmed
                 *
                 * Note: Token format and validity validated in service layer
                 */
                this.token = __runInitializers(this, _token_initializers, void 0);
                /**
                 * New password
                 *
                 * Validation:
                 * - Must be a string
                 * - Min 8 characters (security requirement)
                 * - Max 128 characters (prevents DoS via bcrypt)
                 *
                 * Note: NOT trimmed (passwords can have leading/trailing spaces)
                 * Additional checks in service layer:
                 * - Password strength (if configured)
                 * - Password history (prevent reuse)
                 */
                this.newPassword = (__runInitializers(this, _token_extraInitializers), __runInitializers(this, _newPassword_initializers, void 0));
                __runInitializers(this, _newPassword_extraInitializers);
            }
            return ResetPasswordDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _token_decorators = [(0, class_validator_1.IsString)({ message: 'Token must be a string' }), (0, class_validator_1.IsNotEmpty)({ message: 'Token is required' }), (0, class_validator_1.MinLength)(1, { message: 'Token is required' }), (0, class_validator_1.MaxLength)(255, { message: 'Token must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _newPassword_decorators = [(0, class_validator_1.IsString)({ message: 'New password must be a string' }), (0, class_validator_1.IsNotEmpty)({ message: 'New password is required' }), (0, class_validator_1.MinLength)(8, { message: 'Password must be at least 8 characters' }), (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })];
            __esDecorate(null, null, _token_decorators, { kind: "field", name: "token", static: false, private: false, access: { has: function (obj) { return "token" in obj; }, get: function (obj) { return obj.token; }, set: function (obj, value) { obj.token = value; } }, metadata: _metadata }, _token_initializers, _token_extraInitializers);
            __esDecorate(null, null, _newPassword_decorators, { kind: "field", name: "newPassword", static: false, private: false, access: { has: function (obj) { return "newPassword" in obj; }, get: function (obj) { return obj.newPassword; }, set: function (obj, value) { obj.newPassword = value; } }, metadata: _metadata }, _newPassword_initializers, _newPassword_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ResetPasswordDTO = ResetPasswordDTO;
