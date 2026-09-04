/**
 * Injection tokens for the OpenID Connect provider module.
 *
 * Kept in their own file so a controller can inject the bridge without importing the
 * module that registers the controller.
 */

/** Injection token for the configured `oidc-provider` instance. */
export const NAUTH_OIDC_PROVIDER = 'NAUTH_OIDC_PROVIDER';

/** Injection token for the interaction bridge. */
export const NAUTH_OIDC_BRIDGE = 'NAUTH_OIDC_BRIDGE';

/** Injection token for the single-logout helper. */
export const NAUTH_OIDC_SESSIONS = 'NAUTH_OIDC_SESSIONS';
