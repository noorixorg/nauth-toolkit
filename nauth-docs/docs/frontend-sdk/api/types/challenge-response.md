---
title: ChallengeResponse
description: Discriminated union for authentication challenge responses
keywords: [challenge, response, verification, mfa, api]
image: /img/api-social-card.png
---

# ChallengeResponse

**Package:** `@nauth-toolkit/client`
**Type:** Request (Discriminated Union)

Discriminated union type for responding to authentication challenges. Type depends on the challenge being completed.

```typescript
import { ChallengeResponse } from '@nauth-toolkit/client';
```

## Types

### VerifyEmailResponse

Email verification challenge response.

```typescript
{
  session: string;
  type: 'VERIFY_EMAIL';
  code: string; // 6-digit verification code
}
```

### VerifyPhoneCollectResponse

Phone number collection (first step of phone verification).

```typescript
{
  session: string;
  type: 'VERIFY_PHONE';
  phone: string; // E.164 format (e.g., '+14155551234')
}
```

### VerifyPhoneCodeResponse

Phone verification code (second step of phone verification).

```typescript
{
  session: string;
  type: 'VERIFY_PHONE';
  code: string; // 6-digit verification code
}
```

### MFACodeResponse

MFA code verification.

```typescript
{
  session: string;
  type: 'MFA_REQUIRED';
  method: 'sms' | 'email' | 'totp' | 'backup';
  code: string; // MFA code
}
```

### MFAPasskeyResponse

Passkey MFA verification.

```typescript
{
  session: string;
  type: 'MFA_REQUIRED';
  method: 'passkey';
  credential: Record<string, unknown>; // WebAuthn credential
}
```

### MFASetupResponse

MFA device setup completion.

```typescript
{
  session: string;
  type: 'MFA_SETUP_REQUIRED';
  method: 'sms' | 'email' | 'totp' | 'passkey';
  setupData: Record<string, unknown>; // Method-specific setup data
}
```

**Setup Data Structure by Method:**

- **TOTP**: `{ secret: string, code: string }` - Both `secret` (from `getSetupData`) and `code` (from user) are required
- **SMS**: `{ code: string }` or `{ deviceId: number }` (if auto-completed)
- **Email**: `{ code: string }` or `{ deviceId: number }` (if auto-completed)
- **Passkey**: `{ credential: Record<string, unknown> }` - WebAuthn credential from registration

### ForceChangePasswordResponse

Force password change.

```typescript
{
  session: string;
  type: 'FORCE_CHANGE_PASSWORD';
  newPassword: string; // New password meeting requirements
}
```

## Example

### Email Verification

```json
{
  "session": "challenge_session_token_xyz",
  "type": "VERIFY_EMAIL",
  "code": "123456"
}
```

### MFA Code

```json
{
  "session": "challenge_session_token_xyz",
  "type": "MFA_REQUIRED",
  "method": "totp",
  "code": "654321"
}
```

## Related Types

- [`AuthChallenge`](./auth-challenge) - Challenge type enum values
- [`AuthResponse`](./auth-response) - Response containing challenge data
- [`MFAMethod`](./mfa-method) - MFA method types
- [`GetSetupDataResponse`](./get-setup-data-response) - MFA setup data
- [`GetChallengeDataResponse`](./get-challenge-data-response) - Challenge data

## Used By

- [NAuthClient.respondToChallenge()](../nauth-client#respondtochallenge) - Accepts [`ChallengeResponse`](./challenge-response)
- [AuthService.respondToChallenge()](../../angular/auth-service#respondtochallenge) - Observable wrapper
- [Challenge Handling Guide](../../guides/challenge-handling) - Complete challenge flow guide
