---
title: SetupMFADTO
description: Request and response DTOs for setting up MFA device. Includes user sub, method name, and optional provider-specific setup data.
keywords: [mfa, setup, device, dto, request, response, api]
image: /img/api-social-card.png
sidebar_position: 71
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetupMFADTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for setting up an MFA device using the appropriate provider.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetupMFADTO, SetupMFAResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetupMFADTO, SetupMFAResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetupMFADTO, SetupMFAResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## SetupMFADTO (Request)

| Property    | Type                      | Required | Description                                                      |
| ----------- | ------------------------- | -------- | ---------------------------------------------------------------- |
| `sub`       | `string`                  | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |
| `methodName` | `string`                  | Yes      | MFA method name. Must be: totp, sms, email, passkey. Max 50 characters. Trimmed and lowercased. |
| `setupData` | `Record<string, unknown>` | No       | Optional provider-specific setup data (e.g., phoneNumber for SMS). Must be object if provided. |

## SetupMFAResponseDTO (Response)

| Property   | Type                      | Description                    |
| ---------- | ------------------------- | ------------------------------ |
| `setupData` | `Record<string, unknown>` | Provider-specific setup response. Structure varies by method: TOTP returns secret, qrCode, manualEntryKey; SMS returns maskedPhone; Passkey returns WebAuthn registration options. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodName": "totp"
}
```

**Response (TOTP):**

```json
{
  "setupData": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "manualEntryKey": "JBSWY3DPEHPK3PXP"
  }
}
```

## Used By

- [MFAService.setup()](../services/mfa-service#setup)

