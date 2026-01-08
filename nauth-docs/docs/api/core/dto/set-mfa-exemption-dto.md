---
title: SetMFAExemptionDTO
description: Request and response DTOs for granting or revoking MFA exemption. Admin-only operation with optional reason and grantedBy fields.
keywords: [mfa, exemption, admin, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetMFAExemptionDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for granting or revoking a user's exemption from multi-factor authentication requirements.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetMFAExemptionDTO, SetMFAExemptionResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetMFAExemptionDTO, SetMFAExemptionResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetMFAExemptionDTO, SetMFAExemptionResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## SetMFAExemptionDTO (Request)

| Property    | Type            | Required | Description                                                      |
| ----------- | --------------- | -------- | ---------------------------------------------------------------- |
| `userSub`   | `string`        | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |
| `exempt`    | `boolean`       | Yes      | Grant exemption (true) or revoke exemption (false).              |
| `reason`    | `string \| null` | No       | Reason for exemption status change. Max 500 characters. Trimmed. |
| `grantedBy` | `string \| null` | No       | Identifier of admin performing action. Max 255 characters. Trimmed. |

## SetMFAExemptionResponseDTO (Response)

| Property            | Type            | Description                    |
| ------------------- | --------------- | ------------------------------ |
| `mfaExempt`         | `boolean`       | Whether user is exempt.         |
| `mfaExemptReason`   | `string \| null` | Reason for exemption.           |
| `mfaExemptGrantedAt` | `Date \| null`  | Date exemption was granted.     |

## Example

```json
{
  "userSub": "a21b654c-2746-4168-acee-c175083a65cd",
  "exempt": true,
  "reason": "Business partner requires MFA bypass",
  "grantedBy": "admin@example.com"
}
```

**Response:**

```json
{
  "mfaExempt": true,
  "mfaExemptReason": "Business partner requires MFA bypass",
  "mfaExemptGrantedAt": "2024-01-01T00:00:00.000Z"
}
```

## Used By

- [MFAService.setMFAExemption()](../services/mfa-service#setmfaexemption)

