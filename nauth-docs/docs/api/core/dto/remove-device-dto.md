---
title: RemoveDeviceDTO
description: Request and response DTOs for removing a single MFA device by id
keywords: [mfa, device, remove, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RemoveDeviceDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for removing a single MFA device by its numeric ID.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RemoveDeviceDTO, RemoveDeviceResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RemoveDeviceDTO, RemoveDeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RemoveDeviceDTO, RemoveDeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## RemoveDeviceDTO (Request)

| Property   | Type     | Required | Description                                  |
| ---------- | -------- | -------- | -------------------------------------------- |
| `deviceId` | `number` | Yes      | MFA device id. Must be an integer \(\(\(\ge 1\)\)\). |

## RemoveDeviceResponseDTO (Response)

| Property          | Type     | Description                                                  |
| ----------------- | -------- | ------------------------------------------------------------ |
| `removedDeviceId` | `number` | The device ID that was removed                               |
| `removedMethod`   | `string` | MFA method for the removed device (totp, sms, email, passkey) |
| `mfaDisabled`     | `boolean`| Whether MFA was disabled (device was the last remaining device) |

## Used By

- [MFAService.removeDevice()](../services/mfa-service#removedevice) - Self-service device removal

## Related DTOs

- [AdminRemoveDeviceDTO](./admin-remove-device-dto) - Admin variant (can remove any user's device)
- [RemoveDevicesDTO](./remove-devices-dto) - Remove all devices by method type

