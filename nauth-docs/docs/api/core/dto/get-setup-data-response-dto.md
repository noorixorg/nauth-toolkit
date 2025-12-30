---
title: GetSetupDataResponseDTO
description: Response DTO for MFA setup data. Returns provider-specific setup information including TOTP QR codes, SMS masked phone, and Passkey WebAuthn options.
keywords: [mfa, setup, data, response, dto, totp, qr, passkey, api]
image: /img/api-social-card.png
sidebar_position: 510
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSetupDataResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for MFA setup data (structure varies by method).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSetupDataResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSetupDataResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSetupDataResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type                      | Description                    |
| ---------- | ------------------------- | ------------------------------ |
| `setupData` | `Record<string, unknown>` | Provider-specific setup data. Structure varies by method: TOTP returns secret, qrCode, manualEntryKey; SMS returns maskedPhone; Email returns maskedEmail; Passkey returns WebAuthn registration options. |

## Example

**TOTP:**

```json
{
  "setupData": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "manualEntryKey": "JBSWY3DPEHPK3PXP"
  }
}
```

**SMS:**

```json
{
  "setupData": {
    "maskedPhone": "***-***-7890"
  }
}
```

## Used By

- [MFAService.getSetupData()](../services/mfa-service#getsetupdata)

