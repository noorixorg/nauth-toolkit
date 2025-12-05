"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rules = exports.RuleBuilder = void 0;
/**
 * Rule Builder
 *
 * Utility class for composing complex rules using combinators.
 * Supports logical operations: all, any, not.
 *
 * @example
 * ```typescript
 * const complexRule = RuleBuilder.all([
 *   Rules.mustChangePassword,
 *   RuleBuilder.not(Rules.isMFAExempt)
 * ]);
 * ```
 */
var RuleBuilder = /** @class */ (function () {
    function RuleBuilder() {
    }
    /**
     * Combine multiple rules with AND logic
     * All rules must evaluate to true
     *
     * @param rules - Array of rules to combine
     * @returns Combined rule that returns true only if all rules are true
     *
     * @example
     * ```typescript
     * const rule = RuleBuilder.all([
     *   Rules.emailVerificationPending,
     *   Rules.isNotSocialLogin
     * ]);
     * ```
     */
    RuleBuilder.all = function (rules) {
        return function (context) {
            return rules.every(function (rule) { return rule(context); });
        };
    };
    /**
     * Combine multiple rules with OR logic
     * At least one rule must evaluate to true
     *
     * @param rules - Array of rules to combine
     * @returns Combined rule that returns true if any rule is true
     *
     * @example
     * ```typescript
     * const rule = RuleBuilder.any([
     *   Rules.isDeviceTrusted,
     *   Rules.isMFAExempt
     * ]);
     * ```
     */
    RuleBuilder.any = function (rules) {
        return function (context) {
            return rules.some(function (rule) { return rule(context); });
        };
    };
    /**
     * Negate a rule
     * Returns true when the rule returns false
     *
     * @param rule - Rule to negate
     * @returns Negated rule
     *
     * @example
     * ```typescript
     * const rule = RuleBuilder.not(Rules.isMFAExempt);
     * ```
     */
    RuleBuilder.not = function (rule) {
        return function (context) {
            return !rule(context);
        };
    };
    return RuleBuilder;
}());
exports.RuleBuilder = RuleBuilder;
/**
 * Authentication Flow Rules
 *
 * Declarative rules for evaluating authentication flow states.
 * Each rule is a pure function that evaluates to true or false based on context.
 *
 * Rules are used in state definitions to determine which state applies.
 */
exports.Rules = {
    /**
     * User must change password
     * Priority: 1 (highest)
     *
     * @param context - Authentication flow context
     * @returns True if user must change password
     */
    mustChangePassword: function (context) {
        return context.user.mustChangePassword === true;
    },
    /**
     * Email verification is pending
     * Priority: 2
     *
     * @param context - Authentication flow context
     * @returns True if email verification is required and not completed
     */
    emailVerificationPending: function (context) {
        return context.computed.isEmailVerificationRequired;
    },
    /**
     * Phone collection is needed
     * Priority: 3
     *
     * @param context - Authentication flow context
     * @returns True if phone collection is needed (user has no phone)
     */
    phoneCollectionNeeded: function (context) {
        return context.computed.isPhoneCollectionNeeded;
    },
    /**
     * Phone verification is pending
     * Priority: 4
     *
     * @param context - Authentication flow context
     * @returns True if phone verification is required and not completed
     */
    phoneVerificationPending: function (context) {
        return context.computed.isPhoneVerificationRequired;
    },
    /**
     * MFA setup is required
     * Priority: 5
     *
     * @param context - Authentication flow context
     * @returns True if MFA setup is required
     */
    mfaSetupRequired: function (context) {
        return context.computed.isMFASetupRequired;
    },
    /**
     * MFA verification is required
     * Priority: 6
     *
     * @param context - Authentication flow context
     * @returns True if MFA verification is required
     */
    mfaVerificationRequired: function (context) {
        return context.computed.isMFAVerificationRequired;
    },
    /**
     * Grace period is active (ADAPTIVE mode with MFA not enabled)
     * Priority: 7
     *
     * This rule applies when:
     * - Enforcement is ADAPTIVE
     * - Grace period is active
     * - MFA is not enabled
     * - User is not blocked
     *
     * @param context - Authentication flow context
     * @returns True if grace period is active and MFA not enabled
     */
    gracePeriodActiveAdaptive: function (context) {
        var _a;
        var enforcement = ((_a = context.config.mfa) === null || _a === void 0 ? void 0 : _a.enforcement) || 'OPTIONAL';
        return (enforcement === 'ADAPTIVE' &&
            context.computed.isGracePeriodActive &&
            !context.user.mfaEnabled &&
            !context.computed.isBlocked);
    },
    /**
     * User is blocked from signing in
     * Priority: 8
     *
     * @param context - Authentication flow context
     * @returns True if user is blocked
     */
    isBlocked: function (context) {
        return context.computed.isBlocked;
    },
    /**
     * User is authenticated (no challenges pending)
     * Priority: 9 (lowest - default state)
     *
     * This rule applies when no other state rules match.
     * It's the default state when all challenges are complete.
     *
     * @param _context - Authentication flow context (unused - always returns true)
     * @returns True if user is authenticated (always true as fallback)
     */
    authenticated: function (_context) {
        // Always true - this is the default state when no other rules match
        return true;
    },
};
