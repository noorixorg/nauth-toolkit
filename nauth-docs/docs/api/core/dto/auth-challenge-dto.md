---
title: AuthChallengeDTO
description: Authentication challenge DTOs for challenge responses and challenge completion requests. Includes challenge type enums and validation.
keywords: [challenge, auth, dto, response, request, enum, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthChallengeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for authentication challenges: response DTO and legacy completion request DTO.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthChallengeResponseDTO, ChallengeResponseRequestDTO, AuthChallenge } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthChallengeResponseDTO, ChallengeResponseRequestDTO, AuthChallenge } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthChallengeResponseDTO, ChallengeResponseRequestDTO, AuthChallenge } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AuthChallengeResponseDTO

Challenge response DTO (primarily used in responses).

| Property              | Type                                   | Required | Description                                                                                                   |
| --------------------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `challengeName`       | [`AuthChallenge`](#authchallenge-enum) | Yes      | Challenge type. Must be: VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, MFA_SETUP_REQUIRED, FORCE_CHANGE_PASSWORD. |
| `session`             | `string`                               | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased.                                              |
| `challengeParameters` | `Record<string, unknown>`              | Yes      | Challenge-specific parameters object.                                                                         |
| `userSub`             | `string`                               | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.                                                      |

## ChallengeResponseRequestDTO

Legacy challenge completion request DTO (kept for backwards compatibility).

| Property             | Type                                   | Required | Description                                                      |
| -------------------- | -------------------------------------- | -------- | ---------------------------------------------------------------- |
| `session`            | `string`                               | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased. |
| `challengeName`      | [`AuthChallenge`](#authchallenge-enum) | Yes      | Challenge type enum value.                                       |
| `challengeResponses` | `Record<string, unknown>`              | Yes      | Challenge-specific responses object.                             |

## AuthChallenge enum {#authchallenge-enum}

Represents the challenge type returned by the auth flow.

- `VERIFY_EMAIL`
- `VERIFY_PHONE`
- `MFA_REQUIRED`
- `MFA_SETUP_REQUIRED`
- `FORCE_CHANGE_PASSWORD`

## Example

**Challenge Response:**

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "email": "user@example.com"
  },
  "userSub": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

## Used By

- [AuthService.respondToChallenge()](../services/auth-service#respondtochallenge) - Uses RespondChallengeDTO (not these legacy DTOs)
