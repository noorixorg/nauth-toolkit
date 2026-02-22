---
title: GetDeviceTokenResponseDTO
description: Response DTO for device token. Returns device token from the current request context for trusted device feature.
keywords: [device, token, trusted, response, dto, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetDeviceTokenResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for device token from the current request context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetDeviceTokenResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetDeviceTokenResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetDeviceTokenResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property     | Type       | Description                                                      |
| ------------ | ---------- | ---------------------------------------------------------------- |
| `deviceToken` | `string?`  | Device token for trusted device feature. Extracted from cookie (`nauth_device_token`) or header (`X-Device-Token`). Optional - undefined if not present. |

## Example

```json
{
  "deviceToken": "device-token-123"
}
```

## Used By

- [ClientInfoService.getDeviceToken()](../services/client-info-service#getdevicetoken)

