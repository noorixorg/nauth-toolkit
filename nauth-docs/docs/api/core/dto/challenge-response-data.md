---
title: ChallengeResponseData
description: Discriminated union type for challenge responses
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ChallengeResponseData

**Package:** `@nauth-toolkit/core`
**Type:** TypeScript Type (Union)

Discriminated union type for responding to authentication challenges. Different fields are required based on the challenge type.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ChallengeResponseData } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ChallengeResponseData } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ChallengeResponseData } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

`ChallengeResponseData` is a TypeScript discriminated union that provides type-safe challenge responses. It is used with `AuthService.respondToChallenge()` to handle various authentication challenges including email verification, phone verification, MFA, and password changes.

## Challenge Types

### VerifyEmailResponse

Used to respond to email verification challenges.

| Property  | Type             | Description                          |
| --------- | ---------------- | ------------------------------------ |
| `session` | `string`         | Challenge session token              |
| `type`    | `'VERIFY_EMAIL'` | Challenge type discriminator         |
| `code`    | `string`         | 6-digit verification code from email |

### CollectPhoneResponse

Used to submit phone number for verification.

| Property  | Type             | Description                  |
| --------- | ---------------- | ---------------------------- |
| `session` | `string`         | Challenge session token      |
| `type`    | `'VERIFY_PHONE'` | Challenge type discriminator |
| `phone`   | `string`         | Phone number in E.164 format |

### VerifyPhoneResponse

Used to verify phone with SMS code.

| Property  | Type             | Description                        |
| --------- | ---------------- | ---------------------------------- |
| `session` | `string`         | Challenge session token            |
| `type`    | `'VERIFY_PHONE'` | Challenge type discriminator       |
| `code`    | `string`         | 6-digit verification code from SMS |

### VerifyMFACodeResponse

Used for MFA verification with code (SMS/TOTP/Backup).

| Property   | Type                          | Description                                              |
| ---------- | ----------------------------- | -------------------------------------------------------- |
| `session`  | `string`                      | Challenge session token                                  |
| `type`     | `'MFA_REQUIRED'`              | Challenge type discriminator                             |
| `method`   | `'sms' \| 'totp' \| 'backup'` | MFA method type                                          |
| `code`     | `string`                      | Verification code                                        |
| `deviceId` | `number` (optional)           | Device ID for TOTP methods that support multiple devices |

### VerifyMFAPasskeyResponse

Used for MFA verification with passkey (WebAuthn).

| Property     | Type                      | Description                                                |
| ------------ | ------------------------- | ---------------------------------------------------------- |
| `session`    | `string`                  | Challenge session token                                    |
| `type`       | `'MFA_REQUIRED'`          | Challenge type discriminator                               |
| `method`     | `'passkey'`               | Passkey method                                             |
| `credential` | `Record<string, unknown>` | WebAuthn credential from browser API                       |
| `deviceId`   | `number` (optional)       | Device ID for passkey methods that support multiple devices |

### ForceChangePasswordResponse

Used when user must change their password.

| Property      | Type                      | Description                       |
| ------------- | ------------------------- | --------------------------------- |
| `session`     | `string`                  | Challenge session token           |
| `type`        | `'FORCE_CHANGE_PASSWORD'` | Challenge type discriminator      |
| `newPassword` | `string`                  | New password meeting requirements |

### MFASetupResponse

Used during MFA setup in challenge flow.

| Property    | Type                                      | Description                  |
| ----------- | ----------------------------------------- | ---------------------------- |
| `session`   | `string`                                  | Challenge session token      |
| `type`      | `'MFA_SETUP_REQUIRED'`                    | Challenge type discriminator |
| `method`    | `'sms' \| 'email' \| 'totp' \| 'passkey'` | MFA method being set up      |
| `setupData` | `Record<string, unknown>`                 | Method-specific setup data   |

**Setup Data Structure:**

- **SMS:** `{ phone: string, code: string }`
- **TOTP:** `{ code: string }`
- **Passkey:** `{ credential: Record<string, unknown> }`

## Usage Examples

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthService, ChallengeResponseData } from '@nauth-toolkit/nestjs';

// Email verification
const emailResponse: ChallengeResponseData = {
  session: 'challenge-session-token',
  type: 'VERIFY_EMAIL',
  code: '123456',
};
const result = await authService.respondToChallenge(emailResponse);

// Phone verification (two-step)
const phoneCollect: ChallengeResponseData = {
  session: 'session-token',
  type: 'VERIFY_PHONE',
  phone: '+14155552671',
};
await authService.respondToChallenge(phoneCollect);

const phoneVerify: ChallengeResponseData = {
  session: 'session-token',
  type: 'VERIFY_PHONE',
  code: '654321',
};
await authService.respondToChallenge(phoneVerify);

// MFA with TOTP
const mfaResponse: ChallengeResponseData = {
  session: 'session-token',
  type: 'MFA_REQUIRED',
  method: 'totp',
  code: '123456',
};
await authService.respondToChallenge(mfaResponse);

// Force password change
const passwordResponse: ChallengeResponseData = {
  session: 'session-token',
  type: 'FORCE_CHANGE_PASSWORD',
  newPassword: 'NewSecurePassword123!',
};
await authService.respondToChallenge(passwordResponse);
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { createNAuth } from '@nauth-toolkit/core';

const nauth = await createNAuth(config, dataSource);

// Email verification
const emailResponse = {
  session: req.body.session,
  type: 'VERIFY_EMAIL',
  code: req.body.code,
};
const result = await nauth.authService.respondToChallenge(emailResponse);

// MFA verification
const mfaResponse = {
  session: req.body.session,
  type: 'MFA_REQUIRED',
  method: req.body.method,
  code: req.body.code,
};
await nauth.authService.respondToChallenge(mfaResponse);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ChallengeResponseData } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Type-Safe Handling

TypeScript narrows the type based on discriminators:

```typescript
function handleChallengeResponse(response: ChallengeResponseData) {
  switch (response.type) {
    case 'VERIFY_EMAIL':
      // TypeScript knows response.code is available
      console.log(response.code);
      break;

    case 'MFA_REQUIRED':
      if (response.method === 'passkey') {
        // TypeScript knows response.credential is available
        console.log(response.credential);
      } else {
        // TypeScript knows response.code is available
        console.log(response.code);
      }
      break;

    case 'FORCE_CHANGE_PASSWORD':
      // TypeScript knows response.newPassword is available
      console.log(response.newPassword);
      break;
  }
}
```

## Related APIs

- [AuthService.respondToChallenge()](../services/auth-service#respondtochallenge) - Respond to challenges
- [RespondChallengeDTO](./respond-challenge-dto) - API validation DTO
- [AuthChallengeDTO](./auth-challenge-dto) - Challenge information
- [AuthResponseDTO](./auth-response-dto) - Response after challenge completion
