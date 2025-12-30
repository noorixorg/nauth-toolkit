---
title: GetMFAStatusDTO
description: Request and response DTOs for retrieving comprehensive MFA status including enabled status, configured methods, available methods, backup codes, and exemption information.
keywords: [mfa, status, dto, request, response, enabled, methods, api]
image: /img/api-social-card.png
sidebar_position: 490
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetMFAStatusDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for getting comprehensive MFA status for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetMFAStatusDTO, GetMFAStatusResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetMFAStatusDTO, GetMFAStatusResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetMFAStatusDTO, GetMFAStatusResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## GetMFAStatusDTO (Request)

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |

## GetMFAStatusResponseDTO (Response)

| Property            | Type                      | Description                           |
| ------------------- | ------------------------- | ------------------------------------- |
| `enabled`           | `boolean`                 | Whether MFA is enabled.               |
| `required`           | `boolean`                 | Whether MFA is required.               |
| `configuredMethods`  | `Array<MFADeviceMethod>`  | Array of configured device methods.   |
| `availableMethods`   | `Array<string>`           | Array of available method names.       |
| `hasBackupCodes`     | `boolean`                 | Whether user has backup codes.         |
| `preferredMethod`    | `MFADeviceMethod?`        | Preferred MFA method (if set).        |
| `mfaExempt`          | `boolean`                 | Whether user is exempt from MFA.       |
| `mfaExemptReason`     | `string \| null`          | Reason for exemption (if exempt).     |
| `mfaExemptGrantedAt`  | `Date \| null`            | Date exemption was granted (if exempt). |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

**Response:**

```json
{
  "enabled": true,
  "required": true,
  "configuredMethods": ["totp", "sms"],
  "availableMethods": ["totp", "sms", "passkey", "email"],
  "hasBackupCodes": true,
  "preferredMethod": "totp",
  "mfaExempt": false,
  "mfaExemptReason": null,
  "mfaExemptGrantedAt": null
}
```

## Used By

- [MFAService.getMFAStatus()](../services/mfa-service#getmfastatus)

