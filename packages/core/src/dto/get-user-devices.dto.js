"use strict";
/**
 * DTO for getting user MFA devices
 *
 * Used to retrieve all MFA devices configured for a user.
 *
 * @example
 * ```typescript
 * const devices = await mfaService.getUserDevices({
 *   sub: 'user-uuid'
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
exports.GetUserDevicesResponseDTO = exports.GetUserDevicesDTO = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * DTO for getting user MFA devices
 */
var GetUserDevicesDTO = function () {
    var _a;
    var _sub_decorators;
    var _sub_initializers = [];
    var _sub_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GetUserDevicesDTO() {
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
                this.sub = __runInitializers(this, _sub_initializers, void 0);
                __runInitializers(this, _sub_extraInitializers);
            }
            return GetUserDevicesDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _sub_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User sub must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _sub_decorators, { kind: "field", name: "sub", static: false, private: false, access: { has: function (obj) { return "sub" in obj; }, get: function (obj) { return obj.sub; }, set: function (obj, value) { obj.sub = value; } }, metadata: _metadata }, _sub_initializers, _sub_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GetUserDevicesDTO = GetUserDevicesDTO;
/**
 * Response DTO for user MFA devices
 */
var GetUserDevicesResponseDTO = /** @class */ (function () {
    function GetUserDevicesResponseDTO() {
    }
    return GetUserDevicesResponseDTO;
}());
exports.GetUserDevicesResponseDTO = GetUserDevicesResponseDTO;
