---
title: ChallengeResponseData
description: Discriminated union types for challenge responses. TypeScript interfaces for type-safe challenge handling with method-specific structures.
keywords: [challenge, response, types, typescript, mfa, verification, api]
image: /img/api-social-card.png
sidebar_position: 32
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ChallengeResponseData

**Package:** `@nauth-toolkit/core`
**Type:** Type (TypeScript Interface)

Discriminated union types for responding to authentication challenges. Provides type-safe challenge handling.

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

## Types

Discriminated union of challenge response interfaces:

- `VerifyEmailResponse` - Email verification with code
- `CollectPhoneResponse` - Phone number collection (first step)
- `VerifyPhoneResponse` - Phone verification with code (second step)
- `VerifyMFACodeResponse` - MFA verification with code (SMS/TOTP/Backup)
- `VerifyMFAPasskeyResponse` - MFA verification with passkey
- `ForceChangePasswordResponse` - Forced password change
- `MFASetupResponse` - MFA setup during challenge

## Example

**Email Verification:**

```typescript
const response: ChallengeResponseData = {
  session: 'a21b654c-2746-4168-acee-c175083a65cd',
  type: 'VERIFY_EMAIL',
  code: '123456'
};
```

**MFA with Passkey:**

```typescript
const response: ChallengeResponseData = {
  session: 'a21b654c-2746-4168-acee-c175083a65cd',
  type: 'MFA_REQUIRED',
  method: 'passkey',
  credential: { id: '...', rawId: '...', response: {...} }
};
```

## Used By

- [AuthService.respondToChallenge()](../services/auth-service#respondtochallenge) - Accepts this type
