---
title: GetUserByEmailDTO
description: Request DTO for retrieving user by email address. Includes optional flag to require verified email.
keywords: [get, user, email, dto, request, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserByEmailDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for retrieving a user by email address.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserByEmailDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserByEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserByEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property              | Type      | Required | Description                                                      |
| --------------------- | --------- | -------- | ---------------------------------------------------------------- |
| `email`               | `string`  | Yes      | Email address. Valid email format. Max 255 characters. Trimmed and lowercased. |
| `requireEmailVerified` | `boolean` | No       | Only return user if email is verified. Default: false.            |

## Example

```json
{
  "email": "user@example.com",
  "requireEmailVerified": true
}
```

## Used By

- [AuthService.getUserByEmail()](../services/admin-auth-service#getuserbyemail)
