---
title: ResendCodeDTO
description: Resend verification code DTO with UUID v4 session token validation. Used for email, SMS, and MFA code resending.
keywords: [resend, code, verification, dto, challenge, session, uuid, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResendCodeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for resending verification codes during authentication challenges.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendCodeDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendCodeDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendCodeDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description                                                      |
| --------- | -------- | -------- | ---------------------------------------------------------------- |
| `session` | `string` | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased. |

## Example

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [AuthService.resendCode()](../services/auth-service#resendcode)
