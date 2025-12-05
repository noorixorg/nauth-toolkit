"use strict";
/**
 * DTO for checking if MFA provider is registered
 *
 * Used to check if a specific MFA provider is registered and available.
 *
 * @example
 * ```typescript
 * const hasTotp = await mfaService.hasProvider({
 *   methodName: 'totp'
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
exports.HasProviderResponseDTO = exports.HasProviderDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * DTO for checking if MFA provider is registered
 */
var HasProviderDTO = function () {
    var _a;
    var _methodName_decorators;
    var _methodName_initializers = [];
    var _methodName_extraInitializers = [];
    return _a = /** @class */ (function () {
            function HasProviderDTO() {
                /**
                 * Provider method name
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
                this.methodName = __runInitializers(this, _methodName_initializers, void 0);
                __runInitializers(this, _methodName_extraInitializers);
            }
            return HasProviderDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _methodName_decorators = [(0, class_validator_1.IsString)({ message: 'Method name must be a string' }), (0, class_validator_1.IsEnum)(mfa_method_enum_1.MFAMethod, {
                    message: 'Method name must be one of: totp, sms, email, passkey',
                }), (0, class_validator_1.MaxLength)(50, { message: 'Method name must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _methodName_decorators, { kind: "field", name: "methodName", static: false, private: false, access: { has: function (obj) { return "methodName" in obj; }, get: function (obj) { return obj.methodName; }, set: function (obj, value) { obj.methodName = value; } }, metadata: _metadata }, _methodName_initializers, _methodName_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.HasProviderDTO = HasProviderDTO;
/**
 * Response DTO for has provider check
 */
var HasProviderResponseDTO = /** @class */ (function () {
    function HasProviderResponseDTO() {
    }
    return HasProviderResponseDTO;
}());
exports.HasProviderResponseDTO = HasProviderResponseDTO;
