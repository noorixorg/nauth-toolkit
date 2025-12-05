"use strict";
/**
 * DTO for requesting MFA setup data
 *
 * Used to get method-specific setup information during MFA enrollment.
 * For example, TOTP setup returns QR code and secret.
 *
 * Security:
 * - Session token length limited (prevents DoS)
 * - Method validated against enum (prevents injection)
 *
 * @example
 * ```typescript
 * const setupData = await authService.getSetupData({
 *   session: 'challenge-session-token',
 *   method: 'totp'
 * });
 * // Returns: { secret: '...', qrCode: '...' }
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
exports.GetSetupDataDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * DTO for getting MFA setup data
 */
var GetSetupDataDTO = function () {
    var _a;
    var _session_decorators;
    var _session_initializers = [];
    var _session_extraInitializers = [];
    var _method_decorators;
    var _method_initializers = [];
    var _method_extraInitializers = [];
    var _setupData_decorators;
    var _setupData_initializers = [];
    var _setupData_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GetSetupDataDTO() {
                /**
                 * Challenge session token (UUID v4)
                 *
                 * Validation:
                 * - Must be a valid UUID v4 format
                 * - Generated using randomUUID() in challenge service
                 * - Matches DB constraint: varchar(255) but UUID format enforced
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Lowercased for consistency
                 *
                 * @example "a21b654c-2746-4168-acee-c175083a65cd"
                 */
                this.session = __runInitializers(this, _session_initializers, void 0);
                /**
                 * MFA method to set up
                 *
                 * Validation:
                 * - Must be one of: sms, email, totp, passkey
                 */
                this.method = (__runInitializers(this, _session_extraInitializers), __runInitializers(this, _method_initializers, void 0));
                /**
                 * Optional provider-specific setup data
                 *
                 * Validation:
                 * - Must be an object if provided
                 * - Structure validated by MFA provider services
                 *
                 * @example { phoneNumber: '+1234567890' } for SMS
                 */
                this.setupData = (__runInitializers(this, _method_extraInitializers), __runInitializers(this, _setupData_initializers, void 0));
                __runInitializers(this, _setupData_extraInitializers);
            }
            return GetSetupDataDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _session_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'Session token must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _method_decorators = [(0, class_validator_1.IsEnum)([mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.PASSKEY], {
                    message: 'Method must be one of: sms, email, totp, passkey',
                })];
            _setupData_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)({ message: 'Setup data must be an object' })];
            __esDecorate(null, null, _session_decorators, { kind: "field", name: "session", static: false, private: false, access: { has: function (obj) { return "session" in obj; }, get: function (obj) { return obj.session; }, set: function (obj, value) { obj.session = value; } }, metadata: _metadata }, _session_initializers, _session_extraInitializers);
            __esDecorate(null, null, _method_decorators, { kind: "field", name: "method", static: false, private: false, access: { has: function (obj) { return "method" in obj; }, get: function (obj) { return obj.method; }, set: function (obj, value) { obj.method = value; } }, metadata: _metadata }, _method_initializers, _method_extraInitializers);
            __esDecorate(null, null, _setupData_decorators, { kind: "field", name: "setupData", static: false, private: false, access: { has: function (obj) { return "setupData" in obj; }, get: function (obj) { return obj.setupData; }, set: function (obj, value) { obj.setupData = value; } }, metadata: _metadata }, _setupData_initializers, _setupData_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GetSetupDataDTO = GetSetupDataDTO;
