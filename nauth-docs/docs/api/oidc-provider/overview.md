---
title: OIDC Provider
description: "API index for @nauth-toolkit/oidc-provider: createNAuthOIDCProvider, OIDCProviderModule, OIDCInteractionBridge, createOIDCInteractionController, OIDCSessionTerminator, createOIDCRateLimiter, mounting helpers"
keywords: [openid connect, oidc provider, oauth2, api reference, authorization server]
image: /img/api-social-card.png
sidebar_position: 1
sidebar_label: Overview
---

# OIDC Provider

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Provider Package

Turns a nauth-toolkit application into an OAuth 2.0 authorization server and OpenID Connect provider, so other applications can offer "Sign in with your app". The protocol is implemented by [`oidc-provider`](https://github.com/panva/node-oidc-provider); this package supplies storage, accounts, and a login and consent bridge.

```bash npm2yarn
npm install @nauth-toolkit/oidc-provider oidc-provider
```

:::warning For third-party integrations, not your own login
Keep your own application on [`AuthService`](/docs/api/core/services/auth-service). The protocol endpoints here do not carry nauth-toolkit's per-identifier rate limiting or account lockout — see [when to use this, and when not to](/docs/guides/oauth-provider/how-oauth-provider-works#when-to-use-this--and-when-not-to).
:::

## Entry points

| Import | Contents |
| --- | --- |
| `@nauth-toolkit/oidc-provider` | Framework-agnostic: provider factory, bridge, mounting, rate limiter, session terminator |
| `@nauth-toolkit/oidc-provider/nestjs` | `OIDCProviderModule`, injection tokens, the shipped interaction controller |

## API

| Symbol | Purpose |
| --- | --- |
| [`createNAuthOIDCProvider()`](./create-provider) | Build a provider wired to nauth-toolkit's storage and users |
| [`createOIDCInteractionController()`](./interaction-controller) | The shipped NestJS controller for the interaction routes |
| [`createOIDCRateLimiter()`](./rate-limiter) | Rate limit the provider's endpoints |
| [`mountOIDCProviderExpress()` / `mountOIDCProviderNest()`](./mounting) | Attach the provider to the platform instance |
| [`OIDCInteractionBridge`](./interaction-bridge) | Drive the login and consent steps |
| [`OIDCProviderModule`](./oidc-provider-module) | NestJS registration |
| [`OIDCSessionTerminator`](./session-terminator) | End the provider's sessions and grants |

## Types

| Type | Purpose |
| --- | --- |
| [`InteractionRedirectDTO`](./interaction-redirect-dto) | Where to send the browser after a decision |
| [`InteractionStateDTO`](./interaction-state-dto) | What the consent screen needs in order to ask |
| [`NAuthOIDCClient`](./create-provider#client-metadata) | Statically registered client metadata |
| [`NAuthOIDCOptions`](./create-provider#options) | Everything the provider factory takes |

## Errors

Every bridge failure is an [`NAuthException`](/docs/api/core/exceptions/nauth-exception), so `NAuthHttpExceptionFilter` maps it to a status the frontend can act on.

| Code | Status | When |
| --- | --- | --- |
| `OIDC_INTERACTION_NOT_FOUND` | 404 | The request expired or was already resolved |
| `OIDC_LOGIN_REQUIRED` | 401 | Recoverable — `details.uid` says what to resume |

An account the session gate refuses does not raise an error. The interaction resolves with `access_denied`, so the relying party gets a protocol error instead of a dead browser tab. [`AuthErrorCode.OIDC_ACCESS_DENIED`](/docs/api/core/enums/auth-error-code) (403) exists for identity-provider routes you write yourself.

## Endpoints

With the default `pathPrefix` of `/oidc`:

| Path | Purpose |
| --- | --- |
| `/.well-known/openid-configuration` | Discovery — at the origin root, not under the prefix |
| `/oidc/auth` | Authorization |
| `/oidc/jwks` | Signing keys |
| `/oidc/me` | UserInfo |
| `/oidc/session/end` | RP-initiated logout |
| `/oidc/token` | Token |
| `/oidc/token/introspection` | Introspection |
| `/oidc/token/revocation` | Revocation |

The interaction routes the consent screen calls are **not** here — they are ordinary routes in your own application, at `oidc/interaction/:uid` under any global prefix. See [createOIDCInteractionController](./interaction-controller).

## What's Next

- [How the provider works](/docs/guides/oauth-provider/how-oauth-provider-works) — architecture and hardened defaults
- [Set up the provider](/docs/guides/oauth-provider/setup) — install, configure, mount
- [Build the consent screen](/docs/guides/oauth-provider/consent-screen) — the frontend half
