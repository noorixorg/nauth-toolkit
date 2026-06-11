import { AuthFlowContext, Rule } from './auth-flow-state-machine.types';

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
export class RuleBuilder {
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
  static all(rules: Rule[]): Rule {
    return (context: AuthFlowContext): boolean => {
      return rules.every((rule) => rule(context));
    };
  }

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
  static any(rules: Rule[]): Rule {
    return (context: AuthFlowContext): boolean => {
      return rules.some((rule) => rule(context));
    };
  }

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
  static not(rule: Rule): Rule {
    return (context: AuthFlowContext): boolean => {
      return !rule(context);
    };
  }
}

/**
 * Authentication Flow Rules
 *
 * Declarative rules for evaluating authentication flow states.
 * Each rule is a pure function that evaluates to true or false based on context.
 *
 * Rules are used in state definitions to determine which state applies.
 */
export const Rules = {
  /**
   * User must change password
   * Priority: 1 (highest)
   *
   * @param context - Authentication flow context
   * @returns True if user must change password
   */
  mustChangePassword: (context: AuthFlowContext): boolean => {
    return context.user.mustChangePassword === true;
  },

  /**
   * Email verification is pending
   * Priority: 2
   *
   * @param context - Authentication flow context
   * @returns True if email verification is required and not completed
   */
  emailVerificationPending: (context: AuthFlowContext): boolean => {
    return context.computed.isEmailVerificationRequired;
  },

  /**
   * Phone collection is needed
   * Priority: 3
   *
   * @param context - Authentication flow context
   * @returns True if phone collection is needed (user has no phone)
   */
  phoneCollectionNeeded: (context: AuthFlowContext): boolean => {
    return context.computed.isPhoneCollectionNeeded;
  },

  /**
   * Phone verification is pending
   * Priority: 4
   *
   * @param context - Authentication flow context
   * @returns True if phone verification is required and not completed
   */
  phoneVerificationPending: (context: AuthFlowContext): boolean => {
    return context.computed.isPhoneVerificationRequired;
  },

  /**
   * MFA setup is required
   * Priority: 5
   *
   * @param context - Authentication flow context
   * @returns True if MFA setup is required
   */
  mfaSetupRequired: (context: AuthFlowContext): boolean => {
    return context.computed.isMFASetupRequired;
  },

  /**
   * MFA verification is required
   * Priority: 6
   *
   * @param context - Authentication flow context
   * @returns True if MFA verification is required
   */
  mfaVerificationRequired: (context: AuthFlowContext): boolean => {
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
  gracePeriodActiveAdaptive: (context: AuthFlowContext): boolean => {
    const enforcement = context.config.mfa?.enforcement || 'OPTIONAL';
    return (
      enforcement === 'ADAPTIVE' &&
      context.computed.isGracePeriodActive &&
      !context.user.mfaEnabled &&
      !context.computed.isBlocked
    );
  },

  /**
   * User is blocked from signing in
   * Priority: 8
   *
   * @param context - Authentication flow context
   * @returns True if user is blocked
   */
  isBlocked: (context: AuthFlowContext): boolean => {
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
  authenticated: (_context: AuthFlowContext): boolean => {
    // Always true - this is the default state when no other rules match
    return true;
  },
};
