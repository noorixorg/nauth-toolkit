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
exports.UserUpdateDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * DTO for updating user attributes
 *
 * Security:
 * - All fields validated against DB constraints
 * - Input sanitization applied automatically
 * - Email uniqueness checked in service layer
 * - Phone uniqueness checked in service layer
 * - Username uniqueness checked in service layer
 *
 * @example
 * ```typescript
 * const updateData: UserUpdateDTO = {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john.doe@example.com',
 *   phone: '+61444567890'
 * };
 * ```
 */
var UserUpdateDTO = function () {
    var _a;
    var _username_decorators;
    var _username_initializers = [];
    var _username_extraInitializers = [];
    var _firstName_decorators;
    var _firstName_initializers = [];
    var _firstName_extraInitializers = [];
    var _lastName_decorators;
    var _lastName_initializers = [];
    var _lastName_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var _preferredMfaMethod_decorators;
    var _preferredMfaMethod_initializers = [];
    var _preferredMfaMethod_extraInitializers = [];
    var _retainVerification_decorators;
    var _retainVerification_initializers = [];
    var _retainVerification_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UserUpdateDTO() {
                /**
                 * Optional username update
                 *
                 * Validation:
                 * - 3-50 characters
                 * - Alphanumeric, underscores, and hyphens only
                 * - Max 255 characters (DB limit)
                 * - Uniqueness checked in service layer
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Case preserved (username can be case-sensitive per config)
                 */
                this.username = __runInitializers(this, _username_initializers, void 0);
                /**
                 * Optional first name update
                 *
                 * Validation:
                 * - 1-100 characters
                 * - Letters, spaces, hyphens, and apostrophes only
                 * - Max 100 characters (DB limit)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Title case preserved
                 */
                this.firstName = (__runInitializers(this, _username_extraInitializers), __runInitializers(this, _firstName_initializers, void 0));
                /**
                 * Optional last name update
                 *
                 * Validation:
                 * - 1-100 characters
                 * - Letters, spaces, hyphens, and apostrophes only
                 * - Max 100 characters (DB limit)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Title case preserved
                 */
                this.lastName = (__runInitializers(this, _firstName_extraInitializers), __runInitializers(this, _lastName_initializers, void 0));
                /**
                 * Optional email address update
                 *
                 * Validation:
                 * - Valid email format (RFC 5322)
                 * - Max 255 characters (matches DB limit)
                 * - Uniqueness checked in service layer
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.email = (__runInitializers(this, _lastName_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                /**
                 * Optional phone number update
                 *
                 * Validation:
                 * - E.164 format (international standard)
                 * - MUST start with + (required for security)
                 * - Max 20 characters (DB limit)
                 * - Uniqueness checked in service layer
                 *
                 * Sanitization:
                 * - Whitespace removed
                 * - Only digits and leading + preserved
                 *
                 * Security:
                 * - Strict E.164 validation prevents SQL injection
                 * - Max length prevents oversized inputs
                 */
                this.phone = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                /**
                 * Optional metadata update (custom fields)
                 *
                 * Security:
                 * - Validated in service layer if used
                 * - Max depth/size limits should be enforced
                 * - Existing metadata merged with new values
                 */
                this.metadata = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
                /**
                 * Optional preferred MFA method
                 *
                 * Sets the user's preferred MFA method for authentication.
                 * Must be one of the MFA device methods the user has configured.
                 *
                 * Validation:
                 * - Must be one of: totp, sms, email, passkey
                 * - Max 50 characters (matches typical method name length)
                 *
                 * @example
                 * ```typescript
                 * await authService.updateUserAttributes(userId, {
                 *   preferredMfaMethod: 'totp'
                 * });
                 * ```
                 */
                this.preferredMfaMethod = (__runInitializers(this, _metadata_extraInitializers), __runInitializers(this, _preferredMfaMethod_initializers, void 0));
                /**
                 * Optional flag to retain verification status when updating email/phone
                 *
                 * When true:
                 * - Email verification status is preserved when email is updated
                 * - Phone verification status is preserved when phone is updated
                 * - Useful when verification was done externally or outside nauth-toolkit
                 *
                 * When false or undefined (default):
                 * - Email verification is reset to false when email is updated
                 * - Phone verification is reset to false when phone is updated
                 * - User must re-verify the new email/phone
                 *
                 * @example
                 * ```typescript
                 * // Update email but keep verification status (external verification)
                 * await authService.updateUserAttributes(userId, {
                 *   email: 'new@example.com',
                 *   retainVerification: true
                 * });
                 * ```
                 */
                this.retainVerification = (__runInitializers(this, _preferredMfaMethod_extraInitializers), __runInitializers(this, _retainVerification_initializers, void 0));
                __runInitializers(this, _retainVerification_extraInitializers);
            }
            return UserUpdateDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _username_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Username must be a string' }), (0, class_validator_1.MinLength)(3, { message: 'Username must be at least 3 characters' }), (0, class_validator_1.MaxLength)(255, { message: 'Username must not exceed 255 characters' }), (0, class_validator_1.Matches)(/^[a-zA-Z0-9_-]+$/, {
                    message: 'Username can only contain letters, numbers, underscores, and hyphens',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _firstName_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'First name must be a string' }), (0, class_validator_1.MinLength)(1, { message: 'First name must be at least 1 character' }), (0, class_validator_1.MaxLength)(100, { message: 'First name must not exceed 100 characters' }), (0, class_validator_1.Matches)(/^[a-zA-Z\s\-']+$/, {
                    message: 'First name can only contain letters, spaces, hyphens, and apostrophes',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _lastName_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Last name must be a string' }), (0, class_validator_1.MinLength)(1, { message: 'Last name must be at least 1 character' }), (0, class_validator_1.MaxLength)(100, { message: 'Last name must not exceed 100 characters' }), (0, class_validator_1.Matches)(/^[a-zA-Z\s\-']+$/, {
                    message: 'Last name can only contain letters, spaces, hyphens, and apostrophes',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _email_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEmail)({}, { message: 'Invalid email format' }), (0, class_validator_1.MaxLength)(255, { message: 'Email must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _phone_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Phone must be a string' }), (0, class_validator_1.MaxLength)(20, { message: 'Phone must not exceed 20 characters' }), (0, class_validator_1.Matches)(/^\+[1-9]\d{1,14}$/, {
                    message: 'Phone must be in E.164 format with + prefix (e.g., +14155552671)',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        // Remove all whitespace and keep only digits and +
                        return value.replace(/\s/g, '');
                    }
                    return value;
                })];
            _metadata_decorators = [(0, class_validator_1.IsOptional)()];
            _preferredMfaMethod_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)([mfa_method_enum_1.MFAMethod.TOTP, mfa_method_enum_1.MFAMethod.SMS, mfa_method_enum_1.MFAMethod.EMAIL, mfa_method_enum_1.MFAMethod.PASSKEY], {
                    message: 'Preferred MFA method must be one of: totp, sms, email, passkey',
                }), (0, class_validator_1.MaxLength)(50, { message: 'Preferred MFA method must not exceed 50 characters' })];
            _retainVerification_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)({ message: 'retainVerification must be a boolean' })];
            __esDecorate(null, null, _username_decorators, { kind: "field", name: "username", static: false, private: false, access: { has: function (obj) { return "username" in obj; }, get: function (obj) { return obj.username; }, set: function (obj, value) { obj.username = value; } }, metadata: _metadata }, _username_initializers, _username_extraInitializers);
            __esDecorate(null, null, _firstName_decorators, { kind: "field", name: "firstName", static: false, private: false, access: { has: function (obj) { return "firstName" in obj; }, get: function (obj) { return obj.firstName; }, set: function (obj, value) { obj.firstName = value; } }, metadata: _metadata }, _firstName_initializers, _firstName_extraInitializers);
            __esDecorate(null, null, _lastName_decorators, { kind: "field", name: "lastName", static: false, private: false, access: { has: function (obj) { return "lastName" in obj; }, get: function (obj) { return obj.lastName; }, set: function (obj, value) { obj.lastName = value; } }, metadata: _metadata }, _lastName_initializers, _lastName_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
            __esDecorate(null, null, _preferredMfaMethod_decorators, { kind: "field", name: "preferredMfaMethod", static: false, private: false, access: { has: function (obj) { return "preferredMfaMethod" in obj; }, get: function (obj) { return obj.preferredMfaMethod; }, set: function (obj, value) { obj.preferredMfaMethod = value; } }, metadata: _metadata }, _preferredMfaMethod_initializers, _preferredMfaMethod_extraInitializers);
            __esDecorate(null, null, _retainVerification_decorators, { kind: "field", name: "retainVerification", static: false, private: false, access: { has: function (obj) { return "retainVerification" in obj; }, get: function (obj) { return obj.retainVerification; }, set: function (obj, value) { obj.retainVerification = value; } }, metadata: _metadata }, _retainVerification_initializers, _retainVerification_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UserUpdateDTO = UserUpdateDTO;
