---
title: VerifyPhoneDTO
description: Phone verification DTO with E.164 format validation and 6-digit code verification. Includes strict input sanitization.
keywords: [verify, phone, dto, verification, code, e164, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyPhoneDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for phone verification with 6-digit code.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyPhoneWithCodeDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyPhoneWithCodeDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyPhoneWithCodeDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `phone`  | `string` | Yes      | Phone number. E.164 format (e.g., +14155552671). Max 20 characters. Whitespace removed. |
| `code`   | `string` | Yes      | Verification code. Exactly 6 digits. Numeric string. Trimmed.     |

## Example

```json
{
  "phone": "+14155552671",
  "code": "123456"
}
```

## Used By

- [PhoneVerificationService](../services/phone-verification-service) - Uses this DTO
