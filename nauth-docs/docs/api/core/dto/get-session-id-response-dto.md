---
title: GetSessionIdResponseDTO
description: Response DTO for session ID. Returns session ID from the current request context (extracted from JWT token after authentication).
keywords: [session, id, jwt, response, dto, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSessionIdResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for session ID from the current request context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSessionIdResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSessionIdResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSessionIdResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type       | Required | Description                                                      |
| ---------- | ---------- | -------- | ---------------------------------------------------------------- |
| `sessionId` | `number?`  | No       | Current session ID (if available from authenticated request). Extracted from JWT token payload after authentication. Undefined if not available. |

## Example

```json
{
  "sessionId": 123
}
```

## Used By

- [ClientInfoService.getSessionId()](../services/client-info-service#getsessionid)

