---
title: GetUserDevicesDTO
description: Request and response DTOs for retrieving all MFA devices configured for a user. Returns array of device objects with type, name, and status.
keywords: [mfa, devices, dto, request, response, user, api, admin]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserDevicesDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for getting all MFA devices configured for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { 
  GetUserDevicesDTO, 
  AdminGetUserDevicesDTO, 
  GetUserDevicesResponseDTO 
} from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { 
  GetUserDevicesDTO, 
  AdminGetUserDevicesDTO, 
  GetUserDevicesResponseDTO 
} from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { 
  GetUserDevicesDTO, 
  AdminGetUserDevicesDTO, 
  GetUserDevicesResponseDTO 
} from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## GetUserDevicesDTO (Self-Service Request)

Used for self-service device retrieval. User is obtained from the authenticated context.

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| (none)   | -    | -        | User obtained from authenticated context |

## AdminGetUserDevicesDTO (Admin Request)

Used for admin operations to retrieve devices for a specific user.

| Property | Type     | Required | Description                                          |
| -------- | -------- | -------- | ---------------------------------------------------- |
| `sub`    | `string` | Yes      | Target user's unique identifier                      |

**Validation:**
- `sub` is required and must be a non-empty string

## GetUserDevicesResponseDTO (Response)

| Property  | Type                   | Description                              |
| --------- | ---------------------- | ---------------------------------------- |
| `devices` | `MFADeviceResponseDTO[]` | Array of user's MFA devices              |

Each device contains:

| Property      | Type               | Description                              |
| ------------- | ------------------ | ---------------------------------------- |
| `id`          | `number`           | Device ID                                |
| `type`        | `MFADeviceMethod`  | Device type (totp, sms, email, passkey)  |
| `name`        | `string`           | Device name                              |
| `isPreferred` | `boolean`          | Whether this is the preferred device     |
| `isActive`    | `boolean`          | Whether the device is active             |
| `createdAt`   | `Date`             | Device creation timestamp                |

## Self-Service Example

```typescript
// Get devices for current authenticated user
const result = await mfaService.getUserDevices({});
```

**Response:**

```json
{
  "devices": [
    {
      "id": 1,
      "type": "totp",
      "name": "Google Authenticator",
      "isActive": true,
      "isPreferred": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "type": "passkey",
      "name": "MacBook Pro",
      "isActive": true,
      "isPreferred": false,
      "createdAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

## Admin Example

```typescript
// Get devices for a specific user (admin only)
const result = await mfaService.adminGetUserDevices({ 
  sub: 'a21b654c-2746-4168-acee-c175083a65cd' 
});
```

**Response:** Same format as self-service.

## Controller Examples

### NestJS Self-Service Endpoint

```typescript
@Get('mfa/devices')
@UseGuards(AuthGuard)
async getMFADevices(): Promise<GetUserDevicesResponseDTO> {
  return this.mfaService.getUserDevices({});
}
```

### NestJS Admin Endpoint

```typescript
@Get('admin/users/:sub/mfa/devices')
@UseGuards(AdminAuthGuard) // Your admin guard
async adminGetUserDevices(
  @Param() dto: AdminGetUserDevicesDTO
): Promise<GetUserDevicesResponseDTO> {
  return this.mfaService.adminGetUserDevices(dto);
}
```

## Used By

- [MFAService.getUserDevices()](../services/mfa-service#getuserdevices) - Self-service
- [MFAService.adminGetUserDevices()](../services/mfa-service#admingetuserdevices) - Admin operation

## Related DTOs

- [AdminGetUserDevicesDTO](./admin-get-user-devices-dto) - Admin request DTO (requires `sub`)
- [RemoveDeviceDTO](./remove-device-dto) - Remove a device by ID
- [SetPreferredDeviceDTO](./set-preferred-device-dto) - Set preferred device

