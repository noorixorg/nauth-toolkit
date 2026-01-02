---
title: CanSetPasswordResponseDTO
description: Response DTO for can set password check. Returns boolean indicating if user can set password.
keywords: [social, auth, dto, response, password, api]
image: /img/api-social-card.png
sidebar_position: 80
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CanSetPasswordResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for can set password check.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CanSetPasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CanSetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CanSetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property         | Type      | Required | Description                      |
| ---------------- | --------- | -------- | -------------------------------- |
| `canSetPassword` | `boolean` | Yes      | Whether user can set password    |

## Example

```json
{
  "canSetPassword": true
}
```

## Used By

- [SocialAuthService.canSetPassword()](../services/social-auth-service#cansetpassword)

