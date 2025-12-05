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
exports.VerifyPhoneWithCodeBySubDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * Verify Phone with Code by User Sub DTO
 *
 * Used for phone verification with 6-digit OTP code when allowing duplicate phones.
 * Requires user sub to identify which user's phone to verify.
 *
 * Security:
 * - UUID format validated (prevents injection)
 * - Code format validated (6 digits)
 *
 * @example
 * ```typescript
 * POST /auth/verify-phone/verify-by-sub
 * {
 *   "sub": "a21b654c-2746-4168-acee-c175083a65cd",
 *   "code": "123456"
 * }
 * ```
 */
var VerifyPhoneWithCodeBySubDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyPhoneWithCodeBySubDTO() {
                /**
                 * User's external identifier (sub/UUID v4)
                 *
                 * Validation:
                 * - Must be a valid UUID v4 format
                 * - Matches DB constraint: char(36) or uuid
                 *
                 * Sanitization:
                 * - Trimmed and lowercased for consistency
                 *
                 * @example "a21b654c-2746-4168-acee-c175083a65cd"
                 */
                this.sub = __runInitializers(this, _sub_initializers, void 0);
                /**
                 * 6-digit verification code
                 *
                 * Validation:
                 * - Must be a numeric string
                 * - Exactly 6 digits
                 *
                 * @example "123456"
                 */
                this.code = (__runInitializers(this, _sub_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                __runInitializers(this, _code_extraInitializers);
            }
            return VerifyPhoneWithCodeBySubDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _sub_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'Sub must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _code_decorators = [(0, class_validator_1.IsNumberString)({}, { message: 'Code must contain only digits' }), (0, class_validator_1.Length)(6, 6, { message: 'Code must be exactly 6 digits' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        var cleaned = value.replace(/\D/g, '');
                        return cleaned.length === 6 ? cleaned : value;
                    }
                    return value;
                })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyPhoneWithCodeBySubDTO = VerifyPhoneWithCodeBySubDTO;
