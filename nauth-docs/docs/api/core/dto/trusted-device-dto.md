---
title: TrustedDeviceDTOs
description: Request and response DTOs for listing and revoking the trusted devices that let a user skip MFA.
keywords: [trusted device, mfa, device, dto, request, response, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Trusted Device DTOs

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Cover listing and revoking the devices allowed to skip MFA. Enrolling a device returns [`TrustDeviceResponseDTO`](./trust-device-response-dto); these are the management operations that pair with it.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ListTrustedDevicesResponseDTO, RevokeTrustedDeviceDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ListTrustedDevicesResponseDTO, RevokeTrustedDeviceDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ListTrustedDevicesResponseDTO, RevokeTrustedDeviceDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## TrustedDeviceResponseDTO

One trusted device. Deliberately omits `deviceTokenHash` — the plaintext token is held only by the device itself, and its hash is never useful to a client.

| Property       | Type              | Required | Description                                                          |
| -------------- | ----------------- | -------- | -------------------------------------------------------------------- |
| `browser`      | `string \| null`  | No       | Browser reported by the device.                                       |
| `createdAt`    | `Date`            | Yes      | When the device was trusted.                                          |
| `deviceId`     | `string \| null`  | No       | Client-supplied device identifier, when the client sends one.         |
| `deviceName`   | `string \| null`  | No       | Human-readable device label.                                          |
| `deviceType`   | `string \| null`  | No       | Device form factor (e.g. `mobile`, `desktop`).                        |
| `id`           | `number`          | Yes      | Record id. Identifies the device when revoking it.                    |
| `ipAddress`    | `string \| null`  | No       | IP address the device was trusted from.                               |
| `lastUsedAt`   | `Date \| null`    | No       | Last authentication, or null if unused since being trusted.           |
| `platform`     | `string \| null`  | No       | Operating system reported by the device.                              |
| `trustedUntil` | `Date`            | Yes      | When the trust expires. Devices past this point are never listed.     |

## ListTrustedDevicesResponseDTO

| Property         | Type                        | Required | Description                                                 |
| ---------------- | --------------------------- | -------- | ----------------------------------------------------------- |
| `trustedDevices` | `TrustedDeviceResponseDTO[]` | Yes      | Unexpired trusted devices, most recently used first.        |

## RevokeTrustedDeviceDTO

Self-service revocation. The device is the caller's own, resolved from request context, so no user identifier is sent.

| Property   | Type     | Required | Description                                   |
| ---------- | -------- | -------- | --------------------------------------------- |
| `deviceId` | `number` | Yes      | Trusted device record id. Positive integer.   |

## AdminRevokeTrustedDeviceDTO

| Property   | Type     | Required | Description                                      |
| ---------- | -------- | -------- | ------------------------------------------------ |
| `deviceId` | `number` | Yes      | Trusted device record id. Positive integer.      |
| `sub`      | `string` | Yes      | Target user sub. UUID v4, trimmed and lowercased. |

## AdminManageTrustedDevicesDTO

| Property | Type     | Required | Description                                       |
| -------- | -------- | -------- | ------------------------------------------------- |
| `sub`    | `string` | Yes      | Target user sub. UUID v4, trimmed and lowercased. |

## RevokeTrustedDeviceResponseDTO

| Property  | Type      | Required | Description                                      |
| --------- | --------- | -------- | ------------------------------------------------ |
| `success` | `boolean` | Yes      | Whether a matching device was found and revoked. |

## RevokeAllTrustedDevicesResponseDTO

| Property       | Type     | Required | Description                    |
| -------------- | -------- | -------- | ------------------------------ |
| `revokedCount` | `number` | Yes      | How many devices were revoked. |

## Example

```json
{
  "trustedDevices": [
    {
      "id": 7,
      "deviceName": "Work laptop",
      "deviceType": "desktop",
      "platform": "macOS",
      "browser": "Chrome",
      "ipAddress": "203.0.113.5",
      "trustedUntil": "2026-04-01T00:00:00.000Z",
      "lastUsedAt": "2026-03-05T09:12:00.000Z",
      "createdAt": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

## Used By

- [AuthService.listTrustedDevices()](../services/auth-service#listtrusteddevices)
- [AuthService.revokeTrustedDevice()](../services/auth-service#revoketrusteddevice)
- [AuthService.revokeAllTrustedDevices()](../services/auth-service#revokealltrusteddevices)
- [AdminAuthService.getUserTrustedDevices()](../services/admin-auth-service#getusertrusteddevices)
- [AdminAuthService.revokeUserTrustedDevice()](../services/admin-auth-service#revokeusertrusteddevice)
- [AdminAuthService.revokeAllUserTrustedDevices()](../services/admin-auth-service#revokeallusertrusteddevices)
