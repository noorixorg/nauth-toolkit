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
exports.ChallengeResponseRequestDTO = exports.AuthChallengeResponseDTO = exports.AuthChallenge = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
/**
 * Authentication Challenge Types
 *
 * Represents different challenges that must be completed before
 * a user can gain full access to the system. This is similar to
 * AWS Cognito's challenge system.
 *
 * @example
 * ```typescript
 * // After login, check for challenges
 * const result = await authService.login(credentials);
 * if (result.challengeName) {
 *   // User must complete challenge before accessing system
 *   console.log('Challenge required:', result.challengeName);
 * }
 * ```
 */
var AuthChallenge;
(function (AuthChallenge) {
    /**
     * Email verification required
     * User must verify their email address before proceeding
     */
    AuthChallenge["VERIFY_EMAIL"] = "VERIFY_EMAIL";
    /**
     * Phone verification required
     * User must verify their phone number before proceeding
     */
    AuthChallenge["VERIFY_PHONE"] = "VERIFY_PHONE";
    /**
     * Multi-factor authentication required
     * User must complete MFA verification (TOTP, SMS, etc.)
     * This challenge is used when user already has MFA enabled and needs to verify
     */
    AuthChallenge["MFA_REQUIRED"] = "MFA_REQUIRED";
    /**
     * MFA setup required
     * User must set up multi-factor authentication before being allowed to login.
     * This occurs when enforcement is 'REQUIRED' and grace period has expired or is disabled.
     */
    AuthChallenge["MFA_SETUP_REQUIRED"] = "MFA_SETUP_REQUIRED";
    /**
     * Password change required
     * User must change their password before proceeding
     * (e.g., admin-forced password reset, expired password)
     */
    AuthChallenge["FORCE_CHANGE_PASSWORD"] = "FORCE_CHANGE_PASSWORD";
})(AuthChallenge || (exports.AuthChallenge = AuthChallenge = {}));
/**
 * Challenge Response DTO
 *
 * Used when a user's authentication is incomplete due to pending challenges.
 * Contains minimal information about the user and what challenges they must complete.
 *
 * Note: This is primarily a response DTO, but validation is included for completeness.
 *
 * @example
 * ```typescript
 * // Login response with challenge
 * {
 *   challengeName: 'VERIFY_EMAIL',
 *   session: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   challengeParameters: {
 *     email: 'user@example.com',
 *     codeDeliveryDestination: 'u***@example.com'
 *   },
 *   userSub: 'a21b654c-2746-4168-acee-c175083a65cd'
 * }
 * ```
 */
