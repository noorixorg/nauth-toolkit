---
title: createNAuthOIDCProvider
description: "Provider factory reference: NAuthOIDCOptions (issuer, pathPrefix, interactionUrl, storage, userRepository, cookieKeys, clients, jwks, proxy, secureCookies, extraConfiguration) and NAuthOIDCClient metadata"
keywords: [createNAuthOIDCProvider, oidc options, issuer, jwks, pkce, client metadata, api]
image: /img/api-social-card.png
sidebar_position: 2
---

# createNAuthOIDCProvider

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Factory

Builds an `oidc-provider` instance backed by nauth-toolkit's storage and users, with the defaults listed below already applied.

```typescript
import { createNAuthOIDCProvider } from '@nauth-toolkit/oidc-provider';
```

```typescript
async function createNAuthOIDCProvider(options: NAuthOIDCOptions): Promise<Provider>
```

With NestJS you do not call this directly — [`OIDCProviderModule.forRoot()`](./oidc-provider-module) does, supplying `storage` and `userRepository` from `AuthModule`.

## Options

`NAuthOIDCOptions`:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `clients` | [`NAuthOIDCClient[]`](#client-metadata) | No | Statically registered clients. Default `[]` |
| `cookieKeys` | `string[]` | Yes | Keygrip signing keys for the provider's own cookies. Separate from nauth-toolkit's JWT secrets. Rotate by prepending a new key |
| `extraConfiguration` | `Partial<Configuration>` | No | Escape hatch for any `oidc-provider` option this wrapper does not surface. Merged last, so it overrides everything |
| `interactionUrl` | `(uid: string) => string` | Yes | Where the browser is sent when the provider needs the user to do something |
| `issuer` | `string` | Yes | The public origin, **with no path component**. See the warning below |
| `jwks` | `{ keys: Record<string, unknown>[] }` | No | Keys used to sign id_tokens. A development key is generated when omitted |
| `pathPrefix` | `string` | No | Path every provider endpoint is served under. Default `'/oidc'` |
| `proxy` | `boolean` | No | Trust `X-Forwarded-*`. Required behind a reverse proxy. Default `false` |
| `secureCookies` | `boolean` | No | Mark cookies `secure`. Set false for plain-http local development. Default `true` |
| `storage` | `StorageAdapter` | Yes | nauth-toolkit's storage adapter. Backs every provider model; no tables are created |
| `userRepository` | `Repository<BaseUser>` | Yes | Used to resolve accounts and release claims |

:::warning[`issuer` must be an origin]
`oidc-provider` builds every endpoint URL as `new URL(absolutePath, issuer)`, so any path on the issuer is silently discarded — `new URL('/auth', 'https://host/oidc')` is `https://host/auth`, and the discovery document then advertises endpoints that 404. Namespace with `pathPrefix` instead.
:::

:::warning[Set `jwks` outside local development]
Omitting it generates a fresh development key on every start, which invalidates every id_token already issued. Generate a persistent key set and pass it in.
:::

## Client metadata

`NAuthOIDCClient`:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `client_id` | `string` | Yes | Public identifier, sent as `client_id` |
| `client_name` | `string` | No | Human-readable name, shown on the consent screen |
| `client_secret` | `string` | No | Omit for a public client, which must then use PKCE |
| `client_uri` | `string` | No | Client home page, shown on the consent screen. Absolute http(s) URL |
| `grant_types` | `string[]` | No | Default `['authorization_code', 'refresh_token']` |
| `logo_uri` | `string` | No | Logo shown on the consent screen. Absolute http(s) URL |
| `post_logout_redirect_uris` | `string[]` | No | Allowed targets for RP-initiated logout |
| `redirect_uris` | `string[]` | Yes | Matched as exact strings |
| `response_types` | `'code'[]` | No | Default `['code']`; nothing else is available |
| `token_endpoint_auth_method` | `'client_secret_basic' \| 'client_secret_post' \| 'none'` | No | Default `'client_secret_basic'` |

Any other metadata `oidc-provider` accepts may be set alongside these.

## Defaults applied

| | `oidc-provider` default | Applied here |
| --- | --- | --- |
| `responseTypes` | `code`, `id_token`, `code id_token`, `none` | `['code']` |
| `pkce.required` | Public clients only | Every client |
| `features.introspection` | Disabled | Enabled, scoped to a client's own tokens |
| `features.revocation` | Disabled | Enabled, scoped to a client's own tokens |
| `features.devInteractions` | Enabled | Disabled |
| `issueRefreshToken` | Requires `offline_access` | Requires only the registered grant |
| `ttl` | Warn-on-default | Set explicitly — see below |

Released scopes are `openid` and `offline_access`, plus the `email`, `profile` and `phone` claim scopes.

### Lifetimes

| Artifact | TTL |
| --- | --- |
| `AccessToken` | 3600 s |
| `AuthorizationCode` | 60 s |
| `Grant` | 14 days |
| `IdToken` | 3600 s |
| `Interaction` | 900 s |
| `RefreshToken` | 30 days |
| `Session` | 14 days |

### extraConfiguration

Merged after everything above, so it wins. Use it to override lifetimes, replace the RP-initiated logout screens, or reach any `oidc-provider` option:

```typescript
extraConfiguration: {
  ttl: { AccessToken: 15 * 60 },
},
```

## Example

```typescript title="src/oidc.ts"
import { createNAuthOIDCProvider } from '@nauth-toolkit/oidc-provider';

const provider = await createNAuthOIDCProvider({
  issuer: 'https://auth.example.com',
  pathPrefix: '/oidc',
  interactionUrl: (uid) => `https://auth.example.com/interaction/${uid}`,
  storage: nauth.storage,
  userRepository,
  cookieKeys: [process.env.OIDC_COOKIE_SECRET!],
  proxy: true,
  clients: [
    {
      client_id: 'partner',
      client_secret: process.env.PARTNER_CLIENT_SECRET!,
      client_name: 'Partner App',
      redirect_uris: ['https://myapp.com/callback'],
    },
  ],
});
```

## Related APIs

- [Mounting](./mounting) - Attach the provider to Express or NestJS
- [OIDCProviderModule](./oidc-provider-module) - NestJS registration
- [createOIDCRateLimiter](./rate-limiter) - Rate limit its endpoints

## What's Next

- [Set up the provider](/docs/guides/oauth-provider/setup)
- [Registering clients](/docs/guides/oauth-provider/registering-clients)
