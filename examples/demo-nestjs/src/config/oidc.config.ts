import type { OIDCProviderModuleOptions } from '@nauth-toolkit/oidc-provider/nestjs';

/**
 * Public origin of this deployment.
 *
 * This is the OIDC issuer, and it must be an **origin with no path**: `oidc-provider`
 * builds every endpoint URL as `new URL(absolutePath, issuer)`, so any path on the
 * issuer is silently discarded. The endpoints are namespaced by `pathPrefix` instead.
 */
const ORIGIN = process.env.OIDC_ISSUER ?? process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000';

/**
 * Where the browser goes when the provider needs the user to log in or consent.
 *
 * `OIDC_FRONTEND_URL` is checked first so local testing can point the OIDC flow at a
 * local Angular app without disturbing `FRONTEND_BASE_URL`, which also drives social
 * login redirects and is usually set to the deployed origin.
 */
const FRONTEND =
  process.env.OIDC_FRONTEND_URL ?? process.env.FRONTEND_BASE_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:4200';

/**
 * Demo OpenID Connect provider configuration.
 *
 * Two clients are registered:
 * - `demo-partner` — a confidential client, used by the API-driven end-to-end suite.
 * - `demo-public` — a public client with no secret, used by the browser-based
 *   third-party simulator at `/rp`, which signs in with `angular-auth-oidc-client`.
 *
 * Both also allow the demo's own test callback, so the whole flow can be exercised
 * without standing up a second application.
 */
export const oidcConfig: OIDCProviderModuleOptions = {
  issuer: ORIGIN,
  pathPrefix: '/oidc',

  interactionUrl: (uid: string) => `${FRONTEND}/interaction/${uid}`,

  // Signs the provider's own cookies. Unrelated to nauth's JWT secrets, and rotated
  // by prepending a new key while keeping a short history.
  cookieKeys: [process.env.OIDC_COOKIE_SECRET ?? 'demo-oidc-cookie-secret-change-me'],

  // Behind Caddy in the deployed demo; without this every generated URL would be
  // http:// and the secure cookies would be refused.
  proxy: process.env.OIDC_TRUST_PROXY === 'true',

  // Plain http on localhost, so secure cookies would never be stored.
  secureCookies: ORIGIN.startsWith('https://'),

  clients: [
    {
      client_id: 'demo-partner',
      client_secret: process.env.OIDC_DEMO_CLIENT_SECRET ?? 'demo-partner-secret',
      client_name: 'Demo Partner App',
      client_uri: 'https://nauth.dev',
      redirect_uris: [`${ORIGIN}/api/test/oidc/callback`, `${FRONTEND}/rp/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    },
    {
      client_id: 'demo-public',
      client_name: 'Demo Public Client',
      // The browser-based simulator at /rp signs in as this client. A public client
      // holds no secret, so PKCE is the only thing binding the code to it.
      redirect_uris: [`${ORIGIN}/api/test/oidc/callback`, `${FRONTEND}/rp/callback`],
      post_logout_redirect_uris: [`${FRONTEND}/rp`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  ],
};
