"use strict";
/**
 * DTO for setting MFA exemption
 *
 * Used to grant or revoke a user's exemption from multi-factor authentication requirements.
 * Admin-only operation.
 *
 * @example
 * ```typescript
 * const result = await mfaService.setMFAExemption({
 *   userSub: 'user-uuid',
 *   exempt: true,
 *   reason: 'Business partner requires MFA bypass',
 *   grantedBy: 'admin@example.com'
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
exports.SetMFAExemptionResponseDTO = exports.SetMFAExemptionDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for setting MFA exemption
 */
var SetMFAExemptionDTO = function () {
    var _a;
    var _userSub_decorators;
    var _userSub_initializers = [];
    var _userSub_extraInitializers = [];
    var _exempt_decorators;
    var _exempt_initializers = [];
    var _exempt_extraInitializers = [];
    var _reason_decorators;
    var _reason_initializers = [];
    var _reason_extraInitializers = [];
    var _grantedBy_decorators;
    var _grantedBy_initializers = [];
    var _grantedBy_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SetMFAExemptionDTO() {
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
                 * Whether to grant exemption (true) or revoke exemption (false)
                 */
                this.exempt = (__runInitializers(this, _userSub_extraInitializers), __runInitializers(this, _exempt_initializers, void 0));
                /**
                 * Optional reason for the exemption status change
                 *
                 * Validation:
                 * - Max 500 characters
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.reason = (__runInitializers(this, _exempt_extraInitializers), __runInitializers(this, _reason_initializers, void 0));
                /**
                 * Optional identifier of the admin performing this action
                 *
                 * Validation:
                 * - Max 255 characters
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.grantedBy = (__runInitializers(this, _reason_extraInitializers), __runInitializers(this, _grantedBy_initializers, void 0));
                __runInitializers(this, _grantedBy_extraInitializers);
            }
            return SetMFAExemptionDTO;
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
            _exempt_decorators = [(0, class_validator_1.IsBoolean)({ message: 'Exempt must be a boolean' })];
            _reason_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Reason must be a string' }), (0, class_validator_1.MaxLength)(500, { message: 'Reason must not exceed 500 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _grantedBy_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Granted by must be a string' }), (0, class_validator_1.MaxLength)(255, { message: 'Granted by must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            __esDecorate(null, null, _userSub_decorators, { kind: "field", name: "userSub", static: false, private: false, access: { has: function (obj) { return "userSub" in obj; }, get: function (obj) { return obj.userSub; }, set: function (obj, value) { obj.userSub = value; } }, metadata: _metadata }, _userSub_initializers, _userSub_extraInitializers);
            __esDecorate(null, null, _exempt_decorators, { kind: "field", name: "exempt", static: false, private: false, access: { has: function (obj) { return "exempt" in obj; }, get: function (obj) { return obj.exempt; }, set: function (obj, value) { obj.exempt = value; } }, metadata: _metadata }, _exempt_initializers, _exempt_extraInitializers);
            __esDecorate(null, null, _reason_decorators, { kind: "field", name: "reason", static: false, private: false, access: { has: function (obj) { return "reason" in obj; }, get: function (obj) { return obj.reason; }, set: function (obj, value) { obj.reason = value; } }, metadata: _metadata }, _reason_initializers, _reason_extraInitializers);
            __esDecorate(null, null, _grantedBy_decorators, { kind: "field", name: "grantedBy", static: false, private: false, access: { has: function (obj) { return "grantedBy" in obj; }, get: function (obj) { return obj.grantedBy; }, set: function (obj, value) { obj.grantedBy = value; } }, metadata: _metadata }, _grantedBy_initializers, _grantedBy_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SetMFAExemptionDTO = SetMFAExemptionDTO;
/**
 * Response DTO for setting MFA exemption
 */
var SetMFAExemptionResponseDTO = /** @class */ (function () {
    function SetMFAExemptionResponseDTO() {
    }
    return SetMFAExemptionResponseDTO;
}());
exports.SetMFAExemptionResponseDTO = SetMFAExemptionResponseDTO;
