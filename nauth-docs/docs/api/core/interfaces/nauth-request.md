---
title: NAuthRequest
description: Framework-agnostic request interface used by nauth-toolkit adapters and middleware
keywords: [request, adapter, interface, platform, api]
image: /img/api-social-card.png
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NAuthRequest

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Standardized request shape for platform adapters.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthRequest } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthRequest } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuthRequest } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `method` | `string` | Yes | HTTP method (uppercase) |
| `path` | `string` | Yes | Path without query |
| `url` | `string` | Yes | Full URL |
| `body` | `Record<string, unknown>` | Yes | Parsed body |
| `query` | `Record<string, unknown>` | Yes | Query params |
| `params` | `Record<string, string>` | Yes | Path params |
| `headers` | `Record<string, string \| string[] \| undefined>` | Yes | Headers (lowercase keys) |
| `cookies` | `Record<string, string \| undefined>` | Yes | Parsed cookies |
| `ip` | `string` | Yes | Client IP |
| `attributes` | `NAuthRequestAttributes` | Yes | Adapter-managed request attributes |
| `raw` | `unknown` | Yes | Escape hatch (framework request) |

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `getHeader(name)` | `string \| undefined` | Case-insensitive header lookup |

## Related APIs

- [NAuthResponse](./nauth-response) - Response interface
- [NAuthAdapter](./nauth-adapter) - Adapter contract


