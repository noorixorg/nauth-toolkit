import { Repository } from 'typeorm';
import { BaseUser } from '../entities/user.entity';
import { NAuthConfig } from '../interfaces/config.interface';
import { IUser } from '../interfaces/entities.interface';
import { ContextStorage } from '../utils/context-storage';
import { NAuthLogger } from '../utils/nauth-logger';

/**
 * Why an identity-provider request cannot proceed as it stands.
 */
export type IdpGateResult =
  | {
      /** The user is fully authenticated; the request may proceed. */
      status: 'authenticated';
      user: IUser;
    }
  | {
      /** The user must (re-)authenticate. Park the request and send them to login. */
      status: 'login_required';
      reason: 'no_session' | 'password_change_required' | 'email_verification_required';
    }
  | {
      /** The user is known but must not be issued anything. Fail the request outright. */
      status: 'denied';
      reason: 'account_disabled' | 'account_locked' | 'account_unavailable';
      /**
       * External identifier of the account that was refused.
       *
       * Present whenever the request carried a session — which is every `denied`
       * verdict, since the check is what identified the account in the first place. It
       * is what lets a refusal be attributed in an audit trail.
       */
      sub: string;
    };

/**
 * Identity Provider Session Gate
 *
 * Answers one protocol-neutral question: *is there a fully completed nauth login
 * behind this request, good enough to issue credentials to a relying party?*
 *
 * The OAuth2 authorization endpoint uses it before minting an authorization code.
 * Nothing about it is OAuth-specific, so a future SAML identity provider — or any
 * other protocol where a third party asks this application to vouch for a user — can
 * use the same gate rather than reimplementing the checks.
 *
 * Relationship to the login flow: reaching this point with a `CURRENT_USER` in
 * context already means the auth handler validated an access token, and such a token
 * is only issued once the challenge state machine reaches `AUTHENTICATED` — email and
 * phone verification, MFA setup and MFA verification all satisfied. What this gate
 * adds is a re-read of the account state that can change *after* a token was issued:
 * an administrator disabling the account, locking it, or forcing a password change
 * mid-session. Those must stop a third party from being handed credentials, even
 * though the bearer's own session is still technically valid.
 *
 * @example
 * ```typescript
 * const gate = await idpSessionGate.evaluate();
 * if (gate.status === 'login_required') {
 *   const requestId = await codeStore.parkRequest(validated);
 *   return { redirectTo: buildLoginUrl(requestId) };
 * }
 * if (gate.status === 'denied') {
 *   throw new NAuthException(AuthErrorCode.OIDC_ACCESS_DENIED, 'Account unavailable');
 * }
 * // gate.user is fully authenticated
 * ```
 */
export class IdpSessionGate {
  constructor(
    private readonly userRepository: Repository<BaseUser>,
    private readonly config: NAuthConfig,
    private readonly logger?: NAuthLogger,
  ) {}

  /**
   * Evaluate the currently authenticated user, if any.
   *
   * Reads the user from request context (`CURRENT_USER`), then re-reads the account
   * from the database so that state changed since the access token was issued is
   * honoured.
   *
   * @returns Whether the request may proceed, needs a login, or must be refused
   */
  async evaluate(): Promise<IdpGateResult> {
    const contextUser = ContextStorage.get<IUser>('CURRENT_USER');
    if (!contextUser) {
      return { status: 'login_required', reason: 'no_session' };
    }

    // Re-read rather than trusting the token's snapshot: an administrator may have
    // disabled or locked the account since it was issued.
    const user = await this.userRepository.findOne({ where: { sub: contextUser.sub } });
    if (!user) {
      this.logger?.warn?.(
        `[IdpSessionGate] Authenticated context references a user that no longer exists (sub ${contextUser.sub})`,
      );
      return { status: 'denied', reason: 'account_unavailable', sub: contextUser.sub };
    }

    if (!user.isActive) {
      return { status: 'denied', reason: 'account_disabled', sub: user.sub };
    }

    if (this.isCurrentlyLocked(user)) {
      return { status: 'denied', reason: 'account_locked', sub: user.sub };
    }

    // A forced password change is recoverable: send the user through login, where
    // the challenge flow will make them change it, then resume.
    if (user.mustChangePassword) {
      return { status: 'login_required', reason: 'password_change_required' };
    }

    if (this.requiresEmailVerification() && !user.isEmailVerified) {
      return { status: 'login_required', reason: 'email_verification_required' };
    }

    return { status: 'authenticated', user: user as unknown as IUser };
  }

  /**
   * Whether the account is locked right now.
   *
   * A null `lockedUntil` is a permanent lock (an administrator disabling the
   * account); a past `lockedUntil` is a temporary lock that has already elapsed, and
   * is not treated as locked.
   */
  private isCurrentlyLocked(user: BaseUser): boolean {
    if (!user.isLocked) {
      return false;
    }
    if (user.lockedUntil === null || user.lockedUntil === undefined) {
      return true;
    }
    return new Date() < user.lockedUntil;
  }

  /**
   * Whether this deployment requires a verified email before a user is considered
   * fully authenticated.
   */
  private requiresEmailVerification(): boolean {
    const method = this.config.signup?.verificationMethod ?? 'email';
    return method === 'email' || method === 'both';
  }
}
