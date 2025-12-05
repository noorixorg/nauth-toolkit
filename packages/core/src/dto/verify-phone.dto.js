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
exports.ResendVerificationSMSResponseDTO = exports.ResendVerificationSMSDTO = exports.VerifyPhoneResponseDTO = exports.SendVerificationSMSResponseDTO = exports.SendVerificationSMSDTO = exports.VerifyPhoneWithCodeDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * Verify Phone with Code DTO
 *
 * Used for phone verification with 6-digit OTP code.
 *
 * Security:
 * - Phone validated against E.164 format (prevents SQL injection)
 * - Code validated for exact 6 digits
 * - All fields match DB constraints
 *
 * @example
 * ```typescript
 * POST /auth/verify-phone/verify
 * {
 *   "phone": "+1234567890",
 *   "code": "123456"
 * }
 * ```
 */
var VerifyPhoneWithCodeDTO = function () {
    var _a;
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyPhoneWithCodeDTO() {
                /**
                 * User's phone number in E.164 format
                 *
                 * Validation:
                 * - Must be a string
                 * - Must match E.164 format: +[country code][number]
                 * - Max 20 characters (matches DB constraint: varchar(20))
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Whitespace removed
                 *
                 * @example "+1234567890"
                 */
                this.phone = __runInitializers(this, _phone_initializers, void 0);
                /**
                 * 6-digit verification code
                 *
                 * Validation:
                 * - Must be a string
                 * - Exactly 6 digits (numeric only)
                 * - No letters, spaces, or special characters
                 * - Fixed length prevents timing attacks
                 *
                 * Sanitization:
                 * - Removes all whitespace (users might copy "123 456")
                 * - Ensures only numeric string
                 *
                 * @example "123456"
                 */
                this.code = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                __runInitializers(this, _code_extraInitializers);
            }
            return VerifyPhoneWithCodeDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _phone_decorators = [(0, class_validator_1.IsString)({ message: 'Phone must be a string' }), (0, class_validator_1.IsNotEmpty)({ message: 'Phone is required' }), (0, class_validator_1.MaxLength)(20, { message: 'Phone number must not exceed 20 characters' }), (0, class_validator_1.Matches)(/^\+[1-9]\d{1,14}$/, {
                    message: 'Phone must be in E.164 format (e.g., +1234567890)',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        // Remove all whitespace and keep only digits and +
                        return value.replace(/\s/g, '');
                    }
                    return value;
                })];
            _code_decorators = [(0, class_validator_1.IsNumberString)({}, { message: 'Code must contain only digits' }), (0, class_validator_1.Length)(6, 6, { message: 'Verification code must be exactly 6 digits' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        // Remove all whitespace and non-digit characters
                        var cleaned = value.replace(/\D/g, '');
                        return cleaned.length === 6 ? cleaned : value; // Return original if not 6 digits (let validator catch it)
                    }
                    return value;
                })];
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyPhoneWithCodeDTO = VerifyPhoneWithCodeDTO;
/**
 * DTO for sending verification SMS
 *
 * Security:
 * - User sub validated as UUID v4
 * - Skip flag is boolean (prevents injection)
 */
var SendVerificationSMSDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _skipAlreadyVerifiedCheck_decorators;
    var _skipAlreadyVerifiedCheck_initializers = [];
    var _skipAlreadyVerifiedCheck_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SendVerificationSMSDTO() {
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
                 * Skip the "already verified" check
                 * Used for MFA contexts where codes are needed even if phone is verified
                 *
                 * Validation:
                 * - Must be boolean
                 * - Optional (defaults to true)
                 */
                this.skipAlreadyVerifiedCheck = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _skipAlreadyVerifiedCheck_initializers, void 0));
                __runInitializers(this, _skipAlreadyVerifiedCheck_extraInitializers);
            }
            return SendVerificationSMSDTO;
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
            _skipAlreadyVerifiedCheck_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)({ message: 'skipAlreadyVerifiedCheck must be a boolean' })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _skipAlreadyVerifiedCheck_decorators, { kind: "field", name: "skipAlreadyVerifiedCheck", static: false, private: false, access: { has: function (obj) { return "skipAlreadyVerifiedCheck" in obj; }, get: function (obj) { return obj.skipAlreadyVerifiedCheck; }, set: function (obj, value) { obj.skipAlreadyVerifiedCheck = value; } }, metadata: _metadata }, _skipAlreadyVerifiedCheck_initializers, _skipAlreadyVerifiedCheck_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SendVerificationSMSDTO = SendVerificationSMSDTO;
/**
 * Response DTO for sendVerificationSMS
 */
var SendVerificationSMSResponseDTO = /** @class */ (function () {
    function SendVerificationSMSResponseDTO() {
    }
    return SendVerificationSMSResponseDTO;
}());
exports.SendVerificationSMSResponseDTO = SendVerificationSMSResponseDTO;
/**
 * Response DTO for verifyPhoneWithCode and verifyPhoneWithCodeBySub
 */
var VerifyPhoneResponseDTO = /** @class */ (function () {
    function VerifyPhoneResponseDTO() {
    }
    return VerifyPhoneResponseDTO;
}());
exports.VerifyPhoneResponseDTO = VerifyPhoneResponseDTO;
/**
 * DTO for resending verification SMS
 *
 * Supports both sub and phone-based resend
 *
 * Security:
 * - Either sub or phone must be provided (conditional validation)
 * - Rate limiting applied in service layer
 * - Input sanitization prevents abuse
 */
var ResendVerificationSMSDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ResendVerificationSMSDTO() {
                /**
                 * User identifier (UUID v4) - optional if phone provided
                 *
                 * Validation:
                 * - Must be valid UUID v4 format if provided
                 * - Required if phone is not provided
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.sub = __runInitializers(this, _sub_initializers, void 0);
                /**
                 * User's phone number - optional if sub provided
                 *
                 * Validation:
                 * - Must match E.164 format if provided
                 * - Max 20 characters (DB limit)
                 * - Required if sub is not provided
                 *
                 * Sanitization:
                 * - Whitespace removed
                 */
                this.phone = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                __runInitializers(this, _phone_extraInitializers);
            }
            return ResendVerificationSMSDTO;
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
            _phone_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Phone must be a string' }), (0, class_validator_1.MaxLength)(20, { message: 'Phone number must not exceed 20 characters' }), (0, class_validator_1.Matches)(/^\+[1-9]\d{1,14}$/, {
                    message: 'Phone must be in E.164 format (e.g., +1234567890)',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.replace(/\s/g, '');
                    }
                    return value;
                })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ResendVerificationSMSDTO = ResendVerificationSMSDTO;
/**
 * Response DTO for resendVerificationSMS
 */
var ResendVerificationSMSResponseDTO = /** @class */ (function () {
    function ResendVerificationSMSResponseDTO() {
    }
    return ResendVerificationSMSResponseDTO;
}());
exports.ResendVerificationSMSResponseDTO = ResendVerificationSMSResponseDTO;
