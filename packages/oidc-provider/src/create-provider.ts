import type Provider from 'oidc-provider';
import type { Configuration } from 'oidc-provider';
import { createOIDCStorageAdapter } from './storage.adapter';
import { createFindAccount } from './find-account';
import type { NAuthOIDCOptions } from './config.types';

/** The `Provider` constructor, as loaded from the ESM-only package. */
type ProviderCtor = new (issuer: string, configuration?: Configuration) => Provider;

/** The parts of the Koa context the introspection and revocation policies need. */
type KoaLikeContext = unknown;

/** The parts of a token the introspection and revocation policies inspect. */
interface TokenLike {
  clientId?: string;
}

/** Every route `oidc-provider` serves, so all of them can be prefixed together. */
const ROUTE_NAMES = [
  ['authorization', '/auth'],
  ['token', '/token'],
  ['jwks', '/jwks'],
  ['userinfo', '/me'],
  ['introspection', '/token/introspection'],
  ['revocation', '/token/revocation'],
  ['end_session', '/session/end'],
  ['device_authorization', '/device/auth'],
  ['code_verification', '/device'],
  ['pushed_authorization_request', '/request'],
  ['registration', '/reg'],
  ['backchannel_authentication', '/backchannel'],
  ['challenge', '/challenge'],
  ['credential', '/credential'],
] as const;

/**
 * Load the ESM-only `oidc-provider` from a CommonJS build.
 *
 * Node supports `require(esm)` unflagged from ^20.19 and ^22.12, and the package has
 * no top-level await, so the synchronous path works on every currently supported
 * runtime. The dynamic-import fallback covers Node 22.0–22.11, and is built through
 * `Function` so TypeScript does not rewrite it back into a `require` — the same
 * technique `JwtService` already uses for the ESM-only `jose`.
 */
export async function loadProviderCtor(): Promise<ProviderCtor> {
  try {
    const mod = require('oidc-provider') as { default?: ProviderCtor } & ProviderCtor;
    return (mod.default ?? mod) as ProviderCtor;
  } catch {
    const nativeImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const mod = (await nativeImport('oidc-provider')) as { default?: ProviderCtor } & ProviderCtor;
    return (mod.default ?? mod) as ProviderCtor;
  }
}

/**
 * Create an `oidc-provider` instance wired to nauth's storage and users.
 *
 * The provider owns a disjoint path prefix at the raw HTTP layer and never touches
 * nauth's request abstraction. It keeps its own session; nauth stays the sole
 * authority on *identity*, reached through `findAccount` and the interaction bridge.
 *
 * Note the routing arrangement: the issuer is a bare origin and every route carries
 * the prefix. Mounting the other way round — a path-prefixed issuer with the prefix
 * stripped from `req.url` — looks natural and is what the upstream README shows, but
 * it is broken: `urlFor()` resolves `new URL('/auth', 'https://host/oidc')` to
 * `https://host/auth`, so the discovery document advertises endpoints that 404.
 *
 * @param options - Issuer, storage, users, cookie keys and clients
 * @param ctor - Injectable constructor, so tests need not load the real ESM module
 * @returns A configured provider, ready to mount
 *
 * @example
 * ```typescript
 * const provider = await createNAuthOIDCProvider({
 *   issuer: 'https://demo.nauth.dev',
 *   interactionUrl: (uid) => `https://demo.nauth.dev/interaction/${uid}`,
 *   storage: nauth.storage,
 *   userRepository,
 *   cookieKeys: [process.env.OIDC_COOKIE_SECRET!],
 *   clients: [{ client_id: 'partner', client_secret: '…', redirect_uris: ['https://partner.example/cb'] }],
 * });
 * ```
 */
