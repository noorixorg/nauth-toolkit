---
title: AdminGetUserDevicesDTO
description: Admin request DTO for retrieving all MFA devices for a target user
keywords: [mfa, devices, dto, request, admin, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminGetUserDevicesDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)
**Context:** Admin Only

Request DTO for retrieving all active MFA devices for a target user (admin operation).

:::warning Admin Only
This DTO requires the `sub` field to specify the target user. For user self-service device listing, use [`MFAService.getUserDevices()`](../services/mfa-service#getuserdevices) which derives the user from authenticated context.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminGetUserDevicesDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminGetUserDevicesDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminGetUserDevicesDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                        |
| -------- | -------- | -------- | -------------------------------------------------- |
| `sub`    | `string` | Yes      | Target user's unique identifier. Must be a non-empty string. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [MFAService.adminGetUserDevices()](../services/mfa-service#admingetuserdevices)

## Related DTOs

- [GetUserDevicesResponseDTO](./get-user-devices-dto) - Response DTO
- [GetUserDevicesDTO](./get-user-devices-dto) - Self-service request DTO (no sub required)
