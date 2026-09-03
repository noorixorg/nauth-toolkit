/**
 * OpenID Connect provider for nauth-toolkit.
 *
 * Turns an nauth-backed application into an OAuth2 authorization server and OpenID
 * Connect provider, so third parties can offer "Sign in with <your app>". The protocol
 * itself is implemented by the OpenID Certified `oidc-provider` library; this package
 * supplies the three things it needs from nauth — storage, accounts, and a login and
 * consent flow — and nothing else.
 *
 * nauth remains the sole authority on identity: the whole challenge state machine
 * (forced password change, email and phone verification, MFA setup and verification,
 * adaptive risk) runs before the bridge ever reports a completed login.
 *
 * @example
 * ```typescript
 * import { createNAuthOIDCProvider, mountOIDCProviderExpress } from '@nauth-toolkit/oidc-provider';
 *
 * const provider = await createNAuthOIDCProvider({
 *   issuer: 'https://demo.nauth.dev',        // an origin, never a path
 *   interactionUrl: (uid) => `https://demo.nauth.dev/interaction/${uid}`,
 *   storage: nauth.storage,
 *   userRepository,
 *   cookieKeys: [process.env.OIDC_COOKIE_SECRET!],
 * });
 *
 * mountOIDCProviderExpress(app, provider);   // before body parsers
 * ```
 */

export { createNAuthOIDCProvider, loadProviderCtor } from './create-provider';
export { createOIDCStorageAdapter, NAuthOIDCAdapter } from './storage.adapter';
export { createFindAccount } from './find-account';
export type { OIDCAccount } from './find-account';
export { OIDCInteractionBridge } from './interaction-bridge';
export type { InteractionStateDTO, InteractionRedirectDTO } from './interaction-bridge';
export { mountOIDCProviderExpress, isProviderPath } from './mount/express';
export { toRawHttp } from './raw-http';
export type { NAuthOIDCOptions, NAuthOIDCClient } from './config.types';
