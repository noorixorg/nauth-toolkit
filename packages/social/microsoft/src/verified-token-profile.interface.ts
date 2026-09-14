/**
 * Verified Token Profile - Microsoft Entra ID
 *
 * Standardized return type for Microsoft ID token verification.
 * This is provider-specific and should not be in core.
 */
export interface VerifiedMicrosoftTokenProfile {
  /**
   * Subject claim.
   *
   * Pairwise: stable for one user in one application, and therefore **not** a durable
   * identity across applications. Use `oid` to identify the user.
   */
  sub: string;

  /**
   * Object id — the user's immutable id within their directory.
   *
   * This is the join key for a linked social account. Unlike email it cannot be changed
   * by the user or by a tenant administrator.
   */
  oid: string;

  /**
   * Tenant id — the directory that issued the token.
   */
  tid: string;

  /**
   * User's email address, when the token carries one.
   *
   * Entra does not guarantee this claim, and for work accounts its value is set by the
   * tenant administrator. Trust it for account linking only when
   * `emailDomainOwnerVerified` is true or the account is personal.
   */
  email?: string;

  /**
   * Whether the tenant is verified as owning the email address's domain.
   *
   * Derived from the `xms_edov` optional claim, which must be switched on in the app
   * registration's token configuration. Absent means "unproven", not "false claim".
   */
  emailDomainOwnerVerified: boolean;

  /**
   * Whether the token came from a personal Microsoft account rather than a work or
   * school account.
   */
  isPersonalAccount: boolean;

  /**
   * `preferred_username` claim — usually the user principal name.
   *
   * Used as an email fallback for work accounts whose token omits `email`.
   */
  preferredUsername?: string;

  /**
   * User's full display name.
   */
  name?: string;

  /**
   * User's first name (given name).
   */
  givenName?: string;

  /**
   * User's last name (family name).
   */
  familyName?: string;

  /**
   * App roles assigned to this user for this application, from the `roles` claim.
   *
   * Empty when the app registration defines no roles or none are assigned.
   */
  roles: string[];

  /**
   * Security group object ids, from the `groups` claim.
   *
   * Empty when the optional groups claim is not configured. An empty array is
   * indistinguishable from "not configured", which is why `hasGroupsOverage` exists.
   */
  groups: string[];

  /**
   * Whether Entra omitted the groups claim because the user is in too many groups.
   *
   * Past roughly 200 groups the token carries `_claim_names`/`_claim_sources` pointing at
   * Graph instead of the group list. Treating that as "member of nothing" would silently
   * deny (or, with an inverted check, silently admit) exactly the most heavily
   * group-assigned users, so it is surfaced rather than swallowed.
   */
  hasGroupsOverage: boolean;

  /**
   * Raw verified JWT payload, for diagnostics and attribute mapping.
   */
  raw: Record<string, unknown>;
}
