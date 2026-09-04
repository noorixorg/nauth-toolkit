---
title: Mounting
description: "OIDC provider mounting: automatic self-mount via OIDCProviderModule on NestJS (Express and Fastify), plus mountOIDCProviderExpress, mountOIDCProviderNest and isProviderPath for manual control"
keywords: [mountOIDCProviderExpress, mountOIDCProviderNest, isProviderPath, express, nestjs, body parser]
image: /img/api-social-card.png
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mounting

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Helpers

The provider is attached to the platform instance, not to your framework's router, so guards,
interceptors, pipes and filters never see its endpoints — and no global prefix applies, which is
what keeps discovery at the origin root where the issuer advertises it.

## Automatic mounting (NestJS)

`OIDCProviderModule.forRoot()` attaches the provider itself during module initialisation. A
NestJS application needs **no OpenID Connect code in `main.ts`**:

```typescript title="src/app.module.ts"
@Module({
  imports: [AuthModule.forRoot(authConfig), OIDCProviderModule.forRoot(oidcConfig)],
})
export class AppModule {}
```

Rate limiting is configuration rather than middleware, so it is built from your storage adapter
and registered ahead of the provider automatically:

```typescript title="src/config/oidc.config.ts"
export const oidcConfig: OIDCProviderModuleOptions = {
  issuer: ORIGIN,
  pathPrefix: '/oidc',
  rateLimit: {
    authorize: { max: 60, windowSeconds: 60 },
    token: { max: 60, windowSeconds: 60 },
    introspection: { max: 600, windowSeconds: 60 },
  },
};
```

:::warning[`oidc-provider` ships no rate limiting]
Its endpoints sit outside nauth's guard chain, so nothing else covers them. `POST /token` is
otherwise an unauthenticated brute-force surface against client secrets and authorization codes.
:::

This works on both Express and Fastify HTTP drivers. The mount inspects the running driver and
picks the matching attach mechanism — `app.use()` where the instance exposes it, an `onRequest`
hook plus `reply.hijack()` where it exposes `addHook`.

:::note[What has been verified]
Both attach mechanisms are covered by tests against real Express and Fastify instances. The
end-to-end combination of NestJS *on* `@nestjs/platform-fastify` is not exercised in this
repository's test suite — if you run that combination, verify discovery resolves at your origin
root before relying on it.
:::

| Driver | Mechanism | Request body at the provider |
| --- | --- | --- |
| Express | `app.use()` with a path predicate | Already parsed. `oidc-provider` falls back to `req.body`, so the upstream parser's size limit applies instead of the provider's. |
| Fastify | Root-scope `onRequest` hook with `reply.hijack()` | Unconsumed. The provider keeps its own request-size limit. |

Set `mount: { enabled: false }` to attach the provider yourself with the helpers below.

## mountOIDCProviderExpress()

```typescript
import { mountOIDCProviderExpress } from '@nauth-toolkit/oidc-provider';
```

```typescript
function mountOIDCProviderExpress(
  app: MountableApp,
  provider: Provider,
  options?: { pathPrefix?: string },
): void
```

**Parameters**

- `app` - The Express application
- `provider` - A configured provider
- `options.pathPrefix` - The prefix its routes were configured with. Default `'/oidc'`

**Example**

```typescript title="src/main.ts"
const app = express();
mountOIDCProviderExpress(app, provider, { pathPrefix: '/oidc' });
app.use(express.json());
```

:::warning[No URL rewriting]
The request is handed over with its path intact, because the provider's routes are configured with the prefix already baked in. `app.use('/oidc', provider.callback())` — the recipe in the upstream README — strips the prefix and breaks every URL the provider generates.
:::

## mountOIDCProviderNest()

```typescript
import { mountOIDCProviderNest } from '@nauth-toolkit/oidc-provider/nestjs';
```

```typescript
function mountOIDCProviderNest(
  app: INestApplication,
  provider: Provider,
  options?: { pathPrefix?: string },
): void
```

Attaches to the underlying platform instance, so `setGlobalPrefix()` does not apply — the endpoints sit at the origin root exactly as the discovery document advertises them. Call it in `main.ts` before `app.use(json())` and before `setGlobalPrefix()`.

**Example**

```typescript title="src/main.ts"
const app = await NestFactory.create(AppModule, new ExpressAdapter());
mountOIDCProviderNest(app, app.get(NAUTH_OIDC_PROVIDER), { pathPrefix: '/oidc' });
app.use(cookieParser());
app.setGlobalPrefix('api');
```

:::note[NestJS does not need `bodyParser: false`]
`oidc-provider` falls back to a pre-parsed `req.body`. Mounting before the parsers still avoids a startup warning and keeps the provider's own request size limit.
:::

## isProviderPath()

```typescript
import { isProviderPath } from '@nauth-toolkit/oidc-provider';
```

```typescript
function isProviderPath(req: { url?: string; path?: string }, prefix: string): boolean
```

Whether a request belongs to the provider. True for anything under the prefix, and for any `/.well-known/` path — discovery lives at the origin root, not under the prefix.

Exported for consumers attaching the provider by hand. On NestJS — including the Fastify HTTP
driver — `OIDCProviderModule` does this for you and there is no need to place anything ahead of
your framework's server.

## Related APIs

- [createNAuthOIDCProvider](./create-provider) - Build the provider
- [createOIDCRateLimiter](./rate-limiter) - Mount immediately before the provider

## What's Next

- [Set up the provider](/docs/guides/oauth-provider/setup)
