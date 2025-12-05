"use strict";
/**
 * Change Password DTO
 *
 * Used for authenticated password changes.
 * User must provide their current password for security verification.
 *
 * Security:
 * - Old password verified before allowing change
 * - New password validated for minimum strength
 * - Password history checked (configurable)
 * - Max length prevents DoS via bcrypt
 *
 * @example
 * ```typescript
 * POST /auth/change-password
 * Authorization: Bearer <access-token>
 * {
 *   "oldPassword": "currentPassword123",
 *   "newPassword": "newSecurePassword456"
 * }
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
exports.ChangePasswordDTO = void 0;
var class_validator_1 = require("class-validator");
var ChangePasswordDTO = function () {
    var _a;
    var _oldPassword_decorators;
    var _oldPassword_initializers = [];
    var _oldPassword_extraInitializers = [];
    var _newPassword_decorators;
    var _newPassword_initializers = [];
    var _newPassword_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ChangePasswordDTO() {
                /**
                 * Current password
                 *
                 * Validation:
                 * - Must be a string
                 *
                 * Note: NOT trimmed (passwords can have leading/trailing spaces)
                 */
                this.oldPassword = __runInitializers(this, _oldPassword_initializers, void 0);
                /**
                 * New password
                 *
                 * Validation:
                 * - Must be a string
                 * - Min 8 characters (security requirement)
                 * - Max 128 characters (prevents DoS via bcrypt)
                 *
                 * Note: NOT trimmed (passwords can have leading/trailing spaces)
                 *
                 * Additional checks in service layer:
                 * - Password history (prevent reuse of recent passwords)
                 * - Password strength (if configured)
                 * - Not same as old password
                 */
                this.newPassword = (__runInitializers(this, _oldPassword_extraInitializers), __runInitializers(this, _newPassword_initializers, void 0));
                __runInitializers(this, _newPassword_extraInitializers);
            }
            return ChangePasswordDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _oldPassword_decorators = [(0, class_validator_1.IsString)({ message: 'Old password must be a string' })];
            _newPassword_decorators = [(0, class_validator_1.IsString)({ message: 'New password must be a string' }), (0, class_validator_1.MinLength)(8, { message: 'Password must be at least 8 characters' }), (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })];
            __esDecorate(null, null, _oldPassword_decorators, { kind: "field", name: "oldPassword", static: false, private: false, access: { has: function (obj) { return "oldPassword" in obj; }, get: function (obj) { return obj.oldPassword; }, set: function (obj, value) { obj.oldPassword = value; } }, metadata: _metadata }, _oldPassword_initializers, _oldPassword_extraInitializers);
            __esDecorate(null, null, _newPassword_decorators, { kind: "field", name: "newPassword", static: false, private: false, access: { has: function (obj) { return "newPassword" in obj; }, get: function (obj) { return obj.newPassword; }, set: function (obj, value) { obj.newPassword = value; } }, metadata: _metadata }, _newPassword_initializers, _newPassword_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ChangePasswordDTO = ChangePasswordDTO;
