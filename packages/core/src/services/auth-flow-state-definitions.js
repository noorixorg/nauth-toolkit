"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_DEFINITIONS = void 0;
exports.getStateDefinition = getStateDefinition;
exports.getStateDefinitionsByPriority = getStateDefinitionsByPriority;
var auth_flow_state_machine_types_1 = require("./auth-flow-state-machine.types");
var auth_challenge_dto_1 = require("../dto/auth-challenge.dto");
var auth_flow_rules_1 = require("./auth-flow-rules");
var mfa_method_enum_1 = require("../enums/mfa-method.enum");
/**
 * Authentication Flow State Definitions
 *
 * Defines all possible states in the authentication flow with their:
 * - Priority (evaluation order, 1-9)
 * - Condition rules (when state applies)
 * - Challenge mappings (which AuthChallenge this state maps to)
 * - Metadata builders (optional additional response data)
 * - OnEnter hooks (optional actions when state is entered)
 *
 * States are evaluated in priority order. The first state whose condition
 * evaluates to true is selected.
 *
 * @example
 * ```typescript
 * const state = STATE_DEFINITIONS.find(def => def.condition(context));
 * ```
 */
exports.STATE_DEFINITIONS = [
    /**
     * Priority 1: Force Password Change
     * Highest priority - must be completed before any other challenges
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.PENDING_PASSWORD_CHANGE,
        priority: 1,
        condition: auth_flow_rules_1.Rules.mustChangePassword,
        challenge: auth_challenge_dto_1.AuthChallenge.FORCE_CHANGE_PASSWORD,
    },
    /**
     * Priority 2: Email Verification
     * Required before phone verification (sequential flow)
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.PENDING_EMAIL_VERIFICATION,
        priority: 2,
        condition: auth_flow_rules_1.Rules.emailVerificationPending,
        challenge: auth_challenge_dto_1.AuthChallenge.VERIFY_EMAIL,
    },
    /**
     * Priority 3: Phone Collection
     * User must provide phone number before verification
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.PENDING_PHONE_COLLECTION,
        priority: 3,
        condition: auth_flow_rules_1.Rules.phoneCollectionNeeded,
        challenge: auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE,
    },
    /**
     * Priority 4: Phone Verification
     * Required after email verification (sequential flow)
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.PENDING_PHONE_VERIFICATION,
        priority: 4,
        condition: auth_flow_rules_1.Rules.phoneVerificationPending,
        challenge: auth_challenge_dto_1.AuthChallenge.VERIFY_PHONE,
    },
    /**
     * Priority 5: MFA Setup Required
     * Required when enforcement is REQUIRED/ADAPTIVE and grace period expired
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.PENDING_MFA_SETUP,
        priority: 5,
        condition: auth_flow_rules_1.Rules.mfaSetupRequired,
        challenge: auth_challenge_dto_1.AuthChallenge.MFA_SETUP_REQUIRED,
        /**
         * OnEnter hook: Auto-complete SMS MFA setup if phone is already verified
         *
         * Special case: If user's phone is already verified and they choose SMS MFA,
         * we can skip the SMS verification step during setup (improves UX).
         * The phone was already verified, so we trust it for MFA setup.
         *
         * This sets skipMFAVerification flag which will be checked during MFA setup completion.
         */
        onEnter: function (context) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Check if phone is verified and preferred method is SMS
                if (context.user.isPhoneVerified && context.user.phone && context.user.preferredMfaMethod === mfa_method_enum_1.MFAMethod.SMS) {
                    // Auto-complete: Set skipMFAVerification flag
                    // This will be used during MFA setup completion to skip SMS verification
                    context.skipMFAVerification = true;
                }
                return [2 /*return*/];
            });
        }); },
    },
    /**
     * Priority 6: MFA Verification Required
     * Required when MFA is enabled and verification is needed
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.PENDING_MFA_VERIFICATION,
        priority: 6,
        condition: auth_flow_rules_1.Rules.mfaVerificationRequired,
        challenge: auth_challenge_dto_1.AuthChallenge.MFA_REQUIRED,
    },
    /**
     * Priority 7: Grace Period Active
     * ADAPTIVE mode with grace period active and MFA not enabled
     * This is a special state that allows login but includes metadata about grace period
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.GRACE_PERIOD_ACTIVE,
        priority: 7,
        condition: auth_flow_rules_1.Rules.gracePeriodActiveAdaptive,
        /**
         * Build metadata for grace period state
         * Includes grace period end timestamp and risk information
         */
        buildMetadata: function (context) {
            return {
                gracePeriodEndsAt: context.computed.gracePeriodEndsAt,
                riskScore: context.computed.riskScore,
                riskLevel: context.computed.riskLevel,
            };
        },
    },
    /**
     * Priority 8: Blocked
     * User is blocked from signing in due to high risk
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.BLOCKED,
        priority: 8,
        condition: auth_flow_rules_1.Rules.isBlocked,
        /**
         * Build metadata for blocked state
         * Includes block expiration and reason
         */
        buildMetadata: function (context) {
            return {
                blockedUntil: context.computed.blockedUntil,
                reason: context.computed.blockReason,
            };
        },
    },
    /**
     * Priority 9: Authenticated
     * Default state when all challenges are complete
     * This rule always evaluates to true, so it's the fallback state
     */
    {
        state: auth_flow_state_machine_types_1.AuthFlowState.AUTHENTICATED,
        priority: 9,
        condition: auth_flow_rules_1.Rules.authenticated,
    },
];
/**
 * Get state definition by state
 *
 * @param state - State to get definition for
 * @returns State definition or undefined if not found
 *
 * @example
 * ```typescript
 * const def = getStateDefinition(AuthFlowState.PENDING_EMAIL_VERIFICATION);
 * ```
 */
function getStateDefinition(state) {
    return exports.STATE_DEFINITIONS.find(function (def) { return def.state === state; });
}
/**
 * Get state definitions sorted by priority
 *
 * @returns State definitions sorted by priority (1-9)
 *
 * @example
 * ```typescript
 * const sorted = getStateDefinitionsByPriority();
 * // Evaluates states in order: PENDING_PASSWORD_CHANGE, PENDING_EMAIL_VERIFICATION, ...
 * ```
 */
function getStateDefinitionsByPriority() {
    return __spreadArray([], exports.STATE_DEFINITIONS, true).sort(function (a, b) { return a.priority - b.priority; });
}
