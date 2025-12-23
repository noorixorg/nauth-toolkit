---
title: NAuthAdapter
description: Interface for framework adapters (Express, Fastify, custom) used by nauth-toolkit
keywords: [adapter, platform, interface, express, fastify, api]
image: /img/api-social-card.png
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NAuthAdapter

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Contract for framework adapters that wrap requests/responses and manage request context.

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

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `createRequestWrapper(rawRequest)` | `NAuthRequest` | Wrap framework request |
| `createResponseWrapper(rawResponse)` | `NAuthResponse` | Wrap framework response |
| `registerMiddleware(handler, req, res, next)` | `Promise<void>` | Register middleware |
| `registerResponseInterceptor(handler, req, res, next)` | `Promise<void>` | Register response interceptor |
| `wrapRouteHandler(handler)` | `(...args) => Promise<unknown>` | Wrap route handler with context |

## Related APIs

- [NAuthRequest](./nauth-request) - Request contract
- [NAuthResponse](./nauth-response) - Response contract


