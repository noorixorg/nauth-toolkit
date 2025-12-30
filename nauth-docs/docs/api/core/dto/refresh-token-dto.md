---
title: RefreshTokenDTO
description: Refresh token DTO for generating new access tokens. Validates JWT refresh token length and format.
keywords: [refresh, token, jwt, dto, authentication, request, api]
image: /img/api-social-card.png
sidebar_position: 70
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RefreshTokenDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for refreshing access tokens using a valid refresh token.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RefreshTokenDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RefreshTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RefreshTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property       | Type     | Required | Description                                                      |
| -------------- | -------- | -------- | ---------------------------------------------------------------- |
| `refreshToken` | `string` | Yes      | JWT refresh token. 10-2048 characters. Format validated in service. |

## Example

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Used By

- [AuthService.refreshToken()](../services/auth-service#refreshtoken)
