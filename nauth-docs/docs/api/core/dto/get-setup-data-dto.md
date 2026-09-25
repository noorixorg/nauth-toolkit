---
title: GetSetupDataDTO
description: Request DTO for MFA setup data retrieval. Includes UUID session token and MFAMethod enum validation.
keywords: [mfa, setup, data, dto, request, uuid, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSetupDataDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for requesting MFA setup data (e.g., TOTP QR code, SMS setup).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSetupDataDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSetupDataDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSetupDataDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type                      | Required | Description                                                      |
| ---------- | ------------------------- | -------- | ---------------------------------------------------------------- |
| `session`  | `string`                  | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased. |
| `method`   | `MFAMethod`               | Yes      | MFA method. Must be: `sms`, `email`, `totp`, `passkey`.          |
| `setupData`| `Record<string, unknown>` | No       | Provider-specific setup input. SMS: `{ phoneNumber?: string, deviceName?: string }`. `phoneNumber` (E.164) is required when the account has no phone; a different number replaces the phone on file and resets its verification. |

## Example

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "method": "sms",
  "setupData": { "phoneNumber": "+14155552671" }
}
```

## Used By

- [MFAService.getSetupData()](../services/mfa-service#getsetupdata)
