---
title: AuthChallenge
description: Enum of authentication challenge types
sidebar_position: 50
keywords: [challenge, enum, authentication, verification, api]
image: /img/api-social-card.png
---

# AuthChallenge

**Package:** `@nauth-toolkit/client`
**Type:** Enum

Enumeration of challenge types returned by the backend when authentication requires additional verification steps.

```typescript
import { AuthChallenge } from '@nauth-toolkit/client';
```

## Values

| Value                   | Description                          |
| ----------------------- | ------------------------------------ |
| `VERIFY_EMAIL`          | Email verification required          |
| `VERIFY_PHONE`          | Phone verification required          |
| `MFA_REQUIRED`          | Multi-factor authentication required |
| `MFA_SETUP_REQUIRED`    | MFA device setup required            |
| `FORCE_CHANGE_PASSWORD` | Password change required             |

## Example

```typescript
if (response.challengeName === AuthChallenge.VERIFY_EMAIL) {
  // Navigate to email verification page
} else if (response.challengeName === AuthChallenge.MFA_REQUIRED) {
  // Navigate to MFA verification page
}
```

## Related Types

- [`AuthResponse`](./auth-response) - Contains [`AuthChallenge`](./auth-challenge) in `challengeName` property
- [`ChallengeResponse`](./challenge-response) - Uses [`AuthChallenge`](./auth-challenge) values in `type` property

## Used By

- [AuthResponse](./auth-response) - `challengeName` property uses [`AuthChallenge`](./auth-challenge) enum
- [ChallengeResponse](./challenge-response) - `type` property uses [`AuthChallenge`](./auth-challenge) enum values
- [NAuthClient.respondToChallenge()](../nauth-client#respondtochallenge) - Accepts [`ChallengeResponse`](./challenge-response) with [`AuthChallenge`](./auth-challenge) type
- [Challenge Handling Guide](../../guides/challenge-handling) - Complete challenge flow guide
