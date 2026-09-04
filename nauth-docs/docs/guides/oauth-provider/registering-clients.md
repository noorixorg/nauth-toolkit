---
title: "Registering OIDC Clients"
description: "Register confidential and public OIDC clients: client_id, client_secret, redirect_uris, grant_types, token_endpoint_auth_method, scopes and claims, PKCE, and refresh token rules"
sidebar_position: 2
keywords: [oidc client, oauth client, redirect uri, pkce, public client, confidential client, scopes, claims]
image: /img/api-social-card.png
---

# Registering OIDC Clients

Every application that wants to sign users in through your provider is a *client*. Clients are registered statically, in the `clients` array you pass to the provider. Keep secrets in environment variables, never in source.

## A confidential client

An application with a backend that can keep a secret.

```typescript title="src/config/oidc.config.ts"
{
  client_id: 'partner',
  client_secret: process.env.PARTNER_CLIENT_SECRET!,
  client_name: 'Partner App',
  client_uri: 'https://myapp.com',
  logo_uri: 'https://myapp.com/logo.png',
  redirect_uris: ['https://myapp.com/callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'client_secret_basic',
  post_logout_redirect_uris: ['https://myapp.com'],
}
```

## A public client

A single-page app or a mobile app, which cannot keep a secret. Omit `client_secret` and set `token_endpoint_auth_method: 'none'`. PKCE is what binds the authorization code to the client.

```typescript title="src/config/oidc.config.ts"
{
  client_id: 'partner-spa',
  client_name: 'Partner SPA',
  redirect_uris: ['https://myapp.com/callback'],
  post_logout_redirect_uris: ['https://myapp.com'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
}
```

## Client metadata

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `client_id` | `string` | Yes | Public identifier, sent as `client_id` |
| `client_name` | `string` | No | Shown on the consent screen. Absent unless you set it, so have your page fall back to `client_id` |
| `client_secret` | `string` | No | Omit for a public client |
| `client_uri` | `string` | No | Client home page, shown on the consent screen. Must be an absolute http(s) URL |
| `grant_types` | `string[]` | No | Default `['authorization_code', 'refresh_token']` |
| `logo_uri` | `string` | No | Shown on the consent screen. Must be an absolute http(s) URL |
| `post_logout_redirect_uris` | `string[]` | No | Allowed targets for RP-initiated logout |
| `redirect_uris` | `string[]` | Yes | Matched as **exact strings** — no wildcards, no path prefixes |
| `response_types` | `'code'[]` | No | Only `['code']` is available |
| `token_endpoint_auth_method` | `string` | No | `client_secret_basic` (default), `client_secret_post`, or `none` |

Any other metadata `oidc-provider` accepts can be set alongside these. See [`NAuthOIDCClient`](/docs/api/oidc-provider/create-provider#client-metadata).

:::warning[Redirect URIs are matched exactly]
`https://myapp.com/callback` does not match `https://myapp.com/callback/` or `https://myapp.com/callback?x=1`. Register every URI the client will actually use, including the localhost ones your partners develop against.
:::

## Scopes and claims

The provider releases these scopes, and no others:

| Scope | Claims released |
| --- | --- |
| `openid` | `sub` |
| `email` | `email`, `email_verified` |
| `profile` | `name`, `given_name`, `family_name`, `preferred_username`, `updated_at` |
| `phone` | `phone_number`, `phone_number_verified` |
| `offline_access` | None — signals that the client wants long-lived access |

`sub` is nauth-toolkit's external user identifier. An internal row id is never exposed.

A client asks for scopes in its authorization request; nothing needs registering per client. The consent screen shows the user what was asked for, and the grant records what they allowed.

## PKCE is required for every client

Not only public ones — this is stricter than the `oidc-provider` default. Clients must send `code_challenge` with `code_challenge_method=S256`; `plain` is rejected. Every certified client library does this by default.

## Refresh tokens

A refresh token is issued whenever the client registers the `refresh_token` grant. Unlike stock OpenID Connect, the `offline_access` scope is not additionally required — so a client that should *not* get refresh tokens must leave the grant out of `grant_types`.

## Only the authorization code flow

`response_types` accepts `['code']` and nothing else — a client configured for the implicit or hybrid flow will not work here.

## Rotating a client secret

Change `client_secret` in configuration and restart. There is no secret history, so coordinate the change with the client, or register a second `client_id` and retire the first once traffic has moved.

## What's Next

- [Build the consent screen](/docs/guides/oauth-provider/consent-screen) — where `client_name` and `logo_uri` end up
- [Single logout](/docs/guides/oauth-provider/single-logout) — where `post_logout_redirect_uris` is used
- [How the provider works](/docs/guides/oauth-provider/how-oauth-provider-works) — the defaults every client has to satisfy
