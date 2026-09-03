import type { OIDCProviderModuleOptions } from '@nauth-toolkit/oidc-provider/nestjs';

/**
 * Public origin of this deployment.
 *
 * This is the OIDC issuer, and it must be an **origin with no path**: `oidc-provider`
 * builds every endpoint URL as `new URL(absolutePath, issuer)`, so any path on the
 * issuer is silently discarded. The endpoints are namespaced by `pathPrefix` instead.
 */
const ORIGIN = process.env.OIDC_ISSUER ?? process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000';

/** Where the browser goes when the provider needs the user to log in or consent. */
const FRONTEND = process.env.FRONTEND_BASE_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:4200';

/**
 * Demo OpenID Connect provider configuration.
 *
 * Two clients are registered:
 * - `demo-partner` — a confidential client standing in for a third-party integration.
 * - `demo-public` — a public client (no secret) exercising the PKCE-only path.
 *
 * Both point their redirect URIs at the demo's own test relying party, so the whole
 * authorization-code flow can be driven end to end without a second application.
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
      redirect_uris: [`${ORIGIN}/api/test/oidc/callback`, `${FRONTEND}/oidc/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    },
    {
      client_id: 'demo-public',
      client_name: 'Demo Public Client',
      redirect_uris: [`${ORIGIN}/api/test/oidc/callback`, `${FRONTEND}/oidc/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  ],
};
