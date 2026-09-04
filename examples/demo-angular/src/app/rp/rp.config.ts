import { LogLevel, type PassedInitialConfig } from 'angular-auth-oidc-client';
import { environment } from '../../environments/environment';

/**
 * The origin the OpenID Connect provider is served from.
 *
 * The provider is mounted on the Express instance rather than through Nest's router,
 * so it sits at the origin root and is unaffected by the API's `/api` prefix. The
 * issuer is therefore the bare origin — strip `/api` off the configured API base.
 */
const PROVIDER_ORIGIN = environment.apiBaseUrl.replace(/\/api\/?$/, '');

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
    silentRenew: false,
    useRefreshToken: true,
    // The demo runs on plain http locally; a real deployment would not relax this.
    secureRoutes: [],
    logLevel: environment.production ? LogLevel.Error : LogLevel.Warn,
  },
};
