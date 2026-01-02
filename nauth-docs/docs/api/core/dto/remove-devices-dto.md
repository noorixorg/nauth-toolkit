---
title: RemoveDevicesDTO
description: Request and response DTOs for removing MFA devices by method type. Automatically disables MFA if this was the last device.
keywords: [mfa, devices, remove, delete, dto, request, response, api]
image: /img/api-social-card.png
sidebar_position: 630
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

| Property    | Type     | Required | Description                                                      |
| ----------- | -------- | -------- | ---------------------------------------------------------------- |
| `userSub`   | `string` | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |
| `methodType` | `string` | Yes      | MFA method type to remove. Must be: totp, sms, email, passkey. Max 50 characters. Trimmed and lowercased. |

## RemoveDevicesResponseDTO (Response)

| Property      | Type      | Description                    |
| ------------- | --------- | ------------------------------ |
| `deletedCount` | `number`  | Number of devices deleted.       |
| `mfaDisabled` | `boolean` | Whether MFA was disabled (if this was the last device). |

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
  "deletedCount": 1,
  "mfaDisabled": false
}
```

## Used By

- [MFAService.removeDevices()](../services/mfa-service#removedevices)

