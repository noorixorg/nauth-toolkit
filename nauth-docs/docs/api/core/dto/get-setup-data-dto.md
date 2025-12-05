---
title: GetSetupDataDTO
description: Request DTO for MFA setup data retrieval. Includes UUID session token and MFA method enum validation.
keywords: [mfa, setup, data, dto, request, uuid, api]
image: /img/api-social-card.png
sidebar_position: 20
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
| `method`   | `MFASetupMethod`          | Yes      | MFA method. Must be: sms, email, totp, passkey.                  |
| `setupData`| `Record<string, unknown>` | No       | Optional provider-specific setup data (e.g., phoneNumber for SMS). |

## Example

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "method": "totp"
}
```

## Used By

- [MFAService.getSetupData()](../services/mfa-service#getsetupdata)
