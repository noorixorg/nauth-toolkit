import type { StorageAdapter } from '@nauth-toolkit/core';
import { NAuthOIDCAdapter } from './storage.adapter';

/**
 * Ends a user's OpenID Connect sessions and grants.
 *
 * The provider keeps its own SSO session, entirely separate from nauth's. Without
 * this, logging out of the application leaves that session standing, and the next
 * authorization request from any client silently issues a fresh code for a user who
 * believes they signed out. That is the single most important thing to wire up when
 * adopting this package.
 *
 * Sessions and grants are found through the per-account marker keys the storage
 * adapter writes, so this needs no extra index and no table.
 *
 * @example
 * ```typescript
 * // In your logout controller, after nauth has revoked its own session:
 * await sessionTerminator.terminateFor(user.sub);
 * ```
 */
export class OIDCSessionTerminator {
  constructor(private readonly storage: StorageAdapter) {}

  /**
   * End every OpenID Connect session and grant belonging to a user.
   *
   * Destroying the sessions is what makes the provider's `_session` cookie stop
   * resolving; destroying the grants means the next authorization request asks for
   * consent again rather than reusing a remembered one.
   *
   * Tokens already issued to clients are deliberately **not** revoked. They have their
   * own lifecycle: a third party holding a valid access token should not lose it
   * because the user closed a browser tab. Revoke those explicitly, or let them
   * expire.
   *
   * @param sub - The user's external identifier
   * @returns How many sessions and grants were destroyed
   */
  async terminateFor(sub: string): Promise<{ sessions: number; grants: number }> {
    const sessions = await new NAuthOIDCAdapter('Session', this.storage).revokeByAccountId(sub);
    const grants = await new NAuthOIDCAdapter('Grant', this.storage).revokeByAccountId(sub);
    return { sessions, grants };
  }

  /**
   * End every OpenID Connect session and grant, and revoke outstanding tokens too.
   *
   * The stronger form, for when an account is disabled or compromised: a suspended
   * user's third-party integrations must stop working immediately, not at the next
   * token expiry.
   *
   * @param sub - The user's external identifier
   * @returns How many artifacts of each kind were destroyed
   */
  async terminateAndRevokeFor(sub: string): Promise<{
    sessions: number;
    grants: number;
    accessTokens: number;
    refreshTokens: number;
    authorizationCodes: number;
  }> {
    const { sessions, grants } = await this.terminateFor(sub);
    return {
      sessions,
      grants,
      accessTokens: await new NAuthOIDCAdapter('AccessToken', this.storage).revokeByAccountId(sub),
      refreshTokens: await new NAuthOIDCAdapter('RefreshToken', this.storage).revokeByAccountId(sub),
      authorizationCodes: await new NAuthOIDCAdapter('AuthorizationCode', this.storage).revokeByAccountId(sub),
    };
  }
}
