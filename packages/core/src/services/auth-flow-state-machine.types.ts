import { IUser } from '../interfaces/entities.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { AuthChallenge } from '../dto/auth-challenge.dto';

/**
 * Authentication flow states
 *
 * Represents the current state of the authentication flow.
 * States are evaluated in priority order (1-9).
 *
 * @example
 * ```typescript
 * const state = AuthFlowState.PENDING_EMAIL_VERIFICATION;
 * ```
 */
export enum AuthFlowState {
  /**
   * User must change password before continuing
   * Priority: 1 (highest)
   */
  PENDING_PASSWORD_CHANGE = 'PENDING_PASSWORD_CHANGE',

  /**
   * User must verify email address
   * Priority: 2
   */
  PENDING_EMAIL_VERIFICATION = 'PENDING_EMAIL_VERIFICATION',

  /**
   * User must provide phone number
   * Priority: 3
   */
  PENDING_PHONE_COLLECTION = 'PENDING_PHONE_COLLECTION',

  /**
   * User must verify phone number
   * Priority: 4
   */
  PENDING_PHONE_VERIFICATION = 'PENDING_PHONE_VERIFICATION',

  /**
   * User must set up MFA
   * Priority: 5
   */
  PENDING_MFA_SETUP = 'PENDING_MFA_SETUP',

  /**
   * User must verify MFA
   * Priority: 6
   */
  PENDING_MFA_VERIFICATION = 'PENDING_MFA_VERIFICATION',

  /**
   * Grace period is active (MFA setup optional)
   * Priority: 7
   */
  GRACE_PERIOD_ACTIVE = 'GRACE_PERIOD_ACTIVE',

  /**
   * User is blocked from signing in
   * Priority: 8
   */
  BLOCKED = 'BLOCKED',

  /**
   * Authentication complete - user is fully authenticated
   * Priority: 9 (lowest - default state)
   */
  AUTHENTICATED = 'AUTHENTICATED',
}

/**
 * Authentication flow context
 *
 * Contains all data needed to evaluate authentication flow state.
 * Pre-computed values are stored in the `computed` property to optimize rule evaluation.
 *
 * @example
 * ```typescript
 * const context: AuthFlowContext = {
 *   user,
 *   config,
 *   authMethod: 'password',
 *   computed: {
 *     isEmailVerificationRequired: true,
 *     isPhoneVerificationRequired: false,
 *     isMFAExempt: false,
 *     // ... other computed values
 *   }
 * };
 * ```
 */
export interface AuthFlowContext {
  /**
   * User attempting authentication
   */
  user: IUser;

  /**
   * Authentication configuration
   */
  config: NAuthConfig;

  /**
   * Authentication method ('password' or 'social')
   */
  authMethod?: 'password' | 'social';

  /**
   * Social auth provider name (e.g., 'google', 'apple', 'facebook')
   */
  authProvider?: string;

  /**
   * Device token for trusted device check
   */
  deviceToken?: string;

  /**
   * Skip MFA verification flag (used for special cases like phone auto-complete)
   */
  skipMFAVerification?: boolean;

  /**
   * Pre-computed values for rule evaluation
   * These are calculated once at the beginning of the flow to optimize performance.
   */
  computed: {
    /**
     * Whether email verification is required
     */
    isEmailVerificationRequired: boolean;

    /**
     * Whether phone verification is required
     */
    isPhoneVerificationRequired: boolean;

    /**
     * Whether phone collection is needed (user has no phone)
     */
    isPhoneCollectionNeeded: boolean;

    /**
     * Whether user is exempt from MFA
     */
    isMFAExempt: boolean;

    /**
     * Whether MFA setup is required
     */
    isMFASetupRequired: boolean;

    /**
     * Whether MFA verification is required
     */
    isMFAVerificationRequired: boolean;

    /**
     * Whether device is trusted
     */
    isDeviceTrusted: boolean;

    /**
     * Whether grace period is active
     */
    isGracePeriodActive: boolean;

    /**
     * Grace period end timestamp (if active)
     */
    gracePeriodEndsAt?: Date;

    /**
     * Whether user is blocked
     */
    isBlocked: boolean;

    /**
     * Block expiration timestamp (if blocked)
     */
    blockedUntil?: Date;

    /**
     * Block reason (if blocked)
     */
    blockReason?: string;

    /**
     * Risk score (0-100) for adaptive MFA
     */
    riskScore?: number;

    /**
     * Risk level ('low' | 'medium' | 'high')
     */
    riskLevel?: 'low' | 'medium' | 'high';
  };
}

/**
 * Rule function type
 *
 * A rule is a function that evaluates to true or false based on the context.
 * Rules can be combined using RuleBuilder combinators (all, any, not).
 *
 * @param context - Authentication flow context
 * @returns True if rule condition is met, false otherwise
 *
 * @example
 * ```typescript
 * const mustChangePassword: Rule = (context) => {
 *   return context.user.mustChangePassword === true;
 * };
 * ```
 */
export type Rule = (context: AuthFlowContext) => boolean;

/**
 * Response metadata
 *
 * Additional information to include in the authentication response.
 * Used for special states like grace period and blocked state.
 *
 * @example
 * ```typescript
 * const metadata: ResponseMetadata = {
 *   gracePeriodEndsAt: new Date('2024-01-15'),
 *   riskScore: 45,
 *   riskLevel: 'medium'
 * };
 * ```
 */
export interface ResponseMetadata {
  /**
   * Grace period end timestamp
   */
  gracePeriodEndsAt?: Date;

  /**
   * Risk score (0-100)
   */
  riskScore?: number;

  /**
   * Risk level
   */
  riskLevel?: 'low' | 'medium' | 'high';

  /**
   * Block expiration timestamp
   */
  blockedUntil?: Date;

  /**
   * Block reason
   */
  reason?: string;
}

/**
 * State definition
 *
 * Defines a state in the authentication flow, including:
 * - Priority (evaluation order)
 * - Condition rule (when this state applies)
 * - Challenge mapping (which AuthChallenge this state maps to)
 * - Metadata builder (optional additional response data)
 * - OnEnter hook (optional action when state is entered)
 *
 * @example
 * ```typescript
 * const stateDef: StateDefinition = {
 *   state: AuthFlowState.PENDING_EMAIL_VERIFICATION,
 *   priority: 2,
 *   condition: Rules.emailVerificationPending,
 *   challenge: AuthChallenge.VERIFY_EMAIL,
 * };
 * ```
 */
export interface StateDefinition {
  /**
   * State identifier
   */
  state: AuthFlowState;

  /**
   * Priority (1-9, lower = higher priority)
   * States are evaluated in priority order
   */
  priority: number;

  /**
   * Condition rule that determines if this state applies
   */
  condition: Rule;

  /**
   * Challenge type this state maps to (if applicable)
   * Undefined for AUTHENTICATED and GRACE_PERIOD_ACTIVE states
   */
  challenge?: AuthChallenge;

  /**
   * Build metadata for response (optional)
   * Used for states that need to include additional information
   */
  buildMetadata?: (context: AuthFlowContext) => ResponseMetadata | undefined;

  /**
   * OnEnter hook (optional)
   * Executed when this state is entered
   * Can modify context (e.g., set skipMFAVerification flag)
   */
  onEnter?: (context: AuthFlowContext) => Promise<void> | void;
}
