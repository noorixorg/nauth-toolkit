"use strict";
/**
 * Unified Challenge Response DTO with Comprehensive Validation
 *
 * Provides class-validator validation for challenge responses.
 * This is the single source of truth for challenge response validation,
 * used by both NestJS and Express adapters.
 *
 * Security Features:
 * - All string inputs have max length (prevents DoS attacks)
 * - Phone numbers validated against E.164 format
 * - Password strength enforced (8-128 chars)
 * - Conditional validation based on challenge type
 * - Enum validation prevents invalid challenge types
 *
 * @module RespondChallengeDTO
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
exports.RespondChallengeValidation = exports.RespondChallengeDTO = exports.MFAMethodType = exports.ChallengeType = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * Challenge type enum for validation
 */
var ChallengeType;
(function (ChallengeType) {
    ChallengeType["VERIFY_EMAIL"] = "VERIFY_EMAIL";
    ChallengeType["VERIFY_PHONE"] = "VERIFY_PHONE";
    ChallengeType["MFA_REQUIRED"] = "MFA_REQUIRED";
    ChallengeType["FORCE_CHANGE_PASSWORD"] = "FORCE_CHANGE_PASSWORD";
    ChallengeType["MFA_SETUP_REQUIRED"] = "MFA_SETUP_REQUIRED";
})(ChallengeType || (exports.ChallengeType = ChallengeType = {}));
/**
 * MFA method enum for validation
 */
var MFAMethodType;
(function (MFAMethodType) {
    MFAMethodType["SMS"] = "sms";
    MFAMethodType["EMAIL"] = "email";
    MFAMethodType["TOTP"] = "totp";
    MFAMethodType["PASSKEY"] = "passkey";
    MFAMethodType["BACKUP"] = "backup";
})(MFAMethodType || (exports.MFAMethodType = MFAMethodType = {}));
/**
 * Unified DTO for responding to authentication challenges
 *
 * Uses conditional validation (@ValidateIf) to validate fields based on challenge type.
 * This ensures proper validation while maintaining a single endpoint for all challenge types.
 *
 * Security:
 * - All strings have max length constraints matching DB limits
 * - Phone numbers validated against E.164 format (prevents SQL injection)
 * - Verification codes validated for length (4-10 chars)
 * - Passwords validated for strength requirements
 * - Session tokens validated as UUID v4 format (prevents injection)
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @Post('respond-challenge')
 *   async respondToChallenge(@Body() dto: RespondChallengeDTO) {
 *     return await this.authService.respondToChallenge(dto);
 *   }
 * }
 * ```
 */
