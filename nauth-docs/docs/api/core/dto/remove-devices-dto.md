---
title: RemoveDevicesDTO
description: Request and response DTOs for removing MFA devices by method type. Automatically disables MFA if this was the last device.
keywords: [mfa, devices, remove, delete, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RemoveDevicesDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for removing all MFA devices of a specific method type for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RemoveDevicesDTO, RemoveDevicesResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RemoveDevicesDTO, RemoveDevicesResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RemoveDevicesDTO, RemoveDevicesResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## RemoveDevicesDTO (Request)

:::note User Self-Service
This DTO is for user self-service operations. The user is automatically derived from the authenticated user's context. No `sub` field is required or allowed.
:::

| Property    | Type     | Required | Description                                                      |
| ----------- | -------- | -------- | ---------------------------------------------------------------- |
| `methodType` | `string` | Yes      | MFA method type to remove. Must be: totp, sms, email, passkey. Max 50 characters. Trimmed and lowercased. |

## RemoveDevicesResponseDTO (Response)

| Property      | Type      | Description                    |
| ------------- | --------- | ------------------------------ |
| `deletedCount` | `number`  | Number of devices deleted.       |
| `mfaDisabled` | `boolean` | Whether MFA was disabled (if this was the last device). |

## Example

```json
{
  "methodType": "totp"
}
```

**Response:**

```json
{
  "deletedCount": 1,
  "mfaDisabled": false
}
```

## Used By

- [MFAService.removeDevices()](../services/mfa-service#removedevices)

