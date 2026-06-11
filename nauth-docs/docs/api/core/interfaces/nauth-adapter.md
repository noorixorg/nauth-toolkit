---
title: NAuthAdapter
description: Interface for framework adapters (Express, Fastify, custom) used by nauth-toolkit
keywords: [adapter, platform, interface, express, fastify, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NAuthAdapter

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Contract for framework adapters that register middleware/hooks and manage AsyncLocalStorage request context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthAdapter } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthAdapter } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuthAdapter } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` (readonly) | Adapter name for logging/debugging (e.g., `'express'`, `'fastify'`) |

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `registerMiddleware(name, handler, options?)` | `unknown` | Register a middleware handler. `name` is a string identifier (e.g., `'auth'`), `handler` is a `NAuthMiddlewareHandler`, `options` is optional `MiddlewareOptions`. |
| `registerResponseInterceptor(handler)` | `unknown` | Register a response interceptor for token delivery. `handler` is a `NAuthResponseInterceptorHandler`. |
| `wrapRouteHandler(handler)` | `unknown` | Wrap a route handler to ensure AsyncLocalStorage context is available. |

## Related APIs

- [NAuthRequest](./nauth-request) - Request contract
- [NAuthResponse](./nauth-response) - Response contract


