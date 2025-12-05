---
title: GetUserAgentResponseDTO
description: Response DTO for user agent. Returns just the user agent string from the current request context.
keywords: [user-agent, client, response, dto, api]
image: /img/api-social-card.png
sidebar_position: 52
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserAgentResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for user agent string from the current request context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserAgentResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserAgentResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserAgentResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property    | Type     | Description                                                      |
| ----------- | -------- | ---------------------------------------------------------------- |
| `userAgent` | `string` | User agent string from the request. Returns 'unknown' if called outside request context. |

## Example

```json
{
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

## Used By

- [ClientInfoService.getUserAgent()](../services/client-info-service#getuseragent)

