import { AuthFlowState, AuthFlowContext, StateDefinition, ResponseMetadata } from './auth-flow-state-machine.types';
import { AuthFlowContextBuilder } from './auth-flow-context-builder.service';
import { NAuthLogger } from '../utils/nauth-logger';
import { getStateDefinitionsByPriority, getStateDefinition } from './auth-flow-state-definitions';

/**
 * Authentication Flow State Machine Service
 *
 * Core engine for evaluating authentication flow states using declarative rules.
 * Replaces imperative if/else logic with a rule-based state machine.
 *
 * **How it works:**
 * 1. Build context with pre-computed values
 * 2. Evaluate states in priority order (1-9)
 * 3. Select first state whose condition rule evaluates to true
 * 4. Execute onEnter hook if defined
 * 5. Return state with metadata
 *
 * **Benefits:**
 * - Declarative and maintainable
 * - Easy to test (pure functions)
 * - Extensible (add new states/rules easily)
 * - Clear priority ordering
 *
 * @example
 * ```typescript
 * const state = await stateMachine.evaluateState(context);
 * const definition = stateMachine.getStateDefinition(state);
 * ```
 */
export class AuthFlowStateMachineService {
  constructor(
    private readonly contextBuilder: AuthFlowContextBuilder,
    private readonly logger?: NAuthLogger,
  ) {}

  /**
   * Evaluate authentication flow state
   *
   * Evaluates states in priority order and returns the first matching state.
   * Executes onEnter hook if defined for the selected state.
   *
   * @param context - Authentication flow context
   * @returns Evaluated state
   *
   * @example
   * ```typescript
   * const context = await contextBuilder.build({ user, config, authMethod: 'password' });
   * const state = await stateMachine.evaluateState(context);
   * // Returns: AuthFlowState.PENDING_EMAIL_VERIFICATION
   * ```
   */
  async evaluateState(context: AuthFlowContext): Promise<AuthFlowState> {
    // Get state definitions sorted by priority
    const stateDefinitions = getStateDefinitionsByPriority();

    this.logger?.debug?.(
      `[StateMachine] Evaluating states for user ${context.user.sub} (priority 1-9, first match wins)`,
    );

    // Evaluate states in priority order
    for (const definition of stateDefinitions) {
      // Evaluate condition rule
      const ruleResult = definition.condition(context);
      this.logger?.debug?.(
        `[StateMachine] Priority ${definition.priority}: ${definition.state} → ${ruleResult ? 'MATCH' : 'skip'}`,
      );

      if (ruleResult) {
        // State matches - execute onEnter hook if defined
        if (definition.onEnter) {
          this.logger?.debug?.(`[StateMachine] Executing onEnter hook for ${definition.state}`);
          try {
            await definition.onEnter(context);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger?.warn?.(`onEnter hook failed for state ${definition.state}: ${errorMessage}`, {
              error,
              state: definition.state,
              userId: context.user.id,
            });
            // Continue with state selection even if hook fails
          }
        }

        this.logger?.debug?.(`[StateMachine] Selected state: ${definition.state} for user ${context.user.sub}`);
        return definition.state;
      }
    }

    // Fallback: Should never reach here (AUTHENTICATED always matches)
    // But return AUTHENTICATED as safe default
    this.logger?.warn?.(`No state matched for user ${context.user.sub} - falling back to AUTHENTICATED`, {
      userId: context.user.id,
    });
    return AuthFlowState.AUTHENTICATED;
  }

  /**
   * Get state definition by state
   *
   * @param state - State to get definition for
   * @returns State definition or undefined if not found
   *
   * @example
   * ```typescript
   * const def = stateMachine.getStateDefinition(AuthFlowState.PENDING_EMAIL_VERIFICATION);
   * ```
   */
  getStateDefinition(state: AuthFlowState): StateDefinition | undefined {
    return getStateDefinition(state);
  }

  /**
   * Build metadata for state response
   *
   * Calls buildMetadata function if defined for the state.
   *
   * @param state - State to build metadata for
   * @param context - Authentication flow context
   * @returns Metadata object or undefined
   *
   * @example
   * ```typescript
   * const metadata = await stateMachine.buildMetadata(state, context);
   * // Returns: { gracePeriodEndsAt: Date, riskScore: 45, riskLevel: 'medium' }
   * ```
   */
  buildMetadata(state: AuthFlowState, context: AuthFlowContext): ResponseMetadata | undefined {
    const definition = this.getStateDefinition(state);
    if (!definition || !definition.buildMetadata) {
      return undefined;
    }

    try {
      return definition.buildMetadata(context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`buildMetadata failed for state ${state}: ${errorMessage}`, {
        error,
        state,
        userId: context.user.id,
      });
      return undefined;
    }
  }

  /**
   * Transition after challenge completion
   *
   * Re-evaluates state after a challenge is completed.
   * This is used in the challenge completion flow to determine the next state.
   *
   * @param params - Transition parameters
   * @param params.completedChallenge - Challenge that was just completed
   * @param params.context - Current authentication flow context
   * @param params.updateFn - Function to update user data (e.g., mark email as verified)
   * @returns New state after transition
   *
   * @example
   * ```typescript
   * const newState = await stateMachine.transitionAfterChallenge({
   *   completedChallenge: AuthChallenge.VERIFY_EMAIL,
   *   context,
   *   updateFn: async (user) => {
   *     user.isEmailVerified = true;
   *     await userRepository.save(user);
   *   }
   * });
   * ```
   */
  async transitionAfterChallenge(params: {
    completedChallenge: string;
    context: AuthFlowContext;
    updateFn?: (user: AuthFlowContext['user']) => Promise<void>;
  }): Promise<AuthFlowState> {
    const { completedChallenge, context, updateFn } = params;

    // Update user data if update function provided
    if (updateFn) {
      try {
        await updateFn(context.user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.error?.(`Failed to update user after challenge completion: ${errorMessage}`, {
          error,
          challenge: completedChallenge,
          userId: context.user.id,
        });
        // Continue with re-evaluation even if update fails
      }
    }

    // Re-build context with updated user data
    const newContext = await this.contextBuilder.build({
      user: context.user,
      config: context.config,
      authMethod: context.authMethod,
      authProvider: context.authProvider,
      deviceToken: context.deviceToken,
      skipMFAVerification: context.skipMFAVerification,
    });

    // Re-evaluate state
    return this.evaluateState(newContext);
  }
}