export async function createNAuthOIDCProvider(options: NAuthOIDCOptions, ctor?: ProviderCtor): Promise<Provider> {
  const Ctor = ctor ?? (await loadProviderCtor());
  const prefix = options.pathPrefix ?? '/oidc';

  const routes = Object.fromEntries(
    ROUTE_NAMES.map(([name, path]) => [name, `${prefix}${path}`]),
  ) as Configuration['routes'];

  const configuration: Configuration = {
    adapter: createOIDCStorageAdapter(options.storage),
    findAccount: createFindAccount(options.userRepository),
    clients: options.clients ?? [],
    routes,

    // Widen the interaction cookie to the whole origin. It is otherwise scoped to the
    // interaction URL, and the bridge endpoints — which live under the API prefix —
    // would never receive it, so interactionDetails() could not resolve the request.
    cookies: {
      keys: options.cookieKeys,
      short: { path: '/', sameSite: 'lax', secure: options.secureCookies !== false, httpOnly: true },
      long: { path: '/', sameSite: 'lax', secure: options.secureCookies !== false, httpOnly: true },
    },

    interactions: {
      url: (_ctx: unknown, interaction: { uid: string }) => options.interactionUrl(interaction.uid),
    },

    // `offline_access` must be declared for a client to be able to request it; the
    // claim scopes below (email, profile, phone) are added implicitly by `claims`.
    scopes: ['openid', 'offline_access'],

    claims: {
      openid: ['sub'],
      email: ['email', 'email_verified'],
      profile: ['name', 'given_name', 'family_name', 'preferred_username', 'updated_at'],
      phone: ['phone_number', 'phone_number_verified'],
    },

    features: {
      // Both are off by default upstream, and both are load-bearing for a resource
      // server validating tokens.
      //
      // `allowedPolicy` is tightened deliberately. Upstream lets any authenticated
      // client introspect or revoke any token, which means one registered partner can
      // probe another's tokens for validity, subject and scope — or revoke them. A
      // client is restricted here to tokens it was itself issued.
      introspection: {
        enabled: true,
        allowedPolicy: async (_ctx: KoaLikeContext, client: { clientId: string }, token: TokenLike) =>
          token.clientId === client.clientId,
      },
      revocation: {
        enabled: true,
        allowedPolicy: async (_ctx: KoaLikeContext, client: { clientId: string }, token: TokenLike) =>
          token.clientId === client.clientId,
      },
      // The built-in demo login screens must never be reachable: nauth owns login.
      devInteractions: { enabled: false },
    },

    // Explicit lifetimes. Upstream warns on every default, and silent defaults are a
    // poor thing to discover in production.
    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 60,
      IdToken: 60 * 60,
      RefreshToken: 30 * 24 * 60 * 60,
      Interaction: 15 * 60,
      Session: 14 * 24 * 60 * 60,
      Grant: 14 * 24 * 60 * 60,
    },

    // Authorization code only.
    //
    // Upstream also enables `id_token`, `code id_token` and `none` — the implicit and
    // hybrid flows, which return tokens in the URL fragment where they leak through
    // browser history, referrers and logs. Both are removed in OAuth 2.1 and advised
    // against by RFC 9700, so they are switched off here rather than left to each
    // consumer to notice and disable.
    responseTypes: ['code'],

    // PKCE is required for every client, not just public ones (RFC 9700).
    pkce: { required: () => true },

    // Issue a refresh token whenever the client is registered for the grant.
    //
    // The upstream default additionally requires the `offline_access` scope. That is
    // the letter of OpenID Connect, but it surprises integrators migrating from
    // providers that do not require it, and it fails silently — the token response is
    // simply missing `refresh_token` with no error to explain why. Registering the
    // grant is the deliberate act here, so that is what this keys off.
    issueRefreshToken: async (_ctx, client, _code) => client.grantTypeAllowed('refresh_token'),

    ...(options.jwks ? { jwks: options.jwks as Configuration['jwks'] } : {}),
    ...options.extraConfiguration,
  };

  const provider = new Ctor(options.issuer, configuration);

  if (options.proxy) {
    provider.proxy = true;
  }

  return provider;
}
