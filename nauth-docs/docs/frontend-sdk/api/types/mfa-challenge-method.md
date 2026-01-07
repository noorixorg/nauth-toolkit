---
title: MFAChallengeMethod
description: Type alias for MFA methods used in challenge flows
sidebar_position: 200
keywords: [mfa, challenge, method, type, api]
image: /img/api-social-card.png
---

# MFAChallengeMethod

**Package:** `@nauth-toolkit/client`
**Type:** Type Alias

Type alias for MFA methods that can be used during challenge verification flows.

```typescript
import { MFAChallengeMethod } from '@nauth-toolkit/client';
```

## Values

| Value       | Description                  |
| ----------- | ---------------------------- |
| `'passkey'` | WebAuthn/FIDO2 passkey       |
| `'sms'`     | SMS verification code        |
| `'email'`   | Email verification code      |
| `'totp'`    | Time-based One-Time Password |
| `'backup'`  | Backup codes                 |

## Example

```typescript
const method: MFAChallengeMethod = 'passkey';
const challengeData = await client.getChallengeData(session, method);
```

## Related Types

- [`MFAMethod`](./mfa-method) - All MFA methods (includes setup methods)
- [`GetChallengeDataResponse`](./get-challenge-data-response) - Challenge data response
- [`ChallengeResponse`](./challenge-response) - Challenge response union

## Used By

- [NAuthClient.getChallengeData()](../nauth-client#getchallengedata) - Accepts [`MFAChallengeMethod`](./mfa-challenge-method) parameter
