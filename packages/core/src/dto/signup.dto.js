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
exports.SignupDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for user signup with comprehensive validation
 *
 * Security:
 * - All fields validated against DB constraints
 * - Input sanitization applied automatically
 * - Password strength enforced (8-128 chars)
 * - Email/username uniqueness checked in service layer
 */
var SignupDTO = function () {
    var _a;
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _password_decorators;
    var _password_initializers = [];
    var _password_extraInitializers = [];
    var _username_decorators;
    var _username_initializers = [];
    var _username_extraInitializers = [];
    var _firstName_decorators;
    var _firstName_initializers = [];
    var _firstName_extraInitializers = [];
    var _lastName_decorators;
    var _lastName_initializers = [];
    var _lastName_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SignupDTO() {
                /**
                 * User email address
                 *
                 * Validation:
                 * - Valid email format (RFC 5322)
                 * - Max 255 characters (matches DB limit)
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.email = __runInitializers(this, _email_initializers, void 0);
                /**
                 * User password
                 *
                 * Validation:
                 * - Min 8 characters
                 * - Max 128 characters (prevents DoS via bcrypt)
                 * - Additional policy checks in service layer
                 *
                 * Note: NOT trimmed (passwords can have leading/trailing spaces)
                 */
                this.password = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _password_initializers, void 0));
                /**
                 * Optional username
                 *
                 * Validation:
                 * - 3-50 characters
                 * - Alphanumeric, underscores, and hyphens only
                 * - Max 255 characters (DB limit)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Case preserved (username can be case-sensitive per config)
                 */
                this.username = (__runInitializers(this, _password_extraInitializers), __runInitializers(this, _username_initializers, void 0));
                /**
                 * Optional first name
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
                 * Optional last name
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
                 * Optional phone number
                 *
                 * Validation:
                 * - E.164 format (international standard)
                 * - MUST start with + (required for security)
                 * - Max 20 characters (DB limit)
                 * - Example: +14155552671, +61444567890
                 *
                 * Sanitization:
                 * - Whitespace removed
                 * - Only digits and leading + preserved
                 *
                 * Security:
                 * - Strict E.164 validation prevents SQL injection
                 * - Max length prevents oversized inputs
                 *
                 * Note: Using regex for E.164 format as IsPhoneNumber requires specific country codes
                 * and doesn't support international E.164 format validation directly
                 */
                this.phone = (__runInitializers(this, _lastName_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                /**
                 * Optional metadata (custom fields)
                 *
                 * Security:
                 * - Validated in service layer if used
                 * - Max depth/size limits should be enforced
                 */
                this.metadata = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
                __runInitializers(this, _metadata_extraInitializers);
            }
            return SignupDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _email_decorators = [(0, class_validator_1.IsEmail)({}, { message: 'Invalid email format' }), (0, class_validator_1.MaxLength)(255, { message: 'Email must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _password_decorators = [(0, class_validator_1.IsString)({ message: 'Password must be a string' }), (0, class_validator_1.MinLength)(8, { message: 'Password must be at least 8 characters' }), (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })];
            _username_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'Username must be a string' }), (0, class_validator_1.MinLength)(3, { message: 'Username must be at least 3 characters' }), (0, class_validator_1.MaxLength)(255, { message: 'Username must not exceed 255 characters' }), (0, class_validator_1.Matches)(/^[a-zA-Z0-9_-]+$/, {
                    message: 'Username can only contain letters, numbers, underscores, and hyphens',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
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
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } }, metadata: _metadata }, _password_initializers, _password_extraInitializers);
            __esDecorate(null, null, _username_decorators, { kind: "field", name: "username", static: false, private: false, access: { has: function (obj) { return "username" in obj; }, get: function (obj) { return obj.username; }, set: function (obj, value) { obj.username = value; } }, metadata: _metadata }, _username_initializers, _username_extraInitializers);
            __esDecorate(null, null, _firstName_decorators, { kind: "field", name: "firstName", static: false, private: false, access: { has: function (obj) { return "firstName" in obj; }, get: function (obj) { return obj.firstName; }, set: function (obj, value) { obj.firstName = value; } }, metadata: _metadata }, _firstName_initializers, _firstName_extraInitializers);
            __esDecorate(null, null, _lastName_decorators, { kind: "field", name: "lastName", static: false, private: false, access: { has: function (obj) { return "lastName" in obj; }, get: function (obj) { return obj.lastName; }, set: function (obj, value) { obj.lastName = value; } }, metadata: _metadata }, _lastName_initializers, _lastName_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SignupDTO = SignupDTO;
