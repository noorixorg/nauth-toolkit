---
title: ResendCodeResponseDTO
description: Resend code response DTO with masked destination. Returns privacy-protected email or phone where code was sent.
keywords: [resend, code, response, dto, destination, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResendCodeResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for resending verification codes.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendCodeResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendCodeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendCodeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `destination` | `string` | Yes      | Masked destination where code was sent. Email: "u***r@example.com", Phone: "+1***5678". |

## Example

```json
{
  "destination": "u***r@example.com"
}
```

## Used By

- [AuthService.resendCode()](../services/auth-service#resendcode)
