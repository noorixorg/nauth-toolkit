---
title: LogoutSessionResponseDTO
description: Response DTO confirming session revocation with flag indicating if the revoked session was the current session.
keywords: [logout, session, response, dto, api]
image: /img/api-social-card.png
sidebar_position: 610
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LogoutSessionResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object confirming successful session revocation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LogoutSessionResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LogoutSessionResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LogoutSessionResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property            | Type      | Required | Description                                                                                          |
| ------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `success`           | `boolean` | Yes      | Whether the session was successfully revoked.                                                        |
| `wasCurrentSession` | `boolean` | Yes      | Whether the revoked session was the current session (session making the request). If `true`, cookies are automatically cleared. |

## Example

```json
{
  "success": true,
  "wasCurrentSession": false
}
```

## Used By

- [AuthService.logoutSession()](../services/auth-service#logoutsession)

