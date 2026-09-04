---
title: Mounting
description: "mountOIDCProviderExpress, mountOIDCProviderNest and isProviderPath: attach the OIDC provider to the platform instance without URL rewriting, before the body parsers"
keywords: [mountOIDCProviderExpress, mountOIDCProviderNest, isProviderPath, express, nestjs, body parser]
image: /img/api-social-card.png
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mounting

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Helpers

The provider is attached to the platform instance, not to your framework's router, so guards, interceptors, pipes and filters never see its endpoints. Mount it before your body parsers.

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

:::warning No URL rewriting
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

:::note NestJS does not need `bodyParser: false`
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

Use it when you are placing the provider ahead of a framework that owns its own server:

```typescript title="src/main.ts"
const callback = provider.callback();
http.createServer((req, res) => {
  if (isProviderPath(req, '/oidc')) {
    callback(req, res);
    return;
  }
  fastifyHandler(req, res);
});
```

## Related APIs

- [createNAuthOIDCProvider](./create-provider) - Build the provider
- [createOIDCRateLimiter](./rate-limiter) - Mount immediately before the provider

## What's Next

- [Set up the provider](/docs/guides/oauth-provider/setup)
