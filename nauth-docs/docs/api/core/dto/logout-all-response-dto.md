---
title: LogoutAllResponseDTO
description: Logout all sessions response DTO with revoked session count. Returns number of sessions terminated.
keywords: [logout, all, response, dto, sessions, api]
image: /img/api-social-card.png
sidebar_position: 47
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LogoutAllResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for logging out from all sessions.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LogoutAllResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LogoutAllResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LogoutAllResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property       | Type     | Required | Description                                                      |
| -------------- | -------- | -------- | ---------------------------------------------------------------- |
| `revokedCount` | `number` | Yes      | Number of sessions revoked.                                       |

## Example

```json
{
  "revokedCount": 5
}
```

## Used By

- [AuthService.logoutAll()](../services/auth-service#logoutall)
