"use strict";
/**
 * DTO for resending verification code
 *
 * Used to resend email/SMS verification codes during challenges:
 * - Email verification (VERIFY_EMAIL)
 * - Phone verification (VERIFY_PHONE)
 * - MFA verification (MFA_REQUIRED with SMS/Email method)
 *
 * Security:
 * - Session token length limited (prevents DoS)
 * - Rate limiting enforced in service layer
 *
 * @example
 * ```typescript
 * const result = await authService.resendCode({
 *   session: 'challenge-session-token'
 * });
 * // Returns: { destination: 'u***r@example.com' }
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
exports.ResendCodeDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for resending verification code
 */
var ResendCodeDTO = function () {
    var _a;
    var _session_decorators;
    var _session_initializers = [];
    var _session_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ResendCodeDTO() {
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
                __runInitializers(this, _session_extraInitializers);
            }
            return ResendCodeDTO;
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
            __esDecorate(null, null, _session_decorators, { kind: "field", name: "session", static: false, private: false, access: { has: function (obj) { return "session" in obj; }, get: function (obj) { return obj.session; }, set: function (obj, value) { obj.session = value; } }, metadata: _metadata }, _session_initializers, _session_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ResendCodeDTO = ResendCodeDTO;
