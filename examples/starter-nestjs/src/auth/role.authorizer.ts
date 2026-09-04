import { Injectable } from '@nestjs/common';
import type {
  AuthorizationContext,
  AuthorizationDecision,
  IAuthorizationProvider,
} from '@nauth-toolkit/nestjs';

/**
 * Decides who may perform administrative operations.
 *
 * nauth-toolkit authenticates but defines no role model — deliberately, because every
 * application models authority differently. This is where you supply yours. Without a
 * provider like this one, mounting the `admin` route group is refused at startup.
 *
 * The provider is consulted by the *service* layer, so this policy applies however an
 * admin operation is reached: a shipped route, a controller you wrote, or a script.
 *
 * This example reads an allowlist from the environment, which is enough for a starter
 * and cannot be influenced by the user. A real application would look the caller up in
 * its own store — a column on its user entity, a roles table, or an external policy
 * service — keyed on `actor.sub`.
 */
@Injectable()
export class RoleAuthorizer implements IAuthorizationProvider {
  /**
   * Administrator email addresses, from `ADMIN_EMAILS` (comma-separated).
   *
   * Deliberately NOT read from `user.metadata`: that column is caller-writable through
   * signup and the self-service profile update, so anyone could make themselves an
   * administrator. Authority must live somewhere the user cannot write.
   */
  private readonly admins = new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  /**
   * Decide whether one privileged action may proceed.
   *
   * @param context - The actor, the action, and the user being acted upon
   * @returns Whether to allow, and why not when denying
   */
  authorize({ actor, action, targetSub }: AuthorizationContext): AuthorizationDecision {
    if (!actor) {
      return { allow: false, reason: 'Authentication required' };
    }

    // Some capabilities are worth refusing outright. Excluding the route hides the
    // endpoint; denying the action here closes the capability, whoever calls it.
    if (action === 'admin.user.setPassword') {
      return { allow: false, reason: 'Password changes go through the email reset flow' };
    }

    if (!this.admins.has(actor.email?.toLowerCase() ?? '')) {
      return { allow: false, reason: 'Requires the admin role' };
    }

    // An admin acting on their own account is self-service, not administration.
    if (targetSub && targetSub === actor.sub) {
      return { allow: false, reason: 'Use the self-service endpoints for your own account' };
    }

    return { allow: true };
  }
}
