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
exports.VerifyEmailResponseDTO = exports.ResendVerificationEmailResponseDTO = exports.ResendVerificationEmailDTO = exports.SendVerificationEmailResponseDTO = exports.SendVerificationEmailDTO = exports.VerifyEmailWithTokenDTO = exports.VerifyEmailWithCodeDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for verifying email with code (6-digit OTP)
 *
 * Security:
 * - Email must be valid format and match DB limits
 * - Code must be exactly 6 digits (no more, no less)
 * - All fields are required (no optional fields to prevent attacks)
 * - Input sanitization applied automatically
 */
var VerifyEmailWithCodeDTO = function () {
    var _a;
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyEmailWithCodeDTO() {
                /**
                 * User's email address
                 * Must match the email used during signup
                 *
                 * Validation:
                 * - Valid email format (RFC 5322)
                 * - Max 255 characters (matches DB column limit)
                 * - Automatically trimmed and lowercased
                 *
                 * Sanitization:
                 * - Removes leading/trailing whitespace
                 * - Converts to lowercase for case-insensitive matching
                 */
                this.email = __runInitializers(this, _email_initializers, void 0);
                /**
                 * 6-digit verification code from email
                 *
                 * Validation:
                 * - Must be numeric string (digits only)
                 * - Exactly 6 characters long
                 * - Fixed length prevents timing attacks
                 *
                 * Sanitization:
                 * - Removes all whitespace (users might copy "123 456")
                 * - Removes non-digit characters
                 */
                this.code = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                __runInitializers(this, _code_extraInitializers);
            }
            return VerifyEmailWithCodeDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _email_decorators = [(0, class_validator_1.IsEmail)({}, { message: 'Invalid email format' }), (0, class_validator_1.MaxLength)(255, { message: 'Email must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _code_decorators = [(0, class_validator_1.IsNumberString)({}, { message: 'Verification code must contain only digits' }), (0, class_validator_1.MaxLength)(6, { message: 'Verification code must be exactly 6 digits' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        // Remove all whitespace and non-digit characters, then validate length
                        var cleaned = value.replace(/\D/g, '');
                        return cleaned.length === 6 ? cleaned : value; // Return original if not 6 digits (let validator catch it)
                    }
                    return value;
                })];
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyEmailWithCodeDTO = VerifyEmailWithCodeDTO;
/**
 * DTO for verifying email with URL token
 *
 * Security:
 * - Token must be valid hex format
 * - Exact length enforced (64 chars = 32 bytes SHA-256 hash)
 * - No SQL injection or XSS possible
 * - Input sanitization prevents malformed tokens
 */
