---
title: IsTrustedDeviceResponseDTO
description: Response DTO for checking if the current device is trusted
keywords: [trusted, device, response, dto, api, mfa]
image: /img/api-social-card.png
sidebar_position: 54
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# IsTrustedDeviceResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for checking if the current device is trusted.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { IsTrustedDeviceResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { IsTrustedDeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { IsTrustedDeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type      | Description                                                      |
| --------- | --------- | ---------------------------------------------------------------- |
| `trusted` | `boolean` | Whether the current device is trusted. True if the device has a valid trusted device token and trust has not expired. |

## Example

```json
{
  "trusted": true
}
```

## Used By

- [AuthService.isTrustedDevice()](../services/auth-service#istrusteddevice)

## Related

- [TrustDeviceResponseDTO](./trust-device-response-dto) - Response for trusting a device
- [Trusted Device Feature](../../../../guides/trusted-devices) - Guide on trusted devices

## Notes

- Works in both **cookies mode** (reads from httpOnly cookie) and **JSON mode** (reads from X-Device-Token header)
- Performs server-side validation of the device token
- Returns `false` if:
  - No device token exists
  - Device token is invalid or tampered
  - Trust has expired
  - Trusted device feature is disabled



