---
title: LogoutResponseDTO
description: Logout response DTO with success indicator. Simple boolean response for session logout operations.
keywords: [logout, response, dto, success, api]
image: /img/api-social-card.png
sidebar_position: 25
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LogoutResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for logging out from a specific session.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LogoutResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LogoutResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LogoutResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type      | Required | Description                                                      |
| --------- | --------- | -------- | ---------------------------------------------------------------- |
| `success` | `boolean` | Yes      | Success indicator. Always true on successful logout.             |

## Example

```json
{
  "success": true
}
```

## Used By

- [AuthService.logout()](../services/auth-service#logout)
