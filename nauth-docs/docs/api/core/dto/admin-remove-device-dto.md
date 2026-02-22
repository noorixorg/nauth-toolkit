---
title: AdminRemoveDeviceDTO
description: Admin request DTO for removing a single MFA device by device ID
keywords: [mfa, device, remove, dto, request, admin, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminRemoveDeviceDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)
**Context:** Admin Only

Request DTO for removing a single MFA device by device ID (admin operation).

:::warning Admin Only
This DTO allows removing any user's device by ID. For user self-service device removal, use [`MFAService.removeDevice()`](../services/mfa-service#removedevice) which validates ownership.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminRemoveDeviceDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminRemoveDeviceDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminRemoveDeviceDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                              |
| ---------- | -------- | -------- | -------------------------------------------------------- |
| `deviceId` | `number` | Yes      | MFA device ID. Must be positive integer. Auto-converted from string. |

## Example

```json
{
  "deviceId": 123
}
```

## Used By

- [MFAService.adminRemoveDevice()](../services/mfa-service#adminremovedevice)

## Related DTOs

- [RemoveDeviceDTO](./remove-device-dto) - Self-service request DTO
