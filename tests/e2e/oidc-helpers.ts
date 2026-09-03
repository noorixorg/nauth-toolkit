import { createHash, randomBytes } from 'node:crypto';
import type { APIResponse } from '@playwright/test';

/**
 * Helpers for driving the OpenID Connect provider end to end.
 *
 * These sit on top of the existing `api` fixture so the nauth session cookie and the
 * provider's own `_interaction` / `_session` cookies share one jar — which is what
 * makes the flow behave the way it does in a browser.
 *
 * Paths matter here. The provider owns the origin root (`/oidc/*`), because it is
 * mounted on the Express instance and so is unaffected by `setGlobalPrefix('api')`.
 * The interaction bridge is an ordinary nauth route and therefore *is* under `/api`.
 */

/** Where the provider is mounted, relative to the origin. */
export const OIDC_PREFIX = '/oidc';

/** The interaction bridge, which lives inside the Nest application. */
export const BRIDGE_PREFIX = '/api/oidc/interaction';

/** The stand-in relying party the demo exposes for tests. */
export const RP_CALLBACK_PATH = '/api/test/oidc/callback';

/** Credentials for the demo's confidential client. */
export const DEMO_CLIENT = {
  clientId: 'demo-partner',
  clientSecret: process.env.OIDC_DEMO_CLIENT_SECRET ?? 'demo-partner-secret',
};

/** A PKCE verifier and its S256 challenge. */
export interface Pkce {
  verifier: string;
  challenge: string;
}

/**
 * Generate a PKCE verifier and the S256 challenge derived from it.
 *
 * @returns The pair to carry through an authorization request
 */
export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

/** The minimum of the `api` fixture these helpers need. */
export interface OidcApi {
  get(url: string, options?: Record<string, unknown>): Promise<APIResponse>;
  post(url: string, options?: Record<string, unknown>): Promise<APIResponse>;
}

/** Parameters for an authorization request. */
export interface AuthorizeOptions {
  clientId?: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  nonce?: string;
  pkce?: Pkce;
  prompt?: string;
}

/**
 * Build an authorization request URL.
 *
 * @param options - The request parameters
 * @returns A path suitable for the `api` fixture
 */
export function authorizeUrl(options: AuthorizeOptions): string {
  const params = new URLSearchParams({
    client_id: options.clientId ?? DEMO_CLIENT.clientId,
    response_type: 'code',
    redirect_uri: options.redirectUri,
    scope: options.scope ?? 'openid email profile',
    state: options.state ?? 'e2e-state',
  });
  if (options.nonce) {
    params.set('nonce', options.nonce);
  }
  if (options.pkce) {
    params.set('code_challenge', options.pkce.challenge);
    params.set('code_challenge_method', 'S256');
  }
  if (options.prompt) {
    params.set('prompt', options.prompt);
  }
  return `${OIDC_PREFIX}/auth?${params.toString()}`;
}

/**
 * Pull the interaction id out of the redirect the authorization endpoint issued.
 *
 * @param response - The 303 from `/oidc/auth`
 * @returns The pending interaction id
 */
export function interactionUidFrom(response: APIResponse): string {
  const location = response.headers()['location'] ?? '';
  const uid = location.split('?')[0].split('/').filter(Boolean).pop();
  if (!uid) {
    throw new Error(`No interaction id in redirect: ${location || '(no location header)'}`);
  }
  return uid;
}

/** What the bridge reports about a pending interaction. */
export interface InteractionState {
  uid: string;
  prompt: string;
  client: { clientId: string; clientName?: string };
  scopes: string[];
  missingScopes: string[];
  gate: 'authenticated' | 'login_required' | 'denied';
  gateReason?: string;
  sub?: string;
}

/**
 * Drive an authorization request all the way to the relying party's callback.
 *
 * Follows the same path a browser would: authorize, complete the login step through
 * the bridge, resume, consent, resume again. Redirects are followed one at a time so
 * each hop can be asserted on.
 *
 * @param api - The `api` fixture
 * @param options - The authorization request parameters
 * @returns The final callback URL, plus the interaction ids seen along the way
 */
export async function runAuthorizationFlow(
  api: OidcApi,
  options: AuthorizeOptions,
): Promise<{ callback: URL; loginUid: string; consentUid?: string }> {
  const start = await api.get(authorizeUrl(options), { maxRedirects: 0 });
  const loginUid = interactionUidFrom(start);

  const login = await api.post(`${BRIDGE_PREFIX}/${loginUid}/login`, { maxRedirects: 0 });
  const { redirectTo } = (await login.json()) as { redirectTo: string };

  let resumed = await api.get(redirectTo, { maxRedirects: 0 });
  let consentUid: string | undefined;

  // A consent prompt arrives as a fresh interaction with its own id.
  if (String(resumed.headers()['location'] ?? '').includes('/interaction/')) {
    consentUid = interactionUidFrom(resumed);
    const confirm = await api.post(`${BRIDGE_PREFIX}/${consentUid}/confirm`, {
      data: { approve: true },
      maxRedirects: 0,
    });
    const next = (await confirm.json()) as { redirectTo: string };
    resumed = await api.get(next.redirectTo, { maxRedirects: 0 });
  }

  return { callback: new URL(resumed.headers()['location'] ?? ''), loginUid, consentUid };
}

/**
 * Exchange an authorization code for tokens, authenticating with `client_secret_basic`.
 *
 * @param api - The `api` fixture
 * @param code - The authorization code
 * @param redirectUri - The same redirect URI the code was issued against
 * @param verifier - The PKCE verifier
 * @returns The parsed token response
 */
export async function exchangeCode(
  api: OidcApi,
  code: string,
  redirectUri: string,
  verifier: string,
): Promise<Record<string, string>> {
  const response = await api.post(`${OIDC_PREFIX}/token`, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuth(),
    },
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    },
    maxRedirects: 0,
  });
  return (await response.json()) as Record<string, string>;
}

/**
 * Exchange a refresh token for a new token set.
 *
 * @param api - The `api` fixture
 * @param refreshToken - The refresh token to redeem
 * @returns The parsed token response
 */
export async function refreshTokens(api: OidcApi, refreshToken: string): Promise<Record<string, string>> {
  const response = await api.post(`${OIDC_PREFIX}/token`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth() },
    form: { grant_type: 'refresh_token', refresh_token: refreshToken },
    maxRedirects: 0,
  });
  return (await response.json()) as Record<string, string>;
}

/**
 * Ask the provider whether a token is still usable.
 *
 * @param api - The `api` fixture
 * @param token - The token to introspect
 * @returns The RFC 7662 introspection response
 */
export async function introspect(api: OidcApi, token: string): Promise<Record<string, unknown>> {
  const response = await api.post(`${OIDC_PREFIX}/token/introspection`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth() },
    form: { token },
    maxRedirects: 0,
  });
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Revoke a token.
 *
 * @param api - The `api` fixture
 * @param token - The token to revoke
 */
export async function revoke(api: OidcApi, token: string): Promise<void> {
  await api.post(`${OIDC_PREFIX}/token/revocation`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth() },
    form: { token },
    maxRedirects: 0,
  });
}

/**
 * Decode a JWT's claims without verifying it.
 *
 * Verification is the relying party's job and is covered separately against the
 * published JWKS; this is only for asserting on claim content.
 *
 * @param jwt - A compact-serialized JWT
 * @returns The decoded payload
 */
export function decodeJwtClaims(jwt: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

/** The `Authorization` header for the demo's confidential client. */
function basicAuth(): string {
  const raw = `${DEMO_CLIENT.clientId}:${DEMO_CLIENT.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}
