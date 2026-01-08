---
title: VerifyPhoneBySubDTO
description: Phone verification DTO using user sub and 6-digit code. Used when allowing duplicate phone numbers across users.
keywords: [verify, phone, sub, dto, verification, code, uuid, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyPhoneBySubDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for phone verification using user identifier and verification code.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyPhoneWithCodeBySubDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyPhoneWithCodeBySubDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyPhoneWithCodeBySubDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User identifier. UUID v4 format. Trimmed and lowercased.          |
| `code`   | `string` | Yes      | Verification code. Exactly 6 digits. Numeric string.             |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "code": "123456"
}
```

## Used By

- [PhoneVerificationService](../services/phone-verification-service) - Uses this DTO
