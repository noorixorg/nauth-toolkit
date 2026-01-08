---
title: SetMustChangePasswordResponseDTO
description: Set must change password response DTO with success indicator. Simple boolean response for flag setting operations.
keywords: [password, change, required, response, dto, success, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetMustChangePasswordResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for setting must change password flag.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetMustChangePasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetMustChangePasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetMustChangePasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type      | Required | Description                                                      |
| --------- | --------- | -------- | ---------------------------------------------------------------- |
| `success` | `boolean` | Yes      | Success indicator. Always true on successful flag set.            |

## Example

```json
{
  "success": true
}
```

## Used By

- [AuthService.setMustChangePassword()](../services/auth-service#setmustchangepassword)
