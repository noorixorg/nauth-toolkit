---
title: DeleteUserDTO
description: Administrative user deletion request with cascade cleanup
sidebar_position: 5
keywords: [dto, admin, delete, user, cascade]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DeleteUserDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Input DTO for administrative user deletion with complete cascade cleanup.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DeleteUserDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DeleteUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DeleteUserDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description with validation inline                |
| -------- | -------- | -------- | ------------------------------------------------- |
| `sub`    | `string` | Yes      | User UUID to delete. Must be valid UUID format.   |

## Example

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Used By

- [AuthService.deleteUser()](../services/auth-service#deleteuser)

