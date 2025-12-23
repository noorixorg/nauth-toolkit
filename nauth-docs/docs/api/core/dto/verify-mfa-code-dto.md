---
title: VerifyMFACodeDTO
description: Request and response DTOs for verifying MFA code. Supports TOTP, SMS, Email, Passkey, and Backup codes with optional device ID.
keywords: [mfa, verify, code, dto, request, response, totp, sms, passkey, api]
image: /img/api-social-card.png
sidebar_position: 83
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyMFACodeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for verifying MFA code using the appropriate provider.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyMFACodeDTO, VerifyMFACodeResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyMFACodeDTO, VerifyMFACodeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyMFACodeDTO, VerifyMFACodeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## VerifyMFACodeDTO (Request)

| Property    | Type                      | Required | Description                                                      |
| ----------- | ------------------------- | -------- | ---------------------------------------------------------------- |
| `sub`       | `string`                  | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |
| `methodName` | `string`                  | Yes      | MFA method name. Must be: totp, sms, email, passkey, backup. Max 50 characters. Trimmed and lowercased. |
| `code`      | `string \| Record<string, unknown>` | Yes      | Verification code or credential. For TOTP/SMS/Email/Backup: string code. For Passkey: credential object. |
| `deviceId`  | `number`                  | No       | Optional device ID. Must be positive integer if provided.        |

## VerifyMFACodeResponseDTO (Response)

| Property | Type      | Description                    |
| -------- | --------- | ------------------------------ |
| `valid`  | `boolean` | True if verification succeeds. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "methodName": "totp",
  "code": "123456"
}
```

**Response:**

```json
{
  "valid": true
}
```

## Used By

- [MFAService.verifyCode()](../services/mfa-service#verifycode)

