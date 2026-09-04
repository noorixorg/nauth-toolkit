---
title: OIDCProviderModule
description: "NestJS module reference: forRoot() options including interaction routing (enabled, path), the NAUTH_OIDC_PROVIDER / NAUTH_OIDC_BRIDGE / NAUTH_OIDC_SESSIONS injection tokens, and what it exports"
keywords: [OIDCProviderModule, nestjs, dynamic module, NAUTH_OIDC_BRIDGE, injection token, forRoot]
image: /img/api-social-card.png
sidebar_position: 4
---

# OIDCProviderModule

**Package:** `@nauth-toolkit/oidc-provider/nestjs`
**Type:** DynamicModule

Registers an OpenID Connect provider alongside `AuthModule`, along with the interaction routes your consent screen talks to.

```typescript
import { OIDCProviderModule } from '@nauth-toolkit/oidc-provider/nestjs';
```

```typescript
static forRoot(options: OIDCProviderModuleOptions): DynamicModule
```

The provider itself is **not** mounted by this module — it owns raw HTTP and must be attached to the platform adapter in `main.ts`. See [Mounting](./mounting).

## Options

`OIDCProviderModuleOptions` is [`NAuthOIDCOptions`](./create-provider#options) without `storage` and `userRepository` — those are resolved from `AuthModule`'s exports — plus:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `interaction` | `OIDCInteractionRouteOptions` | No | How the interaction routes are registered |

`OIDCInteractionRouteOptions`:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | No | Register the shipped interaction controller. Default `true` |
| `path` | `string` | No | Path relative to any global prefix. Default `'oidc/interaction'` |

`path` must match the frontend SDK's `oidc.basePath`.

## Injection tokens

| Token | Provides |
| --- | --- |
| `NAUTH_OIDC_BRIDGE` | [`OIDCInteractionBridge`](./interaction-bridge) |
| `NAUTH_OIDC_PROVIDER` | The configured `Provider` instance |
| `NAUTH_OIDC_SESSIONS` | [`OIDCSessionTerminator`](./session-terminator) |

All three are exported, so any module in the application can inject them.

## Example

```typescript title="src/auth/auth.module.ts"
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { OIDCProviderModule } from '@nauth-toolkit/oidc-provider/nestjs';
import { authConfig } from '../config/auth.config';
import { oidcConfig } from '../config/oidc.config';

@Module({
  imports: [AuthModule.forRoot(authConfig), OIDCProviderModule.forRoot(oidcConfig)],
})
export class CustomAuthModule {}
```

Opting out of the shipped controller:

```typescript
OIDCProviderModule.forRoot({ ...oidcConfig, interaction: { enabled: false } });
```

The bridge stays exported either way, so a hand-written controller only has to inject `NAUTH_OIDC_BRIDGE`.

## Related APIs

- [createOIDCInteractionController](./interaction-controller) - What `forRoot()` registers
- [Mounting](./mounting) - The step `forRoot()` does not do
- [OIDCInteractionBridge](./interaction-bridge) - What the controller calls

## What's Next

- [Set up the provider](/docs/guides/oauth-provider/setup)
