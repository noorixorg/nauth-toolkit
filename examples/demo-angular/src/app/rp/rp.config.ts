import { LogLevel, type PassedInitialConfig } from 'angular-auth-oidc-client';
import { environment } from '../../environments/environment';

/**
 * The origin the OpenID Connect provider is served from.
 *
 * Same origin as the app. In development the Angular dev server proxies `/oidc` and
 * `/.well-known` to the backend (see `proxy.conf.json`); in production Caddy does the
 * same. Keeping provider and app on one origin means no CORS on the metadata
 * endpoints and no cross-site cookie rules to satisfy — which is how a real
 * deployment behind a reverse proxy is arranged anyway.
 *
 * This must equal the `iss` in the discovery document: a conformant client checks it.
 */
const PROVIDER_ORIGIN = window.location.origin;

/**
 * Configuration for the third-party application simulator.
 *
 * `demo-public` is registered as a public client: no secret, PKCE required. That is
 * the right shape for a browser application, which cannot keep a secret, and it means
 * this configuration can live in source without anything sensitive in it.
 *
 * `angular-auth-oidc-client` discovers everything else — the authorization, token,
 * UserInfo and JWKS endpoints — from the issuer's discovery document, and verifies
 * the id_token signature against the published keys. It is a separate, certified
 * implementation, so it exercises the provider the way a real integrator would rather
 * than the way this repository happens to expect.
 */
export const rpAuthConfig: PassedInitialConfig = {
  config: {
    authority: PROVIDER_ORIGIN,
    redirectUrl: `${window.location.origin}/rp/callback`,
    postLogoutRedirectUri: `${window.location.origin}/rp`,
    clientId: 'demo-public',
    scope: 'openid email profile offline_access',
    responseType: 'code',

    // Where the library sends the browser once the callback has exchanged the code.
    // Without it the default is '/', which this app redirects to the guarded dashboard
    // — so a successful third-party sign-in would bounce the user to nauth's own login
    // page instead of back to the application that just signed them in.
    postLoginRoute: '/rp',
    silentRenew: false,
    useRefreshToken: true,

    // `oidc-provider` carries the original request's `nonce` into id_tokens issued by
    // the refresh grant, while this client generates a fresh nonce per request and
    // validates against it — so without this the refreshed token is rejected with
    // "token(s) validation failed, resetting" and the session is dropped.
    //
    // OpenID Connect Core does not settle what `nonce` should be in a refreshed
    // id_token, so both sides are defensible; this is the client-side setting that
    // exists precisely to reconcile them.
    ignoreNonceAfterRefresh: true,
    // The demo runs on plain http locally; a real deployment would not relax this.
    secureRoutes: [],
    logLevel: environment.production ? LogLevel.Error : LogLevel.Warn,
  },
};
