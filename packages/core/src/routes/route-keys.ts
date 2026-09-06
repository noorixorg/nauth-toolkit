/**
 * Shipped route identifiers
 *
 * Every route the toolkit can mount has a stable key. Keys are the vocabulary of
 * `exclude`, and where a route has a client-SDK counterpart the key matches the
 * `defaultEndpoints` / `defaultAdminEndpoints` key exactly, so the two ends of the
 * contract can be checked against each other mechanically.
 *
 * @packageDocumentation
 */

/**
 * Which bundle a route ships in.
 *
 * Groups select what gets mounted; they are orthogonal to a route's access level.
 * `adminCreateKey` belongs to the `apiKeysAdmin` group and has `access: 'admin'`;
 * `challengeSetupData` belongs to `challenge` and is `access: 'public'`.
 */
export type NAuthRouteGroup =
  /**
   * Sign-up, sign-in, refresh, sign-out, password recovery, and the challenge
   * endpoints that complete them.
   *
   * Challenges are not a separate group on purpose: `login` can answer with
   * `VERIFY_EMAIL`, `MFA_REQUIRED` or `FORCE_CHANGE_PASSWORD`, and without
   * `respond-challenge` the caller would be handed a challenge it cannot answer.
   */
  | 'core'
  /** The current user's own profile and password. */
  | 'profile'
  /** MFA enrolment and device management for the current user. */
  | 'mfa'
  /** Social account linking and OAuth redirect flows. */
  | 'social'
  /** Session listing, revocation and device trust. */
  | 'device'
  /** The current user's own audit history. */
  | 'audit'
  /** The current user's own API keys. */
  | 'apiKeys'
  /** Administrative user, session and MFA operations. Never mounted by default. */
  | 'admin'
  /** Administrative API-key operations. Never mounted by default. */
  | 'apiKeysAdmin';

/**
 * Groups mounted when a bundle does not name any.
 *
 * `admin` and `apiKeysAdmin` are deliberately absent: administrative endpoints are only
 * ever exposed when a consumer asks for them explicitly, and then only with an
 * authorization provider configured.
 */
export const DEFAULT_ROUTE_GROUPS: readonly NAuthRouteGroup[] = [
  'core',
  'profile',
  'mfa',
  'social',
  'device',
  'audit',
  'apiKeys',
];

/** Self-service routes: the signed-in (or signing-in) user acting on their own account. */
export type NAuthSelfRouteKey =
  // core
  | 'signup'
  | 'login'
  | 'logout'
  | 'logoutAll'
  | 'refresh'
  | 'forgotPassword'
  | 'confirmForgotPassword'
  | 'confirmAdminResetPassword'
  | 'respondChallenge'
  | 'resendCode'
  | 'getSetupData'
  | 'getChallengeData'
  // profile
  | 'profile'
  | 'updateProfile'
  | 'changePassword'
  // mfa
  | 'mfaStatus'
  | 'mfaDevices'
  | 'mfaAvailableMethods'
  | 'mfaSetupData'
  | 'mfaVerifySetup'
  | 'mfaPreferred'
  | 'mfaRemoveDevice'
  | 'mfaBackupCodes'
  // social
  | 'socialLinked'
  | 'socialLink'
  | 'socialUnlink'
  | 'socialVerify'
  | 'socialRedirectStart'
  | 'socialCallback'
  | 'socialCallbackPost'
  | 'socialExchange'
  | 'socialCanSetPassword'
  | 'socialSetPassword'
  // device + sessions
  | 'trustDevice'
  | 'isTrustedDevice'
  | 'sessions'
  | 'logoutSession'
  | 'trustedDevices'
  | 'revokeTrustedDevice'
  | 'revokeAllTrustedDevices'
  // audit
  | 'auditHistory'
  // api keys
  | 'apiKeyCreate'
  | 'apiKeyList'
  | 'apiKeyUpdate'
  | 'apiKeyRevoke'
  | 'apiKeyDelete';

/** Administrative routes: an authorized operator acting on another user's account. */
export type NAuthAdminRouteKey =
  | 'adminSignup'
  | 'adminSignupSocial'
  | 'adminGetUsers'
  | 'adminGetUser'
  | 'adminGetUserByEmail'
  | 'adminDeleteUser'
  | 'adminDisableUser'
  | 'adminEnableUser'
  | 'adminForcePasswordChange'
  | 'adminUpdateVerifiedStatus'
  | 'adminUpdateUser'
  | 'adminSetPassword'
  | 'adminResetPasswordInitiate'
  | 'adminGetUserTrustedDevices'
  | 'adminRevokeUserTrustedDevice'
  | 'adminRevokeAllUserTrustedDevices'
  | 'adminGetUserSessions'
  | 'adminRevokeUserSession'
  | 'adminLogoutAll'
  | 'adminGetMfaStatus'
  | 'adminGetMfaDevices'
  | 'adminRemoveMfaDevice'
  | 'adminSetPreferredMfaDevice'
  | 'adminSetMfaExemption'
  | 'adminGetAuditHistory'
  | 'adminGetEventsByType'
  | 'adminGetSuspiciousActivity'
  | 'adminGetRiskAssessmentHistory'
  | 'adminApiKeyCreate'
  | 'adminApiKeyList'
  | 'adminApiKeyUpdate'
  | 'adminApiKeyRevoke'
  | 'adminApiKeyDelete';

/** Every shipped route key. */
export type NAuthRouteKey = NAuthSelfRouteKey | NAuthAdminRouteKey;
