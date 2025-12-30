---
title: ChangePasswordResponseDTO
description: Password change response DTO with success indicator. Simple boolean response for password change operations.
keywords: [password, change, response, dto, success, api]
image: /img/api-social-card.png
sidebar_position: 230
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ChangePasswordResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for changing password.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ChangePasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ChangePasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ChangePasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type      | Required | Description                                                      |
| --------- | --------- | -------- | ---------------------------------------------------------------- |
| `success` | `boolean` | Yes      | Success indicator. Always true on successful password change.     |

## Example

```json
{
  "success": true
}
```

## Used By

- [AuthService.changePassword()](../services/auth-service#changepassword)
