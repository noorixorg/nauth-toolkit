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

| Value                   | Description                          | When Returned                                                         |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `VERIFY_EMAIL`          | Email verification required          | After signup/login when email not verified                            |
| `VERIFY_PHONE`          | Phone verification required          | After signup/login when phone not verified or phone collection needed |
| `MFA_REQUIRED`          | Multi-factor authentication required | After successful credentials when MFA enabled for user                |
| `MFA_SETUP_REQUIRED`    | MFA device setup required            | When MFA enforcement requires user to configure first device          |
| `FORCE_CHANGE_PASSWORD` | Password change required             | After admin reset or policy requires password update                  |

## Challenge Parameters

Each challenge type includes specific parameters in [`AuthResponse.challengeParameters`](./auth-response):

| Challenge               | Parameters                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `VERIFY_EMAIL`          | `codeDeliveryDestination` (masked email), `instructions`                            |
| `VERIFY_PHONE`          | `codeDeliveryDestination` (masked phone), `requiresPhoneCollection`, `instructions` |
| `MFA_REQUIRED`          | `preferredMethod`, `availableMethods`, `maskedPhone`, `maskedEmail`, `instructions` |
| `MFA_SETUP_REQUIRED`    | `allowedMethods`, `instructions`                                                    |
| `FORCE_CHANGE_PASSWORD` | `instructions`                                                                      |

See [Challenge Handling Guide](../../guides/challenge-handling) for detailed parameter usage.

## Example

```typescript
import { AuthChallenge } from '@nauth-toolkit/client';

// Check challenge type
if (response.challengeName === AuthChallenge.VERIFY_EMAIL) {
  // Navigate to email verification page
  router.navigate(['/verify-email']);
} else if (response.challengeName === AuthChallenge.MFA_REQUIRED) {
  // Check MFA method from parameters
  const method = response.challengeParameters?.preferredMethod;
  if (method === 'passkey') {
    router.navigate(['/mfa/passkey']);
  } else {
    router.navigate(['/mfa']);
  }
}
```

## Navigation Patterns

The SDK supports automatic navigation to challenge routes. See [Challenge Handling Guide](../../guides/challenge-handling) for all patterns:

- **Separate Routes** - `/auth/challenge/verify-email`, `/auth/challenge/mfa-required`
- **Single Route** - `/auth/challenge?challenge=VERIFY_EMAIL`
- **Custom Routes** - Map each challenge to custom URLs
- **Dialog-Based** - Handle challenges without navigation

See [`NAuthClientConfig.redirects`](../nauth-client-config#redirect-urls) for configuration.

## Related Types

- [`AuthResponse`](./auth-response) - Contains [`AuthChallenge`](./auth-challenge) in `challengeName` property
- [`ChallengeResponse`](./challenge-response) - Uses [`AuthChallenge`](./auth-challenge) values in `type` property

## Used By

- [AuthResponse](./auth-response) - `challengeName` property uses [`AuthChallenge`](./auth-challenge) enum
- [ChallengeResponse](./challenge-response) - `type` property uses [`AuthChallenge`](./auth-challenge) enum values
- [NAuthClient.respondToChallenge()](../nauth-client#respondtochallenge) - Accepts [`ChallengeResponse`](./challenge-response) with [`AuthChallenge`](./auth-challenge) type
- [Challenge Handling Guide](../../guides/challenge-handling) - Complete challenge flow guide
