---
title: GetUserDevicesDTO
description: Request and response DTOs for retrieving all MFA devices configured for a user. Returns array of device objects with type, name, and status.
keywords: [mfa, devices, dto, request, response, user, api]
image: /img/api-social-card.png
sidebar_position: 450
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
import { GetUserDevicesDTO, GetUserDevicesResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserDevicesDTO, GetUserDevicesResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserDevicesDTO, GetUserDevicesResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## GetUserDevicesDTO (Request)

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |

## GetUserDevicesResponseDTO (Response)

| Property  | Type           | Description                    |
| --------- | -------------- | ------------------------------ |
| `devices` | `IMFADevice[]` | Array of user's MFA devices.     |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
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
      "isPrimary": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Used By

- [MFAService.getUserDevices()](../services/mfa-service#getuserdevices)