var AuthChallengeResponseDTO = function () {
    var _a;
    var _challengeName_decorators;
    var _challengeName_initializers = [];
    var _challengeName_extraInitializers = [];
    var _session_decorators;
    var _session_initializers = [];
    var _session_extraInitializers = [];
    var _challengeParameters_decorators;
    var _challengeParameters_initializers = [];
    var _challengeParameters_extraInitializers = [];
    var _userSub_decorators;
    var _userSub_initializers = [];
    var _userSub_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AuthChallengeResponseDTO() {
                /**
                 * The challenge that must be completed
                 *
                 * Validation:
                 * - Must be a valid AuthChallenge enum value
                 */
                this.challengeName = __runInitializers(this, _challengeName_initializers, void 0);
                /**
                 * Temporary session identifier for challenge completion (UUID v4)
                 * This is NOT a full JWT token - only used for challenge verification
                 *
                 * Validation:
                 * - Must be a valid UUID v4 format
                 * - Generated using randomUUID() in challenge service
                 *
                 * @example "a21b654c-2746-4168-acee-c175083a65cd"
                 */
                this.session = (__runInitializers(this, _challengeName_extraInitializers), __runInitializers(this, _session_initializers, void 0));
                /**
                 * Challenge-specific parameters
                 * Contains information needed to complete the challenge
                 *
                 * Validation:
                 * - Must be an object
                 *
                 * @example
                 * ```typescript
                 * // For VERIFY_EMAIL
                 * {
                 *   email: 'user@example.com',
                 *   codeDeliveryDestination: 'u***@example.com'
                 * }
                 *
                 * // For VERIFY_PHONE
                 * {
                 *   phone: '+1234567890',
                 *   codeDeliveryDestination: '***-***-7890'
                 * }
                 * ```
                 */
                this.challengeParameters = (__runInitializers(this, _session_extraInitializers), __runInitializers(this, _challengeParameters_initializers, void 0));
                /**
                 * User's unique identifier (UUID v4)
                 * Provided so the client knows which user is completing challenges
                 *
                 * Validation:
                 * - Must be a valid UUID v4 format
                 * - Matches DB constraint: char(36) or uuid
                 *
                 * @example "a21b654c-2746-4168-acee-c175083a65cd"
                 */
                this.userSub = (__runInitializers(this, _challengeParameters_extraInitializers), __runInitializers(this, _userSub_initializers, void 0));
                __runInitializers(this, _userSub_extraInitializers);
            }
            return AuthChallengeResponseDTO;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _challengeName_decorators = [(0, class_validator_1.IsEnum)(AuthChallenge, {
                    message: 'Challenge name must be a valid AuthChallenge enum value',
                })];
            _session_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'Session token must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            _challengeParameters_decorators = [(0, class_validator_1.IsObject)({ message: 'Challenge parameters must be an object' })];
            _userSub_decorators = [(0, class_validator_1.IsUUID)('4', { message: 'User sub must be a valid UUID v4 format' }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string') {
                        return value.trim().toLowerCase();
                    }
                    return value;
                })];
            __esDecorate(null, null, _challengeName_decorators, { kind: "field", name: "challengeName", static: false, private: false, access: { has: function (obj) { return "challengeName" in obj; }, get: function (obj) { return obj.challengeName; }, set: function (obj, value) { obj.challengeName = value; } }, metadata: _metadata }, _challengeName_initializers, _challengeName_extraInitializers);
            __esDecorate(null, null, _session_decorators, { kind: "field", name: "session", static: false, private: false, access: { has: function (obj) { return "session" in obj; }, get: function (obj) { return obj.session; }, set: function (obj, value) { obj.session = value; } }, metadata: _metadata }, _session_initializers, _session_extraInitializers);
            __esDecorate(null, null, _challengeParameters_decorators, { kind: "field", name: "challengeParameters", static: false, private: false, access: { has: function (obj) { return "challengeParameters" in obj; }, get: function (obj) { return obj.challengeParameters; }, set: function (obj, value) { obj.challengeParameters = value; } }, metadata: _metadata }, _challengeParameters_initializers, _challengeParameters_extraInitializers);
            __esDecorate(null, null, _userSub_decorators, { kind: "field", name: "userSub", static: false, private: false, access: { has: function (obj) { return "userSub" in obj; }, get: function (obj) { return obj.userSub; }, set: function (obj, value) { obj.userSub = value; } }, metadata: _metadata }, _userSub_initializers, _userSub_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.AuthChallengeResponseDTO = AuthChallengeResponseDTO;
/**
 * Challenge Completion Request DTO
 *
 * Used to submit a response to an authentication challenge.
 *
 * Note: This is a legacy DTO. The codebase now uses RespondChallengeDTO for the unified API.
 * This DTO is kept for backwards compatibility.
 *
 * Security:
 * - Session token validated as UUID v4 format
 * - Challenge name validated against enum
 * - Challenge responses validated as object
 *
 * @example
 * ```typescript
 * // Verify email challenge
 * const request: ChallengeResponseRequestDTO = {
 *   session: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   challengeName: 'VERIFY_EMAIL',
 *   challengeResponses: {
 *     code: '123456'
 *   }
 * };
 * ```
 */
var ChallengeResponseRequestDTO = function () {
    var _a;
    var _session_decorators;
    var _session_initializers = [];
    var _session_extraInitializers = [];
    var _challengeName_decorators;
    var _challengeName_initializers = [];
    var _challengeName_extraInitializers = [];
    var _challengeResponses_decorators;
    var _challengeResponses_initializers = [];
    var _challengeResponses_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ChallengeResponseRequestDTO() {
                /**
                 * Temporary session from initial auth response (UUID v4)
                 *
                 * Validation:
                 * - Must be a valid UUID v4 format
                 * - Generated using randomUUID() in challenge service
                 *
                 * Sanitization:
                 * - Trimmed
                 * - Lowercased for consistency
                 *
                 * @example "a21b654c-2746-4168-acee-c175083a65cd"
                 */
                this.session = __runInitializers(this, _session_initializers, void 0);
                /**
                 * The challenge being responded to
                 *
                 * Validation:
                 * - Must be a valid AuthChallenge enum value
                 */
                this.challengeName = (__runInitializers(this, _session_extraInitializers), __runInitializers(this, _challengeName_initializers, void 0));
                /**
                 * Challenge-specific responses
                 *
                 * Validation:
                 * - Must be an object
                 * - Structure validated in service layer based on challenge type
                 *
                 * @example
                 * ```typescript
                 * // For VERIFY_EMAIL or VERIFY_PHONE
                 * { code: '123456' }
                 *
                 * // For FORCE_CHANGE_PASSWORD
                 * { newPassword: 'NewSecure123!' }
                 * ```
                 */
                this.challengeResponses = (__runInitializers(this, _challengeName_extraInitializers), __runInitializers(this, _challengeResponses_initializers, void 0));
                __runInitializers(this, _challengeResponses_extraInitializers);
            }
            return ChallengeResponseRequestDTO;
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
            _challengeName_decorators = [(0, class_validator_1.IsEnum)(AuthChallenge, {
                    message: 'Challenge name must be a valid AuthChallenge enum value',
                })];
            _challengeResponses_decorators = [(0, class_validator_1.IsObject)({ message: 'Challenge responses must be an object' })];
            __esDecorate(null, null, _session_decorators, { kind: "field", name: "session", static: false, private: false, access: { has: function (obj) { return "session" in obj; }, get: function (obj) { return obj.session; }, set: function (obj, value) { obj.session = value; } }, metadata: _metadata }, _session_initializers, _session_extraInitializers);
            __esDecorate(null, null, _challengeName_decorators, { kind: "field", name: "challengeName", static: false, private: false, access: { has: function (obj) { return "challengeName" in obj; }, get: function (obj) { return obj.challengeName; }, set: function (obj, value) { obj.challengeName = value; } }, metadata: _metadata }, _challengeName_initializers, _challengeName_extraInitializers);
            __esDecorate(null, null, _challengeResponses_decorators, { kind: "field", name: "challengeResponses", static: false, private: false, access: { has: function (obj) { return "challengeResponses" in obj; }, get: function (obj) { return obj.challengeResponses; }, set: function (obj, value) { obj.challengeResponses = value; } }, metadata: _metadata }, _challengeResponses_initializers, _challengeResponses_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ChallengeResponseRequestDTO = ChallengeResponseRequestDTO;
