---
title: VerifyMFASetupResponseDTO
description: Response DTO returned after successfully verifying MFA device setup. Contains the newly created device ID.
keywords: [mfa, setup, verify, response, dto, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyMFASetupResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response returned when an authenticated user completes MFA device setup verification. Contains the ID of the newly created device.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyMFASetupResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyMFASetupResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyMFASetupResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type     | Description                      |
| ---------- | -------- | -------------------------------- |
| `deviceId` | `number` | ID of the newly created MFA device |

## Example

```json
{
  "deviceId": 42
}
```

## Used By

- [MFAService.setup()](../services/mfa-service#setup) - Returned after setup verification is complete

## Related DTOs

- [SetupMFADTO](./setup-mfa-dto) - Request DTO for initiating MFA setup
- [MFADeviceResponseDTO](./mfa-device-response-dto) - Full device details (use with `getUserDevices()`)
