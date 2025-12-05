"use strict";
/**
 * DTO for setting up MFA device
 *
 * Used to initiate MFA device setup using the appropriate provider.
 *
 * @example
 * ```typescript
 * const setup = await mfaService.setup({
 *   sub: 'user-uuid',
 *   methodName: 'totp',
 *   setupData: {}
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
exports.SetupMFAResponseDTO = exports.SetupMFADTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * DTO for setting up MFA device
 */
var SetupMFADTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _methodName_decorators;
    var _methodName_initializers = [];
    var _methodName_extraInitializers = [];
    var _setupData_decorators;
    var _setupData_initializers = [];
    var _setupData_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SetupMFADTO() {
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
                 * - Must be one of: totp, sms, email, passkey
                 * - Max 50 characters
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 *
                 * @example "totp"
                 */
                this.methodName = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _methodName_initializers, void 0));
                /**
                 * Optional provider-specific setup data
                 *
                 * Validation:
                 * - Must be an object if provided
                 * - Structure validated by MFA provider services
                 *
                 * @example { phoneNumber: '+1234567890' } for SMS
                 */
                this.setupData = (__runInitializers(this, _methodName_extraInitializers), __runInitializers(this, _setupData_initializers, void 0));
                __runInitializers(this, _setupData_extraInitializers);
            }
            return SetupMFADTO;
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
            _methodName_decorators = [(0, class_validator_1.IsString)({ message: 'Method name must be a string' }), (0, class_validator_1.IsEnum)([mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.PASSKEY], {
                    message: 'Method name must be one of: totp, sms, email, passkey',
                }), (0, class_validator_1.MaxLength)(50, { message: 'Method name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _setupData_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)({ message: 'Setup data must be an object' })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _methodName_decorators, { kind: "field", name: "methodName", static: false, private: false, access: { has: function (obj) { return "methodName" in obj; }, get: function (obj) { return obj.methodName; }, set: function (obj, value) { obj.methodName = value; } }, metadata: _metadata }, _methodName_initializers, _methodName_extraInitializers);
            __esDecorate(null, null, _setupData_decorators, { kind: "field", name: "setupData", static: false, private: false, access: { has: function (obj) { return "setupData" in obj; }, get: function (obj) { return obj.setupData; }, set: function (obj, value) { obj.setupData = value; } }, metadata: _metadata }, _setupData_initializers, _setupData_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SetupMFADTO = SetupMFADTO;
/**
 * Response DTO for MFA setup
 */
var SetupMFAResponseDTO = /** @class */ (function () {
    function SetupMFAResponseDTO() {
    }
    return SetupMFAResponseDTO;
}());
exports.SetupMFAResponseDTO = SetupMFAResponseDTO;
