---
title: EnableUserDTO
description: Administrative account unlocking request
sidebar_position: 180
keywords: [dto, admin, enable, unlock, user]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# EnableUserDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Input DTO for administrative account unlocking. Clears all lock fields to reverse the effect of disableUser() or rate-limit lockouts.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { EnableUserDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { EnableUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { EnableUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description with validation inline                    |
| -------- | -------- | -------- | ----------------------------------------------------- |
| `sub`    | `string` | Yes      | User UUID to enable. Must be valid UUID format.       |

## Example

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Used By

- [AuthService.enableUser()](../services/auth-service#enableuser)




