---
title: LogoutDTO
description: Logout request DTO with optional user sub and forgetMe flag. Session ID is automatically extracted from JWT context.
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

| Property   | Type      | Required | Description                                                      |
| ---------- | --------- | -------- | ---------------------------------------------------------------- |
| `sub`      | `string`  | No       | User identifier. UUID v4 format. Optional, for additional verification. Trimmed and lowercased. |
| `forgetMe` | `boolean` | No       | If true, also removes trusted device. Default: false.            |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "forgetMe": false
}
```

## Used By

- [AuthService.logout()](../services/auth-service#logout)
