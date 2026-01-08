---
title: ResendVerificationEmailDTO
description: Request DTO for resending verification emails. Supports identification by user sub (UUID) or email address with optional base URL.
keywords: [email, verification, dto, request, resend, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResendVerificationEmailDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for resending verification emails. Supports identification by user sub or email address.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendVerificationEmailDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendVerificationEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendVerificationEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description                                                                                    |
| --------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `sub`     | `string` | No       | User identifier (UUID v4). Required if email not provided. Trimmed and lowercased.            |
| `email`   | `string` | No       | User email address. Required if sub not provided. Valid email format. Max 255 chars. Trimmed and lowercased. |
| `baseUrl` | `string` | No       | Base URL for verification link. Must be valid URL with http:// or https://. Max 2048 chars.   |

:::info
Either `sub` or `email` must be provided (not both).
:::

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "baseUrl": "https://example.com"
}
```

Or by email:

```json
{
  "email": "user@example.com",
  "baseUrl": "https://example.com"
}
```

## Used By

- [EmailVerificationService.resendVerificationEmail()](../services/email-verification-service#resendverificationemail)

