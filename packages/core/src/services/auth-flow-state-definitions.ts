import { AuthFlowState, StateDefinition, AuthFlowContext, ResponseMetadata } from './auth-flow-state-machine.types';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { Rules } from './auth-flow-rules';
import { MFAMethod } from '../enums/mfa-method.enum';

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
export const STATE_DEFINITIONS: StateDefinition[] = [
  /**
   * Priority 1: Force Password Change
   * Highest priority - must be completed before any other challenges
   */
  {
    state: AuthFlowState.PENDING_PASSWORD_CHANGE,
    priority: 1,
    condition: Rules.mustChangePassword,
    challenge: AuthChallenge.FORCE_CHANGE_PASSWORD,
  },

  /**
   * Priority 2: Email Verification
   * Required before phone verification (sequential flow)
   */
  {
    state: AuthFlowState.PENDING_EMAIL_VERIFICATION,
    priority: 2,
    condition: Rules.emailVerificationPending,
    challenge: AuthChallenge.VERIFY_EMAIL,
  },

  /**
   * Priority 3: Phone Collection
   * User must provide phone number before verification
   */
  {
    state: AuthFlowState.PENDING_PHONE_COLLECTION,
    priority: 3,
    condition: Rules.phoneCollectionNeeded,
    challenge: AuthChallenge.VERIFY_PHONE,
  },

  /**
   * Priority 4: Phone Verification
   * Required after email verification (sequential flow)
   */
  {
    state: AuthFlowState.PENDING_PHONE_VERIFICATION,
    priority: 4,
    condition: Rules.phoneVerificationPending,
    challenge: AuthChallenge.VERIFY_PHONE,
  },

  /**
   * Priority 5: MFA Setup Required
   * Required when enforcement is REQUIRED/ADAPTIVE and grace period expired
   */
  {
    state: AuthFlowState.PENDING_MFA_SETUP,
    priority: 5,
    condition: Rules.mfaSetupRequired,
    challenge: AuthChallenge.MFA_SETUP_REQUIRED,
    /**
     * OnEnter hook: Auto-complete SMS MFA setup if phone is already verified
     *
     * Special case: If user's phone is already verified and they choose SMS MFA,
     * we can skip the SMS verification step during setup (improves UX).
     * The phone was already verified, so we trust it for MFA setup.
     *
     * This sets skipMFAVerification flag which will be checked during MFA setup completion.
     */
    onEnter: async (context: AuthFlowContext): Promise<void> => {
      // Check if phone is verified and preferred method is SMS
      if (context.user.isPhoneVerified && context.user.phone && context.user.preferredMfaMethod === MFAMethod.SMS) {
        // Auto-complete: Set skipMFAVerification flag
        // This will be used during MFA setup completion to skip SMS verification
        context.skipMFAVerification = true;
      }
    },
  },

  /**
   * Priority 6: MFA Verification Required
   * Required when MFA is enabled and verification is needed
   */
  {
    state: AuthFlowState.PENDING_MFA_VERIFICATION,
    priority: 6,
    condition: Rules.mfaVerificationRequired,
    challenge: AuthChallenge.MFA_REQUIRED,
  },

  /**
   * Priority 7: Grace Period Active
   * ADAPTIVE mode with grace period active and MFA not enabled
   * This is a special state that allows login but includes metadata about grace period
   */
  {
    state: AuthFlowState.GRACE_PERIOD_ACTIVE,
    priority: 7,
    condition: Rules.gracePeriodActiveAdaptive,
    /**
     * Build metadata for grace period state
     * Includes grace period end timestamp and risk information
     */
    buildMetadata: (context: AuthFlowContext): ResponseMetadata | undefined => {
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
    state: AuthFlowState.BLOCKED,
    priority: 8,
    condition: Rules.isBlocked,
    /**
     * Build metadata for blocked state
     * Includes block expiration and reason
     */
    buildMetadata: (context: AuthFlowContext): ResponseMetadata | undefined => {
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
    state: AuthFlowState.AUTHENTICATED,
    priority: 9,
    condition: Rules.authenticated,
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
export function getStateDefinition(state: AuthFlowState): StateDefinition | undefined {
  return STATE_DEFINITIONS.find((def) => def.state === state);
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
export function getStateDefinitionsByPriority(): StateDefinition[] {
  return [...STATE_DEFINITIONS].sort((a, b) => a.priority - b.priority);
}
