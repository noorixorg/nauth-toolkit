---
title: ValidateAccessTokenDTO
description: Request DTO for validating JWT access tokens. Returns validation result with decoded payload or error information.
keywords: [token, validate, jwt, access, dto, request, api, authentication]
image: /img/api-social-card.png
sidebar_position: 931
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ValidateAccessTokenDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for validating JWT access tokens and decoding their payload.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ValidateAccessTokenDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ValidateAccessTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ValidateAccessTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type     | Required | Description                                                                                            |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `accessToken` | `string` | Yes      | JWT access token to validate. Min 10 chars, max 2048 chars. Format and signature validated by service. |

## Example

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
}
```

## Used By

- [AuthService.validateAccessToken()](../services/auth-service#validateaccesstoken)
