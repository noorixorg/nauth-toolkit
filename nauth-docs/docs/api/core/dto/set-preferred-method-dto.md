---
title: SetPreferredMethodDTO
description: Request and response DTOs for setting preferred MFA method. Updates user's preferred method and device primary flags.
keywords: [mfa, preferred, method, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetPreferredMethodDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for setting the preferred MFA method for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetPreferredMethodDTO, SetPreferredMethodResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetPreferredMethodDTO, SetPreferredMethodResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetPreferredMethodDTO, SetPreferredMethodResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## SetPreferredMethodDTO (Request)

:::note User Self-Service
This DTO is for user self-service operations. The user is automatically derived from the authenticated user's context. No `sub` field is required or allowed.
:::

| Property    | Type     | Required | Description                                                      |
| ----------- | -------- | -------- | ---------------------------------------------------------------- |
| `methodType` | `string` | Yes      | MFA method type to set as preferred. Must be: totp, sms, email, passkey. Max 50 characters. Trimmed and lowercased. |

## SetPreferredMethodResponseDTO (Response)

| Property  | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `message` | `string` | Success message.                |

## Example

```json
{
  "methodType": "totp"
}
```

**Response:**

```json
{
  "message": "Preferred method updated"
}
```

## Used By

- [MFAService.setPreferredMethod()](../services/mfa-service#setpreferredmethod)

