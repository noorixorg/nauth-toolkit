---
title: createOIDCInteractionController
description: "Shipped NestJS interaction controller: the four routes (GET :uid, POST :uid/login, :uid/confirm, :uid/abort), the OIDCConsentBody shape, the configurable path, and the AuthGuard plus @Public() pairing to reproduce"
keywords: [createOIDCInteractionController, nestjs controller, interaction routes, AuthGuard, Public, api]
image: /img/api-social-card.png
sidebar_position: 6
---

# createOIDCInteractionController

**Package:** `@nauth-toolkit/oidc-provider/nestjs`
**Type:** Controller factory

Builds the NestJS controller that bridges the OpenID Connect provider and nauth-toolkit's login. [`OIDCProviderModule.forRoot()`](./oidc-provider-module) calls this for you; call it directly only when registering the controller in your own module.

```typescript
import { createOIDCInteractionController, DEFAULT_INTERACTION_PATH } from '@nauth-toolkit/oidc-provider/nestjs';
```

```typescript
function createOIDCInteractionController(path?: string): Type<unknown>
```

**Parameters**

- `path` - Path relative to any global prefix. Default `DEFAULT_INTERACTION_PATH`, which is `'oidc/interaction'`

## Routes

| Route | Method | Bridge method | Returns |
| --- | --- | --- | --- |
| `:uid` | GET | `getState()` | [`InteractionStateDTO`](./interaction-state-dto) |
| `:uid/abort` | POST | `abort()` | [`InteractionRedirectDTO`](./interaction-redirect-dto) |
| `:uid/confirm` | POST | `completeConsent()` | [`InteractionRedirectDTO`](./interaction-redirect-dto) |
| `:uid/login` | POST | `completeLogin()` | [`InteractionRedirectDTO`](./interaction-redirect-dto) |

**Request body** for `:uid/confirm` (`OIDCConsentBody`):

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `approve` | `boolean` | No | Anything but an explicit `false` is an approval |
| `scopes` | `string[]` | No | A narrowed set of scopes to grant |

```json
{ "approve": true, "scopes": ["openid", "email"] }
```

## The guard arrangement

The controller applies `@UseGuards(AuthGuard)` at the class level **and** `@Public()` on every route. Both halves are load-bearing:

- `AuthGuard` is not a global guard in this toolkit. Without it `CURRENT_USER` is never populated, and the session gate reports `no_session` for everyone, forever.
- `@Public()` then makes the guard **optional** — it attaches a user when a valid session is present and never rejects — which is required, because an anonymous caller is exactly the case that has to work in order to send someone to the login page.

Reproduce both if you write your own controller.

## Example

```typescript title="src/oidc/my-oidc.module.ts"
import { Module } from '@nestjs/common';
import { createOIDCInteractionController } from '@nauth-toolkit/oidc-provider/nestjs';

@Module({
  controllers: [createOIDCInteractionController('identity/interaction')],
})
export class MyOIDCModule {}
```

Registering it yourself means turning the module's own registration off:

```typescript
OIDCProviderModule.forRoot({ ...oidcConfig, interaction: { enabled: false } });
```

## Related APIs

- [OIDCInteractionBridge](./interaction-bridge) - What each route calls
- [OIDCProviderModule](./oidc-provider-module) - Registers this by default

## What's Next

- [Set up the provider](/docs/guides/oauth-provider/setup)
- [Build the consent screen](/docs/guides/oauth-provider/consent-screen)
