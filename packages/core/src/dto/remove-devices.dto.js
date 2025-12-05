"use strict";
/**
 * DTO for removing MFA devices
 *
 * Used to remove all MFA devices of a specific method type for a user.
 * Automatically disables MFA if this was the last device.
 *
 * @example
 * ```typescript
 * const result = await mfaService.removeDevices({
 *   userSub: 'user-uuid',
 *   methodType: 'totp'
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
exports.RemoveDevicesResponseDTO = exports.RemoveDevicesDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * DTO for removing MFA devices
 */
var RemoveDevicesDTO = function () {
    var _a;
    var _userSub_decorators;
    var _userSub_initializers = [];
    var _userSub_extraInitializers = [];
    var _methodType_decorators;
    var _methodType_initializers = [];
    var _methodType_extraInitializers = [];
    return _a = /** @class */ (function () {
            function RemoveDevicesDTO() {
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
                this.userSub = __runInitializers(this, _userSub_initializers, void 0);
                /**
                 * MFA method type to remove
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
                this.methodType = (__runInitializers(this, _userSub_extraInitializers), __runInitializers(this, _methodType_initializers, void 0));
                __runInitializers(this, _methodType_extraInitializers);
            }
            return RemoveDevicesDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userSub_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User sub must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _methodType_decorators = [(0, class_validator_1.IsString)({ message: 'Method type must be a string' }), (0, class_validator_1.IsEnum)([mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.PASSKEY], {
                    message: 'Method type must be one of: totp, sms, email, passkey',
                }), (0, class_validator_1.MaxLength)(50, { message: 'Method type must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _userSub_decorators, { kind: "field", name: "userSub", static: false, private: false, access: { has: function (obj) { return "userSub" in obj; }, get: function (obj) { return obj.userSub; }, set: function (obj, value) { obj.userSub = value; } }, metadata: _metadata }, _userSub_initializers, _userSub_extraInitializers);
            __esDecorate(null, null, _methodType_decorators, { kind: "field", name: "methodType", static: false, private: false, access: { has: function (obj) { return "methodType" in obj; }, get: function (obj) { return obj.methodType; }, set: function (obj, value) { obj.methodType = value; } }, metadata: _metadata }, _methodType_initializers, _methodType_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.RemoveDevicesDTO = RemoveDevicesDTO;
/**
 * Response DTO for removing devices
 */
var RemoveDevicesResponseDTO = /** @class */ (function () {
    function RemoveDevicesResponseDTO() {
    }
    return RemoveDevicesResponseDTO;
}());
exports.RemoveDevicesResponseDTO = RemoveDevicesResponseDTO;
