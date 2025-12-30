---
title: DisableUserDTO
description: Administrative account locking request with permanent lock
sidebar_position: 160
keywords: [dto, admin, disable, lock, user]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DisableUserDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Input DTO for administrative permanent account locking with session revocation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DisableUserDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DisableUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DisableUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description with validation inline                                          |
| -------- | -------- | -------- | --------------------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User UUID to disable. Must be valid UUID format.                            |
| `reason` | `string` | No       | Reason for locking account. Max 500 chars. Recorded in audit trail.        |

## Example

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Suspicious activity detected"
}
```

## Used By

- [AuthService.disableUser()](../services/auth-service#disableuser)

