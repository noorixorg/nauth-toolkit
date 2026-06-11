---
title: MFADeviceResponseDTO
description: Response DTO for MFA device information. Maps internal device entities to the outward-facing API shape.
keywords: [mfa, device, response, dto, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MFADeviceResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Outward-facing MFA device information. Maps the internal device entity to the public API shape, translating the internal `isPrimary` field to the external `isPreferred` field.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { MFADeviceResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { MFADeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { MFADeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                                                       | Description                                             |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `id`          | `number`                                                   | Unique device identifier                                |
| `type`        | [`MFADeviceMethod`](../enums/mfa-method)  | MFA method type (`totp`, `sms`, `email`, `passkey`)     |
| `name`        | `string`                                                   | Device name (user-assigned)                             |
| `isPreferred` | `boolean`                                                  | Whether this is the preferred device for this method    |
| `isActive`    | `boolean`                                                  | Whether the device is currently active                  |
| `createdAt`   | `Date`                                                     | Device creation timestamp                               |

## Static Methods

### fromEntity()

```typescript
static fromEntity(device: IMFADevice): MFADeviceResponseDTO
```

Converts an internal `IMFADevice` entity to an outward-facing `MFADeviceResponseDTO`.

### fromEntities()

```typescript
static fromEntities(devices: IMFADevice[]): MFADeviceResponseDTO[]
```

Converts an array of internal `IMFADevice` entities to an array of `MFADeviceResponseDTO` objects.

## Example

```json
{
  "id": 1,
  "type": "totp",
  "name": "Google Authenticator",
  "isPreferred": true,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Used By

- [MFAService.getUserDevices()](../services/mfa-service#getuserdevices)
- [MFAService.adminGetUserDevices()](../services/mfa-service#admingetuserdevices)

## Related DTOs

- [GetUserDevicesResponseDTO](./get-user-devices-dto#getuserdevicesresponsedto-response) - Contains `devices: MFADeviceResponseDTO[]`
- [GetUserDevicesDTO](./get-user-devices-dto) - Request DTO
