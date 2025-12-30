---
title: SetPreferredMethodDTO
description: Request and response DTOs for setting preferred MFA method. Updates user's preferred method and device primary flags.
keywords: [mfa, preferred, method, dto, request, response, api]
image: /img/api-social-card.png
sidebar_position: 550
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

| Property    | Type     | Required | Description                                                      |
| ----------- | -------- | -------- | ---------------------------------------------------------------- |
| `userSub`   | `string` | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |
| `methodType` | `string` | Yes      | MFA method type to set as preferred. Must be: totp, sms, email, passkey. Max 50 characters. Trimmed and lowercased. |

## SetPreferredMethodResponseDTO (Response)

| Property  | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `message` | `string` | Success message.                |

## Example

```json
{
  "userSub": "a21b654c-2746-4168-acee-c175083a65cd",
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

