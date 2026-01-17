---
title: ResponseChallengeDTO
description: Challenge response DTO returned when authentication requires additional verification steps. Contains challenge type, session token, and challenge parameters.
keywords: [challenge, response, dto, verification, mfa, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResponseChallengeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Challenge response DTO returned when authentication requires additional verification steps. Contains challenge type, session token, and challenge-specific parameters.

:::note
The actual class name is `AuthChallengeResponseDTO`. This documentation uses `ResponseChallengeDTO` as an alias for clarity.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthChallengeResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthChallengeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthChallengeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property              | Type                                   | Required | Description                                                                                                   |
| --------------------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `challengeName`       | [`AuthChallenge`](./auth-challenge-dto#authchallenge-enum) | Yes      | Challenge type. Must be: VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, MFA_SETUP_REQUIRED, FORCE_CHANGE_PASSWORD. |
| `session`             | `string`                               | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased.                                              |
| `challengeParameters` | `Record<string, unknown>`              | Yes      | Challenge-specific parameters object.                                                                         |
| `sub`                 | `string`                               | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.                                                      |

## Example

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "email": "user@example.com",
    "codeDeliveryDestination": "u***@example.com"
  },
  "sub": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

## Used By

- [AuthService.login()](../services/auth-service#login) - Returns this when challenge required
- [AuthService.signup()](../services/auth-service#signup) - Returns this when challenge required
- [AuthResponseDTO](./auth-response-dto) - Contains challenge fields when challenge required

