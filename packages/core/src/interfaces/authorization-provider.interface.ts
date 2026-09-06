/**
 * Authorization provider contract
 *
 * nauth-toolkit authenticates: it proves who the caller is. It deliberately does not
 * define *what* they may do — there is no role, permission or scope model anywhere in
 * the toolkit, because every application models authority differently (flat roles,
 * permission sets, tenant-scoped grants, an external policy service).
 *
 * Privileged operations therefore delegate the decision to a provider the consumer
 * supplies. Absent a provider, `AdminAuthService` behaves exactly as it always has —
 * it trusts its caller — and admin routes refuse to mount. Supply one and every
 * privileged service method consults it, whether it was reached through a shipped
 * route, a hand-written controller, or a script.
 *
 * @packageDocumentation
 */

import { IUser } from './entities.interface';
import { NAuthRequest } from '../platform/interfaces';

/**
 * A privileged operation, named independently of any route.
 *
 * Actions belong to the service, not the transport: `AdminAuthService.deleteUser`
 * authorizes `admin.user.delete` however it was called. That is what lets a single
 * policy cover a shipped route, a replacement controller and a background job alike.
 *
 * Deliberately a closed union rather than `string`, so a typo in a provider is a
 * compile error rather than a silent allow.
 *
 * @remarks
 * Three methods that sit on privileged services are **absent by design**, because their
 * callers are unauthenticated. Authorizing any of them would break a working flow:
 *
 * - `AdminAuthService.confirmResetPassword` — completes an admin-*initiated* reset, but
 *   is called by the end user from an emailed link with a code. Served at
 *   `POST /auth/reset-password/confirm` as a public route.
 * - `MFAService.getSetupData` and `MFAService.getChallengeData` — reached mid-challenge,
 *   while the user is proving a second factor and therefore not yet authenticated. They
 *   are authorized by the challenge session token, not by a JWT.
 *
 * The rule: a method living on an admin-ish service does not make its caller an admin.
 * Check how a method is actually reached before adding an action for it.
 */
export type AuthAction =
  /** Create a user directly, bypassing signup. */
  | 'admin.user.create'
  /** Create a user from a social identity, bypassing the OAuth flow. */
  | 'admin.user.createSocial'
  /** Read another user's profile, by `sub` or by email. */
  | 'admin.user.read'
  /** List or search users. */
  | 'admin.user.list'
  /** Edit another user's attributes. */
  | 'admin.user.update'
  /** Permanently delete a user. */
  | 'admin.user.delete'
  /** Disable a user, blocking sign-in. */
  | 'admin.user.disable'
  /** Re-enable a disabled user. */
  | 'admin.user.enable'
  /** Force a password change on next sign-in. */
  | 'admin.user.forcePasswordChange'
  /** Override email/phone verified flags. */
  | 'admin.user.updateVerifiedStatus'
  /** Begin an admin-initiated password reset (sends the user a code). */
  | 'admin.user.resetPassword'
  /** Set a user's password outright, without their involvement. */
  | 'admin.user.setPassword'
  /** List another user's active sessions. */
  | 'admin.session.list'
  /** Revoke one of another user's sessions. */
  | 'admin.session.revoke'
  /** Revoke every session belonging to another user. */
  | 'admin.session.revokeAll'
  /** List another user's trusted devices. */
  | 'admin.trustedDevice.list'
  /** Revoke one of another user's trusted devices. */
  | 'admin.trustedDevice.revoke'
  /** Revoke every trusted device belonging to another user. */
  | 'admin.trustedDevice.revokeAll'
  /** Read another user's MFA enrolment status. */
  | 'admin.mfa.readStatus'
  /** List another user's MFA devices. */
  | 'admin.mfa.listDevices'
  /** Remove one of another user's MFA devices. */
  | 'admin.mfa.removeDevice'
  /** Change which of another user's MFA devices is preferred. */
  | 'admin.mfa.setPreferred'
  /** Grant or revoke an exemption from MFA enforcement. */
  | 'admin.mfa.setExemption'
  /** Read audit history beyond the caller's own. */
  | 'admin.audit.read'
  /** Issue an API key on another user's behalf. */
  | 'admin.apiKey.create'
  /** List another user's API keys. */
  | 'admin.apiKey.list'
  /** Modify another user's API key. */
  | 'admin.apiKey.update'
  /** Revoke another user's API key. */
  | 'admin.apiKey.revoke'
  /** Delete another user's API key. */
  | 'admin.apiKey.delete';

/**
 * Everything a provider needs to decide.
 *
 * Carries the actor, the action *and* the target, which is what allows policies beyond
 * flat role checks — tenant scoping, or "an admin may not act on another admin".
 */
export interface AuthorizationContext {
  /**
   * The authenticated caller, resolved from request context.
   *
   * Undefined when the call did not arrive over HTTP — a script or background job. Such
   * calls are denied unless wrapped in `runAsSystem()`, which bypasses the provider
   * entirely rather than calling it with no actor.
   */
  readonly actor?: IUser;

  /** The operation being attempted. */
  readonly action: AuthAction;

  /**
   * External identifier of the user being acted upon, when the action targets someone.
   *
   * Absent for non-targeted actions such as `admin.user.list`.
   */
  readonly targetSub?: string;

  /** The active request, when one exists. */
  readonly request?: NAuthRequest;

  /** True when the caller authenticated with an API key rather than a session. */
  readonly viaApiKey?: boolean;
}

/**
 * A provider's verdict.
 *
 * An object rather than a boolean so a denial can carry a reason, which is recorded on
 * the audit trail and returned to the caller.
 */
export interface AuthorizationDecision {
  /** Whether the action may proceed. */
  readonly allow: boolean;

  /**
   * Why, in terms safe to show the caller.
   *
   * Surfaced as the `FORBIDDEN` message and stored against the denial audit record.
   */
  readonly reason?: string;
}

/**
 * Decides whether privileged operations may proceed.
 *
 * Register one instance with `NAuth.create({ authorization })` or, under NestJS,
 * `AuthModule.forRoot({ authorization })` — which accepts a class so the provider can
 * use dependency injection.
 *
 * @example
 * ```typescript
 * export class RoleAuthorizer implements IAuthorizationProvider {
 *   constructor(private readonly roles: RolesService) {}
 *
 *   async authorize({ action, actor, targetSub }: AuthorizationContext): Promise<AuthorizationDecision> {
 *     if (!actor) return { allow: false, reason: 'Authentication required' };
 *     // Some capabilities should never be exercised, by anyone.
 *     if (action === 'admin.user.setPassword') {
 *       return { allow: false, reason: 'Password changes go through the email reset flow' };
 *     }
 *     // Roles live in the consumer's own store, never in `user.metadata` — that column is
 *     // caller-writable through signup and the self-service profile update.
 *     if (!(await this.roles.isAdmin(actor.sub))) {
 *       return { allow: false, reason: 'Requires the admin role' };
 *     }
 *     // Admins may not act on one another.
 *     if (targetSub && targetSub !== actor.sub && (await this.roles.isAdmin(targetSub))) {
 *       return { allow: false, reason: 'Admins cannot modify other admins' };
 *     }
 *     return { allow: true };
 *   }
 * }
 * ```
 */
export interface IAuthorizationProvider {
  /**
   * Decide whether the described action may proceed.
   *
   * Throwing is treated as a denial, so a provider that calls out to a policy service
   * may let failures propagate rather than mapping them itself.
   *
   * @param context - The actor, action and target
   * @returns The verdict, with an optional reason used for the 403 and the audit record
   */
  authorize(context: AuthorizationContext): Promise<AuthorizationDecision> | AuthorizationDecision;
}
