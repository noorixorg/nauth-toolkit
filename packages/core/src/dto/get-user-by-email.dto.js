"use strict";
/**
 * Get User By Email DTO
 *
 * Request DTO for retrieving a user by email address.
 *
 * Security:
 * - Email format validated
 * - Max length enforced
 *
 * @example
 * ```typescript
 * const user = await authService.getUserByEmail({
 *   email: 'user@example.com',
 *   requireEmailVerified: true
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
exports.GetUserByEmailDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * Request DTO for getting user by email
 */
var GetUserByEmailDTO = function () {
    var _a;
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _requireEmailVerified_decorators;
    var _requireEmailVerified_initializers = [];
    var _requireEmailVerified_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GetUserByEmailDTO() {
                /**
                 * Email address to search for
                 *
                 * Validation:
                 * - Must be a valid email format
                 * - Max 255 characters (matches DB constraint)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Lowercased for consistency
                 *
                 * @example "user@example.com"
                 */
                this.email = __runInitializers(this, _email_initializers, void 0);
                /**
                 * Only return user if email is verified
                 *
                 * Validation:
                 * - Must be a boolean if present
                 * - Default: false
                 *
                 * @example true
                 */
                this.requireEmailVerified = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _requireEmailVerified_initializers, void 0));
                __runInitializers(this, _requireEmailVerified_extraInitializers);
            }
            return GetUserByEmailDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _email_decorators = [(0, class_validator_1.IsEmail)({}, { message: 'Email must be a valid email format' }), (0, class_validator_1.MaxLength)(255, { message: 'Email must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _requireEmailVerified_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)({ message: 'requireEmailVerified must be a boolean' })];
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _requireEmailVerified_decorators, { kind: "field", name: "requireEmailVerified", static: false, private: false, access: { has: function (obj) { return "requireEmailVerified" in obj; }, get: function (obj) { return obj.requireEmailVerified; }, set: function (obj, value) { obj.requireEmailVerified = value; } }, metadata: _metadata }, _requireEmailVerified_initializers, _requireEmailVerified_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GetUserByEmailDTO = GetUserByEmailDTO;