var VerifyEmailWithTokenDTO = function () {
    var _a;
    var _token_decorators;
    var _token_initializers = [];
    var _token_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyEmailWithTokenDTO() {
                /**
                 * Verification token from email link
                 *
                 * Validation:
                 * - Exactly 64 hexadecimal characters (SHA-256 hash output)
                 * - Only 0-9 and a-f characters allowed
                 * - Case-insensitive
                 *
                 * Sanitization:
                 * - Removes whitespace
                 * - Converts to lowercase for consistent hashing
                 */
                this.token = __runInitializers(this, _token_initializers, void 0);
                __runInitializers(this, _token_extraInitializers);
            }
            return VerifyEmailWithTokenDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _token_decorators = [(0, class_validator_1.IsString)({ message: 'Token must be a string' }), (0, class_validator_1.Length)(64, 64, { message: 'Invalid token format' }), (0, class_validator_1.Matches)(/^[a-f0-9]{64}$/i, {
                    message: 'Token must be a valid hexadecimal string',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _token_decorators, { kind: "field", name: "token", static: false, private: false, access: { has: function (obj) { return "token" in obj; }, get: function (obj) { return obj.token; }, set: function (obj, value) { obj.token = value; } }, metadata: _metadata }, _token_initializers, _token_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyEmailWithTokenDTO = VerifyEmailWithTokenDTO;
/**
 * DTO for sending a verification email
 *
 * Security:
 * - User sub validated as UUID v4
 * - BaseURL validated as max length
 * - Skip flag is boolean (prevents injection)
 */
var SendVerificationEmailDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _baseUrl_decorators;
    var _baseUrl_initializers = [];
    var _baseUrl_extraInitializers = [];
    var _skipAlreadyVerifiedCheck_decorators;
    var _skipAlreadyVerifiedCheck_initializers = [];
    var _skipAlreadyVerifiedCheck_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SendVerificationEmailDTO() {
                /**
                 * User identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be valid UUID v4 format
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.sub = __runInitializers(this, _sub_initializers, void 0);
                /**
                 * Base URL for verification link (optional)
                 *
                 * Validation:
                 * - Must be valid URL format (http:// or https://)
                 * - Max 2048 characters (typical URL length limit)
                 * - Optional field
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.baseUrl = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _baseUrl_initializers, void 0));
                /**
                 * Skip the "already verified" check
                 * Used for MFA contexts where codes are needed even if email is verified
                 *
                 * Validation:
                 * - Must be boolean
                 * - Optional (defaults to false)
                 */
                this.skipAlreadyVerifiedCheck = (__runInitializers(this, _baseUrl_extraInitializers), __runInitializers(this, _skipAlreadyVerifiedCheck_initializers, void 0));
                __runInitializers(this, _skipAlreadyVerifiedCheck_extraInitializers);
            }
            return SendVerificationEmailDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _sub_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _baseUrl_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUrl)({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Base URL must be a valid URL with http:// or https://' }), (0, class_validator_1.MaxLength)(2048, { message: 'Base URL must not exceed 2048 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _skipAlreadyVerifiedCheck_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)({ message: 'skipAlreadyVerifiedCheck must be a boolean' })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _baseUrl_decorators, { kind: "field", name: "baseUrl", static: false, private: false, access: { has: function (obj) { return "baseUrl" in obj; }, get: function (obj) { return obj.baseUrl; }, set: function (obj, value) { obj.baseUrl = value; } }, metadata: _metadata }, _baseUrl_initializers, _baseUrl_extraInitializers);
            __esDecorate(null, null, _skipAlreadyVerifiedCheck_decorators, { kind: "field", name: "skipAlreadyVerifiedCheck", static: false, private: false, access: { has: function (obj) { return "skipAlreadyVerifiedCheck" in obj; }, get: function (obj) { return obj.skipAlreadyVerifiedCheck; }, set: function (obj, value) { obj.skipAlreadyVerifiedCheck = value; } }, metadata: _metadata }, _skipAlreadyVerifiedCheck_initializers, _skipAlreadyVerifiedCheck_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SendVerificationEmailDTO = SendVerificationEmailDTO;
/**
 * Response DTO for sendVerificationEmail
 */
var SendVerificationEmailResponseDTO = /** @class */ (function () {
    function SendVerificationEmailResponseDTO() {
    }
    return SendVerificationEmailResponseDTO;
}());
exports.SendVerificationEmailResponseDTO = SendVerificationEmailResponseDTO;
/**
 * DTO for requesting a verification email resend
 *
 * Supports both overload patterns:
 * 1. Resend by user sub (string)
 * 2. Resend by email address (object with email property)
 *
 * Security:
 * - Either sub or email must be provided (conditional validation)
 * - Rate limiting applied in service layer
 * - Input sanitization prevents abuse
 */
var ResendVerificationEmailDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _baseUrl_decorators;
    var _baseUrl_initializers = [];
    var _baseUrl_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ResendVerificationEmailDTO() {
                /**
                 * User identifier (UUID v4) - optional if email provided
                 *
                 * Validation:
                 * - Must be valid UUID v4 format if provided
                 * - Required if email is not provided
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.sub = __runInitializers(this, _sub_initializers, void 0);
                /**
                 * User's email address - optional if sub provided
                 *
                 * Validation:
                 * - Valid email format if provided
                 * - Max 255 characters (DB limit)
                 * - Required if sub is not provided
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.email = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                /**
                 * Base URL for verification link (optional)
                 *
                 * Validation:
                 * - Must be valid URL format (http:// or https://)
                 * - Max 2048 characters
                 * - Optional field
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.baseUrl = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _baseUrl_initializers, void 0));
                __runInitializers(this, _baseUrl_extraInitializers);
            }
            return ResendVerificationEmailDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _sub_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('4', { message: 'User ID must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _email_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEmail)({}, { message: 'Invalid email format' }), (0, class_validator_1.MaxLength)(255, { message: 'Email must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _baseUrl_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUrl)({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Base URL must be a valid URL with http:// or https://' }), (0, class_validator_1.MaxLength)(2048, { message: 'Base URL must not exceed 2048 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _baseUrl_decorators, { kind: "field", name: "baseUrl", static: false, private: false, access: { has: function (obj) { return "baseUrl" in obj; }, get: function (obj) { return obj.baseUrl; }, set: function (obj, value) { obj.baseUrl = value; } }, metadata: _metadata }, _baseUrl_initializers, _baseUrl_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ResendVerificationEmailDTO = ResendVerificationEmailDTO;
/**
 * Response DTO for resendVerificationEmail
 */
var ResendVerificationEmailResponseDTO = /** @class */ (function () {
    function ResendVerificationEmailResponseDTO() {
    }
    return ResendVerificationEmailResponseDTO;
}());
exports.ResendVerificationEmailResponseDTO = ResendVerificationEmailResponseDTO;
/**
 * Response DTO for verifyEmailWithCode and verifyEmailWithToken
 */
var VerifyEmailResponseDTO = /** @class */ (function () {
    function VerifyEmailResponseDTO() {
    }
    return VerifyEmailResponseDTO;
}());
exports.VerifyEmailResponseDTO = VerifyEmailResponseDTO;
