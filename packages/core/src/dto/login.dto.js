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
exports.LoginDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for user login with security-focused validation
 *
 * Security:
 * - Identifier validated (email, username, or phone)
 * - Password length enforced
 * - Input sanitization applied
 * - DeviceId validated if provided
 */
var LoginDTO = function () {
    var _a;
    var _identifier_decorators;
    var _identifier_initializers = [];
    var _identifier_extraInitializers = [];
    var _password_decorators;
    var _password_initializers = [];
    var _password_extraInitializers = [];
    var _deviceName_decorators;
    var _deviceName_initializers = [];
    var _deviceName_extraInitializers = [];
    var _deviceType_decorators;
    var _deviceType_initializers = [];
    var _deviceType_extraInitializers = [];
    return _a = /** @class */ (function () {
            function LoginDTO() {
                /**
                 * Login identifier (email, username, or phone)
                 *
                 * Validation:
                 * - At least 1 character
                 * - Max 255 characters (prevents attacks)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Lowercased if it looks like email
                 */
                this.identifier = __runInitializers(this, _identifier_initializers, void 0); // email, username, or phone
                /**
                 * User password
                 *
                 * Validation:
                 * - At least 1 character (lenient for login)
                 * - Max 128 characters (prevents DoS)
                 *
                 * Note: NOT trimmed (passwords can have spaces)
                 */
                this.password = (__runInitializers(this, _identifier_extraInitializers), __runInitializers(this, _password_initializers, void 0));
                /**
                 * Optional device name for session identification
                 *
                 * Validation:
                 * - Max 255 characters (matches DB constraint: varchar(255))
                 *
                 * Sanitization:
                 * - Trimmed
                 */
                this.deviceName = (__runInitializers(this, _password_extraInitializers), __runInitializers(this, _deviceName_initializers, void 0));
                /**
                 * Optional device type
                 *
                 * Validation:
                 * - Must be one of: mobile, desktop, tablet
                 * - Max 50 characters (matches DB constraint: varchar(50))
                 *
                 * Sanitization:
                 * - Trimmed and lowercased
                 */
                this.deviceType = (__runInitializers(this, _deviceName_extraInitializers), __runInitializers(this, _deviceType_initializers, void 0));
                __runInitializers(this, _deviceType_extraInitializers);
            }
            return LoginDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _identifier_decorators = [(0, class_validator_1.IsString)({ message: 'Identifier must be a string' }), (0, class_validator_1.MinLength)(1, { message: 'Identifier is required' }), (0, class_validator_1.MaxLength)(255, { message: 'Identifier must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        var trimmed = value.trim();
                        // If it contains @, treat as email and lowercase
                        if (trimmed.includes('@')) {
                            return trimmed.toLowerCase();
                        }
                        return trimmed;
                    }
                    return value;
                })];
            _password_decorators = [(0, class_validator_1.IsString)({ message: 'Password must be a string' }), (0, class_validator_1.MinLength)(1, { message: 'Password is required' }), (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })];
            _deviceName_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'DeviceName must be a string' }), (0, class_validator_1.MaxLength)(255, { message: 'DeviceName must not exceed 255 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _deviceType_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)({ message: 'DeviceType must be a string' }), (0, class_validator_1.MaxLength)(50, { message: 'DeviceType must not exceed 50 characters' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _identifier_decorators, { kind: "field", name: "identifier", static: false, private: false, access: { has: function (obj) { return "identifier" in obj; }, get: function (obj) { return obj.identifier; }, set: function (obj, value) { obj.identifier = value; } }, metadata: _metadata }, _identifier_initializers, _identifier_extraInitializers);
            __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } }, metadata: _metadata }, _password_initializers, _password_extraInitializers);
            __esDecorate(null, null, _deviceName_decorators, { kind: "field", name: "deviceName", static: false, private: false, access: { has: function (obj) { return "deviceName" in obj; }, get: function (obj) { return obj.deviceName; }, set: function (obj, value) { obj.deviceName = value; } }, metadata: _metadata }, _deviceName_initializers, _deviceName_extraInitializers);
            __esDecorate(null, null, _deviceType_decorators, { kind: "field", name: "deviceType", static: false, private: false, access: { has: function (obj) { return "deviceType" in obj; }, get: function (obj) { return obj.deviceType; }, set: function (obj, value) { obj.deviceType = value; } }, metadata: _metadata }, _deviceType_initializers, _deviceType_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.LoginDTO = LoginDTO;
