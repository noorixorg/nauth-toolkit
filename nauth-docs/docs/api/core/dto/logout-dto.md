---
title: LogoutDTO
description: Logout request DTO with optional forgetMe flag. Session and user context are extracted from JWT.
keywords: [logout, dto, request, session, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LogoutDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for logging out from the current authenticated session.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LogoutDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LogoutDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LogoutDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type      | Required | Description                                           |
| ---------- | --------- | -------- | ----------------------------------------------------- |
| `forgetMe` | `boolean` | No       | If true, also removes trusted device. Default: false. |

## Example

```json
{
  "forgetMe": false
}
```

## Used By

- [AuthService.logout()](../services/auth-service#logout)
