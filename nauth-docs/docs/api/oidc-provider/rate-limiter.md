---
title: createOIDCRateLimiter
description: "Rate limit the OIDC provider's authorize, token and introspection endpoints with OIDCRateLimitConfig: per-IP limits in the storage adapter, defaults, and the 429 response"
keywords: [createOIDCRateLimiter, rate limiting, token endpoint, brute force, OIDCRateLimitConfig, api]
image: /img/api-social-card.png
sidebar_position: 8
---

# createOIDCRateLimiter

**Package:** `@nauth-toolkit/oidc-provider`
**Type:** Middleware factory

Rate limiting for the OpenID Connect provider's endpoints.

```typescript
import { createOIDCRateLimiter } from '@nauth-toolkit/oidc-provider';
```

```typescript
function createOIDCRateLimiter(
  storage: StorageAdapter,
  config?: OIDCRateLimitConfig,
  options?: { pathPrefix?: string },
): (req, res, next) => void
```

## Overview

`oidc-provider` ships no rate limiting, and the provider is mounted outside your guard chain, so nauth-toolkit's own limiter never sees these paths. `POST /token` in particular is an unauthenticated brute-force surface against client secrets and authorization codes.

Requests are counted **per source IP** (taking the first `X-Forwarded-For` entry when present) in the storage adapter, so limits hold across instances rather than per process. If storage is unavailable the request is allowed through rather than failing.

A rejected request gets `429` with `Retry-After` and `Cache-Control: no-store`:

```json
{
  "error": "temporarily_unavailable",
  "error_description": "Too many requests. Try again shortly."
}
```

:::warning[Mount it immediately before the provider]
A rejected request must never reach the provider.
:::

## Configuration

`OIDCRateLimitConfig` — endpoints not listed are **unlimited**:

| Property | Type | Default when configured | Description |
| --- | --- | --- | --- |
| `authorize` | `OIDCEndpointLimit` | `{ max: 60, windowSeconds: 60 }` | `{pathPrefix}/auth` |
| `introspection` | `OIDCEndpointLimit` | `{ max: 600, windowSeconds: 60 }` | `{pathPrefix}/token/introspection`. Often on a gateway's hot path — set generously or leave unset |
| `token` | `OIDCEndpointLimit` | `{ max: 60, windowSeconds: 60 }` | `{pathPrefix}/token`. The brute-force surface that matters most |

`OIDCEndpointLimit`:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `max` | `number` | Yes | Maximum requests allowed in the window |
| `windowSeconds` | `number` | Yes | Window length, in seconds |

`options.pathPrefix` must match the provider's. Default `'/oidc'`. Only exact path matches are limited, so no other route is affected.

## Example

```typescript title="src/main.ts"
app.use(
  createOIDCRateLimiter(
    nauth.storage,
    {
      authorize: { max: 60, windowSeconds: 60 },
      token: { max: 60, windowSeconds: 60 },
      introspection: { max: 600, windowSeconds: 60 },
    },
    { pathPrefix: '/oidc' },
  ),
);

mountOIDCProviderExpress(app, provider, { pathPrefix: '/oidc' });
```

## Related APIs

- [Mounting](./mounting) - What this sits in front of
- [Rate Limiting](/docs/guides/rate-limiting) - nauth-toolkit's own limiter, which does not cover these paths

## What's Next

- [Set up the provider](/docs/guides/oauth-provider/setup)
