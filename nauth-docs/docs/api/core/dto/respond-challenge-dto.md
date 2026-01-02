---
title: RespondChallengeDTO
description: Unified challenge response DTO with conditional validation for email verification, phone verification, MFA, and password change challenges.
keywords: [challenge, response, dto, mfa, verification, password, api]
image: /img/api-social-card.png
sidebar_position: 710
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RespondChallengeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Unified data transfer object for responding to all authentication challenges with conditional validation based on challenge type.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RespondChallengeDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RespondChallengeDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RespondChallengeDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                                | Required | Description                                                                                    |
| ------------- | ----------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `session`     | `string`                            | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased.                                |
| `type`        | `ChallengeType`                     | Yes      | Challenge type. Must be: VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, FORCE_CHANGE_PASSWORD, MFA_SETUP_REQUIRED. |
| `code`        | `string`                            | Conditional | Verification code. 4-10 alphanumeric characters. Required for VERIFY_EMAIL, VERIFY_PHONE (with code), MFA_REQUIRED (non-passkey). |
| `phone`       | `string`                            | Conditional | Phone number. E.164 format. Required for VERIFY_PHONE (phone collection/update step). Max 20 characters. When provided, updates the user's phone number and sends verification SMS. |
| `newPassword` | `string`                            | Conditional | New password. 8-128 characters. Required for FORCE_CHANGE_PASSWORD. Not trimmed.              |
| `method`      | `MFAMethodType`                     | Conditional | MFA method. Must be: sms, email, totp, passkey, backup. Required for MFA_REQUIRED and MFA_SETUP_REQUIRED. |
| `credential`  | `Record<string, unknown>`           | Conditional | Passkey credential object. Required for MFA_REQUIRED when method is passkey.                   |
| `setupData`   | `Record<string, unknown>`           | Conditional | MFA setup data. Required for MFA_SETUP_REQUIRED. Method-specific structure.                    |

## Example

**Email Verification:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "VERIFY_EMAIL",
  "code": "123456"
}
```

**Phone Verification (Collection/Update):**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "VERIFY_PHONE",
  "phone": "+14155551234"
}
```

**Note**: The `phone` field can be used to:
- Collect a phone number when user has none (e.g., social signup)
- Update an existing phone number if user entered wrong number during signup

After submitting phone, backend sends verification SMS and returns the same challenge for code verification.

**Phone Verification (Code):**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "VERIFY_PHONE",
  "code": "123456"
}
```

**MFA Verification:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_REQUIRED",
  "method": "totp",
  "code": "123456"
}
```

**Password Change:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "FORCE_CHANGE_PASSWORD",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [AuthService.respondToChallenge()](../services/auth-service#respondtochallenge)
