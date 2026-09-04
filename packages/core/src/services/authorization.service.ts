/**
 * Authorization Service
 *
 * Enforces the consumer-supplied {@link IAuthorizationProvider} for privileged service
 * methods. Privileged services take this as a single optional dependency rather than
 * each growing its own provider parameter, so extending enforcement to a new service is
 * one constructor argument and one call per method.
 *
 * Enforcement lives here — at the service layer — rather than in a route guard, because
 * a guard only protects the routes it is attached to. `AdminAuthService` is public API:
 * a hand-written controller, a script or a queue worker can all reach it, and each must
 * face the same policy.
 */

import { ContextStorage } from '../utils/context-storage';
import { isSystemContext } from '../utils/run-as-system';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser } from '../interfaces/entities.interface';
import { NAuthRequest } from '../platform/interfaces';
import {
  AuthAction,
  AuthorizationContext,
  AuthorizationDecision,
  IAuthorizationProvider,
} from '../interfaces/authorization-provider.interface';

/** What a caller knows about the operation, beyond the action itself. */
export interface AuthorizeOptions {
  /** External identifier of the user being acted upon, when there is one. */
  targetSub?: string;
}

/** The slice of the audit service used to record denials. */
export interface AuthorizationAuditRecorder {
  recordEvent(data: {
    sub?: string;
    eventType: AuthAuditEventType;
    eventStatus: AuthAuditEventStatus;
    reason?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;
}

/**
 * Applies the configured authorization provider to privileged operations.
 */
export class AuthorizationService {
  /**
   * @param provider - The consumer's provider. Absent means authorization is not configured.
   * @param logger - Used to report denials and misbehaving providers
   * @param getAuditRecorder - Resolves the audit service when a denial needs recording.
   *   A thunk rather than the service itself because the audit service is constructed
   *   after this one — it, and every other privileged service, depends on it.
   */
  constructor(
    private readonly provider?: IAuthorizationProvider,
    private readonly logger?: NAuthLogger,
    private readonly getAuditRecorder?: () => AuthorizationAuditRecorder | undefined,
  ) {}

  /**
   * Whether a provider is configured.
   *
   * Route mounting uses this to refuse to expose admin endpoints that nothing would
   * guard, failing at startup rather than at the first request.
   *
   * @returns true when privileged operations are being enforced
   */
  public isConfigured(): boolean {
    return this.provider !== undefined;
  }

  /**
   * Authorize a privileged operation, or throw.
   *
   * Order of decision:
   * 1. **No provider** — permitted. Preserves the behaviour of every release before
   *    authorization existed, so upgrading cannot break a running application.
   * 2. **System context** — permitted without consulting the provider. See `runAsSystem`.
   * 3. **No actor** — denied. Off the request path with no explicit bypass, there is
   *    nobody to authorize; treating that as trusted would wave through any background
   *    job reachable from user input.
   * 4. Otherwise the provider decides. A provider that throws is treated as a denial.
   *
   * @param action - The operation being attempted
   * @param options - The target of the operation, when it has one
   * @throws {NAuthException} `FORBIDDEN` when the operation is not permitted
   */
  public async authorize(action: AuthAction, options: AuthorizeOptions = {}): Promise<void> {
    if (!this.provider) return;

    if (isSystemContext()) {
      this.logger?.debug?.(`Authorization bypassed for '${action}' - running as system`);
      return;
    }

    const actor = ContextStorage.get<IUser>('CURRENT_USER');
    const request = ContextStorage.get<NAuthRequest>('REQUEST');
    const context: AuthorizationContext = {
      actor,
      action,
      targetSub: options.targetSub,
      request,
      // Set by ApiKeyHandler / AuthGuard on the request rather than in context storage.
      viaApiKey: request?.attributes?.nauthApiKeyAuth === true,
    };

    if (!actor) {
      await this.deny(context, 'No authenticated actor for a privileged operation');
      return;
    }

    let decision: AuthorizationDecision;
    try {
      decision = await this.provider.authorize(context);
    } catch (error) {
      // A provider that throws denies. Reaching out to a policy service is a normal
      // implementation, and a failure there must never read as an allow.
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Authorization provider threw for '${action}': ${message}`);
      await this.deny(context, 'Authorization provider error');
      return;
    }

    if (!decision?.allow) {
      await this.deny(context, decision?.reason);
    }
  }

  /**
   * Record and raise a denial.
   *
   * Denials are audited because they are more interesting than successes: a run of them
   * against admin actions is what a privilege-escalation attempt looks like.
   *
   * @param context - What was attempted, and by whom
   * @param reason - The provider's reason, surfaced to the caller and stored
   * @throws {NAuthException} Always
   */
  private async deny(context: AuthorizationContext, reason?: string): Promise<never> {
    const message = reason || 'Not permitted';

    this.logger?.warn?.(
      `Authorization denied for '${context.action}'` +
        `${context.actor?.sub ? ` (actor: ${context.actor.sub})` : ' (no actor)'}` +
        `${context.targetSub ? ` (target: ${context.targetSub})` : ''}: ${message}`,
    );

    try {
      await this.getAuditRecorder?.()?.recordEvent({
        sub: context.targetSub,
        eventType: AuthAuditEventType.AUTHORIZATION_DENIED,
        eventStatus: 'FAILURE',
        reason: message,
        description: `Authorization denied for ${context.action}`,
        metadata: {
          action: context.action,
          actorSub: context.actor?.sub ?? null,
          targetSub: context.targetSub ?? null,
          viaApiKey: context.viaApiKey ?? false,
        },
      });
    } catch (error) {
      // Auditing must never convert a denial into a different failure.
      this.logger?.error?.(
        `Failed to record authorization denial: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    throw new NAuthException(AuthErrorCode.FORBIDDEN, message);
  }
}
