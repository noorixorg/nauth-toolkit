import type { Configuration } from 'oidc-provider';
import type { Repository } from 'typeorm';
import type { BaseUser, StorageAdapter } from '@nauth-toolkit/core';

/**
 * A statically configured OIDC client.
 *
 * Mirrors `oidc-provider`'s client metadata, narrowed to the fields a nauth
 * deployment normally sets. Secrets stay in configuration or environment, never in
 * source.
 */
export interface NAuthOIDCClient {
  /** Public client identifier, sent as `client_id`. */
  client_id: string;
  /** Client secret. Omit for a public client, which must then use PKCE. */
  client_secret?: string;
  /** Human-readable name, shown on the consent screen. */
  client_name?: string;
  /** Registered redirect URIs, matched as exact strings. */
  redirect_uris: string[];
  /** Grant types this client may use. @default ['authorization_code', 'refresh_token'] */
  grant_types?: string[];
  /**
   * Response types. This provider implements the authorization-code flow only —
   * the implicit and hybrid flows are deliberately unavailable.
   *
   * @default ['code']
   */
  response_types?: 'code'[];
  /** How the client authenticates at the token endpoint. @default 'client_secret_basic' */
  token_endpoint_auth_method?: 'client_secret_basic' | 'client_secret_post' | 'none';
  /** Logo shown on the consent screen. An absolute http(s) URL. */
  logo_uri?: string;
  /** Client home page, shown on the consent screen. An absolute http(s) URL. */
  client_uri?: string;
  /** Post-logout redirect URIs for RP-initiated logout. */
  post_logout_redirect_uris?: string[];

  /**
   * Any other client metadata `oidc-provider` accepts.
   *
   * The named fields above are the ones a nauth deployment normally sets; the rest of
   * the OpenID Connect Dynamic Registration metadata is still available here.
   */
  [key: string]: unknown;
}

/**
 * Options for {@link createNAuthOIDCProvider}.
 */
export interface NAuthOIDCOptions {
  /**
   * The issuer identifier — **the public origin, with no path component**.
   *
   * `oidc-provider` builds every endpoint URL as `new URL(path, issuer)`, and its
   * paths are absolute, so any path on the issuer is silently discarded. Namespace
   * the endpoints with {@link NAuthOIDCOptions.pathPrefix} instead.
   *
   * @example 'https://auth.example.com'
   */
  issuer: string;

  /**
   * Path prefix every provider endpoint is served under.
   *
   * Applied to `routes`, so the discovery document advertises prefixed URLs.
   * Discovery itself stays at `/.well-known/openid-configuration`, which is where
   * OIDC Discovery requires it for an origin issuer.
   *
   * @default '/oidc'
   */
  pathPrefix?: string;

  /** Where the browser is sent when the provider needs the user to do something. */
  interactionUrl: (uid: string) => string;

  /** nauth's storage adapter. Backs every provider model; no tables are created. */
  storage: StorageAdapter;

  /** nauth's user repository, used to resolve accounts and release claims. */
  userRepository: Repository<BaseUser>;

  /**
   * Keygrip signing keys for the provider's own cookies.
   *
   * Separate from nauth's JWT secrets. Rotate by prepending a new key and keeping a
   * short history so cookies signed with the previous key still verify.
   */
  cookieKeys: string[];

  /** Statically registered clients. */
  clients?: NAuthOIDCClient[];

  /** JWKS used to sign id_tokens. A development key is generated when omitted. */
  jwks?: { keys: Record<string, unknown>[] };

  /**
   * Trust `X-Forwarded-*` headers.
   *
   * Required behind a reverse proxy such as Caddy — without it every generated URL is
   * `http://`, redirect-URI checks mismatch, and `secure` cookies are refused.
   *
   * @default false
   */
  proxy?: boolean;

  /** Mark cookies `secure`. Leave false for plain-http local development. @default true */
  secureCookies?: boolean;

  /** Escape hatch for any `oidc-provider` option this wrapper does not surface. */
  extraConfiguration?: Partial<Configuration>;
}
