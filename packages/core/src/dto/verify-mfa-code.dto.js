"use strict";
/**
 * DTO for verifying MFA code
 *
 * Used to verify MFA code using the appropriate provider.
 * Routes verification to the correct provider based on method name.
 *
 * @example
 * ```typescript
 * const isValid = await mfaService.verifyCode({
 *   sub: 'user-uuid',
 *   methodName: 'totp',
 *   code: '123456',
 *   deviceId: 1
 * });
 * ```
 */
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
exports.VerifyMFACodeResponseDTO = exports.VerifyMFACodeDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * DTO for verifying MFA code
 */
var VerifyMFACodeDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _methodName_decorators;
    var _methodName_initializers = [];
    var _methodName_extraInitializers = [];
    var _deviceId_decorators;
    var _deviceId_initializers = [];
    var _deviceId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyMFACodeDTO() {
                /**
                 * User's unique identifier (UUID v4)
                 *
                 * Validation:
                 * - Must be a valid UUID v4 format
                 * - Matches DB constraint: char(36) or uuid
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Lowercased for consistency
                 *
                 * @example "a21b654c-2746-4168-acee-c175083a65cd"
                 */
                this.sub = __runInitializers(this, _sub_initializers, void 0);
                /**
                 * MFA method name
                 *
                 * Validation:
                 * - Must be one of: totp, sms, email, passkey, backup
                 * - Max 50 characters
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 *
                 * @example "totp"
                 */
                this.methodName = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _methodName_initializers, void 0));
                /**
                 * Verification code or credential (provider-specific)
                 *
                 * Validation:
                 * - Must be a string or object depending on method
                 * - For TOTP/SMS/Email: string code
                 * - For Passkey: credential object
                 * - For Backup: string code
                 */
                this.code = __runInitializers(this, _methodName_extraInitializers);
                /**
                 * Optional device ID
                 *
                 * Validation:
                 * - Must be a positive integer if provided
                 */
                this.deviceId = __runInitializers(this, _deviceId_initializers, void 0);
                __runInitializers(this, _deviceId_extraInitializers);
            }
            return VerifyMFACodeDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _sub_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User sub must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _methodName_decorators = [(0, class_validator_1.IsString)({ message: 'Method name must be a string' }), (0, class_validator_1.IsEnum)([mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.PASSKEY, mfa_method_enum_1.MFAMethod.BACKUP], {
                    message: 'Method name must be one of: totp, sms, email, passkey, backup',
                }), (0, class_validator_1.MaxLength)(50, { message: 'Method name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _deviceId_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)({ message: 'Device ID must be a number' })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _methodName_decorators, { kind: "field", name: "methodName", static: false, private: false, access: { has: function (obj) { return "methodName" in obj; }, get: function (obj) { return obj.methodName; }, set: function (obj, value) { obj.methodName = value; } }, metadata: _metadata }, _methodName_initializers, _methodName_extraInitializers);
            __esDecorate(null, null, _deviceId_decorators, { kind: "field", name: "deviceId", static: false, private: false, access: { has: function (obj) { return "deviceId" in obj; }, get: function (obj) { return obj.deviceId; }, set: function (obj, value) { obj.deviceId = value; } }, metadata: _metadata }, _deviceId_initializers, _deviceId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyMFACodeDTO = VerifyMFACodeDTO;
/**
 * Response DTO for MFA code verification
 */
var VerifyMFACodeResponseDTO = /** @class */ (function () {
    function VerifyMFACodeResponseDTO() {
    }
    return VerifyMFACodeResponseDTO;
}());
exports.VerifyMFACodeResponseDTO = VerifyMFACodeResponseDTO;
