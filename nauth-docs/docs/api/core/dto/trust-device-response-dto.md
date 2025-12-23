---
title: TrustDeviceResponseDTO
description: Trust device response DTO with device trust token. Returns UUID token for trusted device identification.
keywords: [trust, device, response, dto, token, api]
image: /img/api-social-card.png
sidebar_position: 73
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TrustDeviceResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for trusting a device.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { TrustDeviceResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { TrustDeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { TrustDeviceResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `deviceToken` | `string` | Yes      | Device trust token (UUID v4). Store securely on client.           |

## Example

```json
{
  "deviceToken": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [AuthService.trustDevice()](../services/auth-service#trustdevice)
