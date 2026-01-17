---
title: GetMFAStatusResponseDTO
description: Response DTO for retrieving comprehensive MFA status including enabled status, configured methods, available methods, backup codes, and exemption information.
keywords: [mfa, status, dto, response, enabled, methods, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetMFAStatusResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for getting comprehensive MFA status for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetMFAStatusResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetMFAStatusResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetMFAStatusResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

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

- [MFAService.getMfaStatus()](../services/mfa-service#getmfastatus) - User self-service method
- [MFAService.adminGetMfaStatus()](../services/mfa-service#admingetmfastatus) - Admin operation

## Related APIs

- [AdminGetMFAStatusDTO](./admin-get-mfa-status-dto) - Admin request DTO (requires `sub`)