var RespondChallengeDTO = function () {
    var _a;
    var _session_decorators;
    var _session_initializers = [];
    var _session_extraInitializers = [];
    var _type_decorators;
    var _type_initializers = [];
    var _type_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _newPassword_decorators;
    var _newPassword_initializers = [];
    var _newPassword_extraInitializers = [];
    var _method_decorators;
    var _method_initializers = [];
    var _method_extraInitializers = [];
    var _credential_decorators;
    var _credential_initializers = [];
    var _credential_extraInitializers = [];
    var _setupData_decorators;
    var _setupData_initializers = [];
    var _setupData_extraInitializers = [];
    return _a = /** @class */ (function () {
            function RespondChallengeDTO() {
                /**
                 * Challenge session token (UUID v4)
                 * Always required
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
                /**
                 * Challenge type being responded to
                 * Always required
                 */
                this.type = (__runInitializers(this, _session_extraInitializers), __runInitializers(this, _type_initializers, void 0));
                // ============================================================================
                // VERIFY_EMAIL / VERIFY_PHONE / MFA_REQUIRED (code-based)
                // ============================================================================
                /**
                 * Verification code
                 * Required for:
                 * - VERIFY_EMAIL
                 * - VERIFY_PHONE (when verifying code)
                 * - MFA_REQUIRED (for SMS/Email/TOTP/Backup methods)
                 *
                 * Validation:
                 * - Must be a string
                 * - Length 4-10 characters (covers all code types)
                 * - Alphanumeric only
                 *
                 * Note: NOT trimmed (codes should be exact)
                 */
                this.code = (__runInitializers(this, _type_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                // ============================================================================
                // VERIFY_PHONE (phone collection)
                // ============================================================================
                /**
                 * Phone number in E.164 format
                 * Required for VERIFY_PHONE when collecting phone number (first step)
                 *
                 * Validation:
                 * - Must be a string
                 * - Must match E.164 format: +[country code][number]
                 * - Example: +14155552671
                 * - Max 20 characters (matches DB limit)
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Only digits and leading + allowed
                 */
                this.phone = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                // ============================================================================
                // FORCE_CHANGE_PASSWORD
                // ============================================================================
                /**
                 * New password
                 * Required for FORCE_CHANGE_PASSWORD challenge
                 *
                 * Validation:
                 * - Must be a string
                 * - Min 8 characters (security requirement)
                 * - Max 128 characters (prevents DoS via bcrypt)
                 *
                 * Note: NOT trimmed (passwords can have leading/trailing spaces)
                 */
                this.newPassword = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _newPassword_initializers, void 0));
                // ============================================================================
                // MFA_REQUIRED / MFA_SETUP_REQUIRED
                // ============================================================================
                /**
                 * MFA method being used or set up
                 * Required for:
                 * - MFA_REQUIRED challenge (method being used for verification)
                 * - MFA_SETUP_REQUIRED challenge (method being set up)
                 *
                 * Validation:
                 * - Must be one of: sms, email, totp, passkey, backup
                 */
                this.method = (__runInitializers(this, _newPassword_extraInitializers), __runInitializers(this, _method_initializers, void 0));
                /**
                 * Passkey credential
                 * Required for MFA_REQUIRED when method is 'passkey'
                 *
                 * Validation:
                 * - Must be an object
                 * - Contains WebAuthn credential from navigator.credentials.get()
                 */
                this.credential = (__runInitializers(this, _method_extraInitializers), __runInitializers(this, _credential_initializers, void 0));
                // ============================================================================
                // MFA_SETUP_REQUIRED
                // ============================================================================
                /**
                 * MFA setup data (method-specific)
                 * Required for MFA_SETUP_REQUIRED challenge
                 *
                 * Expected structure by method:
                 * - SMS: { phone: string, code: string }
                 * - Email: { code: string }
                 * - TOTP: { code: string }
                 * - Passkey: { credential: Record<string, unknown> }
                 *
                 * Validation:
                 * - Must be an object
                 * - Structure validated by MFA provider services
                 */
                this.setupData = (__runInitializers(this, _credential_extraInitializers), __runInitializers(this, _setupData_initializers, void 0));
                __runInitializers(this, _setupData_extraInitializers);
            }
            return RespondChallengeDTO;
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
            _type_decorators = [(0, class_validator_1.IsEnum)(ChallengeType, {
                    message: 'Challenge type must be one of: VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, FORCE_CHANGE_PASSWORD, MFA_SETUP_REQUIRED',
                })];
            _code_decorators = [(0, class_validator_1.ValidateIf)(function (o) {
                    return o.type === ChallengeType.VERIFY_EMAIL ||
                        (o.type === ChallengeType.VERIFY_PHONE && !o.phone) ||
                        (o.type === ChallengeType.MFA_REQUIRED && o.method !== MFAMethodType.PASSKEY);
                }), (0, class_validator_1.IsString)({ message: 'Code must be a string' }), (0, class_validator_1.Length)(4, 10, { message: 'Code must be between 4 and 10 characters' }), (0, class_validator_1.Matches)(/^[A-Za-z0-9]+$/, { message: 'Code can only contain letters and numbers' })];
            _phone_decorators = [(0, class_validator_1.ValidateIf)(function (o) { return o.type === ChallengeType.VERIFY_PHONE && !o.code; }), (0, class_validator_1.IsString)({ message: 'Phone must be a string' }), (0, class_validator_1.MaxLength)(20, { message: 'Phone number must not exceed 20 characters' }), (0, class_validator_1.Matches)(/^\+[1-9]\d{1,14}$/, {
                    message: 'Phone must be in E.164 format (e.g., +14155552671)',
                }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    return value;
                })];
            _newPassword_decorators = [(0, class_validator_1.ValidateIf)(function (o) { return o.type === ChallengeType.FORCE_CHANGE_PASSWORD; }), (0, class_validator_1.IsString)({ message: 'New password must be a string' }), (0, class_validator_1.MinLength)(8, { message: 'Password must be at least 8 characters' }), (0, class_validator_1.MaxLength)(128, { message: 'Password must not exceed 128 characters' })];
            _method_decorators = [(0, class_validator_1.ValidateIf)(function (o) { return o.type === ChallengeType.MFA_REQUIRED || o.type === ChallengeType.MFA_SETUP_REQUIRED; }), (0, class_validator_1.IsEnum)(MFAMethodType, { message: 'MFA method must be one of: sms, email, totp, passkey, backup' })];
            _credential_decorators = [(0, class_validator_1.ValidateIf)(function (o) { return o.type === ChallengeType.MFA_REQUIRED && o.method === MFAMethodType.PASSKEY; }), (0, class_validator_1.IsObject)({ message: 'Credential must be an object' })];
            _setupData_decorators = [(0, class_validator_1.ValidateIf)(function (o) { return o.type === ChallengeType.MFA_SETUP_REQUIRED; }), (0, class_validator_1.IsObject)({ message: 'Setup data must be an object' })];
            __esDecorate(null, null, _session_decorators, { kind: "field", name: "session", static: false, private: false, access: { has: function (obj) { return "session" in obj; }, get: function (obj) { return obj.session; }, set: function (obj, value) { obj.session = value; } }, metadata: _metadata }, _session_initializers, _session_extraInitializers);
            __esDecorate(null, null, _type_decorators, { kind: "field", name: "type", static: false, private: false, access: { has: function (obj) { return "type" in obj; }, get: function (obj) { return obj.type; }, set: function (obj, value) { obj.type = value; } }, metadata: _metadata }, _type_initializers, _type_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _newPassword_decorators, { kind: "field", name: "newPassword", static: false, private: false, access: { has: function (obj) { return "newPassword" in obj; }, get: function (obj) { return obj.newPassword; }, set: function (obj, value) { obj.newPassword = value; } }, metadata: _metadata }, _newPassword_initializers, _newPassword_extraInitializers);
            __esDecorate(null, null, _method_decorators, { kind: "field", name: "method", static: false, private: false, access: { has: function (obj) { return "method" in obj; }, get: function (obj) { return obj.method; }, set: function (obj, value) { obj.method = value; } }, metadata: _metadata }, _method_initializers, _method_extraInitializers);
            __esDecorate(null, null, _credential_decorators, { kind: "field", name: "credential", static: false, private: false, access: { has: function (obj) { return "credential" in obj; }, get: function (obj) { return obj.credential; }, set: function (obj, value) { obj.credential = value; } }, metadata: _metadata }, _credential_initializers, _credential_extraInitializers);
            __esDecorate(null, null, _setupData_decorators, { kind: "field", name: "setupData", static: false, private: false, access: { has: function (obj) { return "setupData" in obj; }, get: function (obj) { return obj.setupData; }, set: function (obj, value) { obj.setupData = value; } }, metadata: _metadata }, _setupData_initializers, _setupData_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.RespondChallengeDTO = RespondChallengeDTO;
/**
 * Helper type guards for challenge response
 *
 * Use these to narrow TypeScript types in your application logic.
 *
 * @example
 * ```typescript
 * if (RespondChallengeValidation.isEmailVerification(dto)) {
 *   // TypeScript knows dto.code is available
 * }
 * ```
 */
var RespondChallengeValidation;
(function (RespondChallengeValidation) {
    function isEmailVerification(dto) {
        return dto.type === ChallengeType.VERIFY_EMAIL && !!dto.code;
    }
    RespondChallengeValidation.isEmailVerification = isEmailVerification;
    function isPhoneCollection(dto) {
        return dto.type === ChallengeType.VERIFY_PHONE && !!dto.phone;
    }
    RespondChallengeValidation.isPhoneCollection = isPhoneCollection;
    function isPhoneVerification(dto) {
        return dto.type === ChallengeType.VERIFY_PHONE && !!dto.code;
    }
    RespondChallengeValidation.isPhoneVerification = isPhoneVerification;
    function isPasswordChange(dto) {
        return dto.type === ChallengeType.FORCE_CHANGE_PASSWORD && !!dto.newPassword;
    }
    RespondChallengeValidation.isPasswordChange = isPasswordChange;
    function isMFAVerification(dto) {
        return dto.type === ChallengeType.MFA_REQUIRED && !!dto.method;
    }
    RespondChallengeValidation.isMFAVerification = isMFAVerification;
    function isMFASetup(dto) {
        return dto.type === ChallengeType.MFA_SETUP_REQUIRED && !!dto.method && !!dto.setupData;
    }
    RespondChallengeValidation.isMFASetup = isMFASetup;
})(RespondChallengeValidation || (exports.RespondChallengeValidation = RespondChallengeValidation = {}));
