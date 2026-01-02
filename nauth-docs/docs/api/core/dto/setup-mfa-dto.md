---
title: SetupMFADTO
description: Request and response DTOs for setting up MFA device. Includes user sub, method name, and optional provider-specific setup data.
keywords: [mfa, setup, device, dto, request, response, api]
image: /img/api-social-card.png
sidebar_position: 830
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
| `setupData` | `Record<string, unknown>` | No       | Optional provider-specific setup data. Structure varies by method (see below). Must be object if provided. |

### setupData by Method

**TOTP:**
- No `setupData` required (or empty object `{}`)

**SMS:**
```typescript
{
  phoneNumber: string;    // Phone number in E.164 format (e.g., '+1234567890')
  deviceName?: string;     // Optional user-friendly device name (e.g., 'My iPhone')
}
```

**Email:**
```typescript
{
  email: string;          // Email address (e.g., 'user@example.com')
  deviceName?: string;     // Optional user-friendly device name (e.g., 'My Email')
}
```

**Passkey:**
- No `setupData` required (or empty object `{}`)

## SetupMFAResponseDTO (Response)

| Property   | Type                      | Description                    |
| ---------- | ------------------------- | ------------------------------ |
| `setupData` | `Record<string, unknown>` | Provider-specific setup response. Structure varies by method (see below). |

### Response Structure by Method

**TOTP Response:**
```typescript
{
  setupData: {
    secret: string;           // Base32-encoded TOTP secret
    qrCode: string;           // QR code as data URL (data:image/png;base64,...)
    manualEntryKey: string;   // Formatted secret for manual entry (e.g., 'ABCD EFGH IJKL MNOP')
    issuer: string;           // Issuer name from config
    accountName: string;      // Account name (typically user's email)
  }
}
```

**SMS Response:**
```typescript
// If phone already verified (auto-completed):
{
  setupData: {
    deviceId: number;
    autoCompleted: true;
  }
}
// If phone not verified (code sent):
{
  setupData: {
    maskedPhone: string;      // Masked phone number (e.g., '***-***-7890')
  }
}
```

**Email Response:**
```typescript
// If email already verified (auto-completed):
{
  setupData: {
    deviceId: number;
    autoCompleted: true;
  }
}
// If email not verified (code sent):
{
  setupData: {
    maskedEmail: string;      // Masked email address (e.g., 'u***r@example.com')
  }
}
```

**Passkey Response:**
```typescript
{
  setupData: {
    options: {
      challenge: string;
      rp: { name: string; id: string };
      user: { id: string; name: string; displayName: string };
      pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
      timeout: number;
      attestation: 'none' | 'indirect' | 'direct';
      authenticatorSelection?: {
        authenticatorAttachment?: 'platform' | 'cross-platform';
        requireResidentKey?: boolean;
        userVerification?: 'required' | 'preferred' | 'discouraged';
      };
      excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>;
    };
  }
}
```

## Example

**TOTP Setup:**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodName": "totp"
}
```

**Response:**
```json
{
  "setupData": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "manualEntryKey": "JBSW Y3DP EHPK 3PXP",
    "issuer": "MyApp",
    "accountName": "user@example.com"
  }
}
```

**SMS Setup:**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodName": "sms",
  "setupData": {
    "phoneNumber": "+1234567890",
    "deviceName": "My iPhone"
  }
}
```

**Response (phone not verified):**
```json
{
  "setupData": {
    "maskedPhone": "***-***-7890"
  }
}
```

**Response (phone already verified):**
```json
{
  "setupData": {
    "deviceId": 123,
    "autoCompleted": true
  }
}
```

**Email Setup:**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodName": "email",
  "setupData": {
    "email": "user@example.com",
    "deviceName": "My Email"
  }
}
```

**Response (email not verified):**
```json
{
  "setupData": {
    "maskedEmail": "u***r@example.com"
  }
}
```

**Passkey Setup:**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodName": "passkey"
}
```

**Response:**
```json
{
  "setupData": {
    "options": {
      "challenge": "base64-encoded-challenge",
      "rp": {
        "name": "MyApp",
        "id": "example.com"
      },
      "user": {
        "id": "base64-user-id",
        "name": "user@example.com",
        "displayName": "John Doe"
      },
      "pubKeyCredParams": [
        { "type": "public-key", "alg": -7 }
      ],
      "timeout": 60000,
      "attestation": "none"
    }
  }
}
```

## Used By

- [MFAService.setup()](../services/mfa-service#setup)

