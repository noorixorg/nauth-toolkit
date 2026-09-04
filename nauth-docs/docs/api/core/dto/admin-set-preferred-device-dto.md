---
title: AdminSetPreferredDeviceDTO
description: Admin request DTO for setting a user's preferred MFA device
keywords: [mfa, device, preferred, dto, request, admin, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminSetPreferredDeviceDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)
**Context:** Admin Only

Request DTO for setting a specific MFA device as preferred for a user (admin operation).

:::warning[Admin Only]
This DTO requires both `sub` and `deviceId`. For user self-service, use [`MFAService.setPreferredDevice()`](../services/mfa-service#setpreferreddevice) which derives user from context.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminSetPreferredDeviceDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminSetPreferredDeviceDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminSetPreferredDeviceDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Required | Description                                                        |
| ---------- | -------- | -------- | ------------------------------------------------------------------ |
| `deviceId` | `number` | Yes      | MFA device ID to set as preferred. Must be positive integer. Auto-converted from string. |
| `sub`      | `string` | Yes      | Target user identifier.                                            |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "deviceId": 123
}
```

## Used By

- [MFAService.adminSetPreferredDevice()](../services/mfa-service#adminsetpreferreddevice)

## Related DTOs

- [AdminSetPreferredDeviceResponseDTO](#response) - Response DTO
- [SetPreferredDeviceDTO](./set-preferred-device-dto) - Self-service request DTO

---

## Response

### AdminSetPreferredDeviceResponseDTO

| Property  | Type     | Description     |
| --------- | -------- | --------------- |
| `message` | `string` | Success message |

**Example Response:**

```json
{
  "message": "Preferred MFA device updated"
}
```
