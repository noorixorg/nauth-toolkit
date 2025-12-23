---
title: NAuthResponse
description: Framework-agnostic response interface used by nauth-toolkit adapters and middleware
keywords: [response, adapter, interface, platform, api]
image: /img/api-social-card.png
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NAuthResponse

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Standardized response contract for platform adapters.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthResponse } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthResponse } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuthResponse } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `raw` | `unknown` | Yes | Escape hatch (framework response) |

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `status(code)` | `this` | Set status code |
| `header(name, value)` | `this` | Set header |
| `setCookie(name, value, options?)` | `this` | Set cookie |
| `clearCookie(name, options?)` | `this` | Clear cookie |
| `send(body)` | `void` | Send body |
| `json(body)` | `void` | Send JSON |
| `redirect(url, status?)` | `void` | Redirect |
| `isSent()` | `boolean` | Whether headers were sent |

## Related APIs

- [NAuthRequest](./nauth-request) - Request interface
- [NAuthAdapter](./nauth-adapter) - Adapter contract


