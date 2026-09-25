---
title: SetPhoneAndSendVerificationDTO
description: Request DTO that saves a phone number on a user (by sub), resets its verification, and sends the verification SMS. Used by VERIFY_PHONE collection and SMS MFA setup.
keywords: [phone, verification, sms, dto, request, collect, change, mfa, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetPhoneAndSendVerificationDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for saving a phone number on a user and sending the verification SMS in one step.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetPhoneAndSendVerificationDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetPhoneAndSendVerificationDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetPhoneAndSendVerificationDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property             | Type     | Required | Description                                                                                                   |
| -------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `challengeSessionId` | `number` | No       | Challenge session ID to link the verification token to. Positive integer.                                     |
| `phone`              | `string` | Yes      | Phone number in E.164 format (`+14155552671`). Whitespace removed. Max 20 characters. Replaces the phone on file when different. |
| `sub`                | `string` | Yes      | User identifier (UUID v4). Trimmed and lowercased.                                                            |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "phone": "+14155552671",
  "challengeSessionId": 42
}
```

## Used By

- [PhoneVerificationService.setPhoneAndSendVerification()](../services/phone-verification-service#setphoneandsendverification)
