---
title: GetChallengeDataResponse
description: Response containing challenge-specific data for verification flows
keywords: [challenge, response, passkey, webauthn, verification, api]
image: /img/api-social-card.png
---

# GetChallengeDataResponse

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Response containing challenge-specific data returned by `getChallengeData()`.

```typescript
import { GetChallengeDataResponse } from '@nauth-toolkit/client';
```

## Properties

| Property        | Type                      | Required | Description                                          |
| --------------- | ------------------------- | -------- | ---------------------------------------------------- |
| `challengeData` | `Record<string, unknown>` | Yes      | Challenge-specific data. Structure varies by method. |

## Challenge Data by Method

| Method  | Structure                  | Description                                          |
| ------- | -------------------------- | ---------------------------------------------------- |
| Passkey | WebAuthn assertion options | WebAuthn credential request options for verification |
| TOTP    | Empty object or metadata   | May contain retry information                        |
| SMS     | `{ maskedPhone?: string }` | Masked phone number for verification                 |
| Email   | `{ maskedEmail?: string }` | Masked email for verification                        |

## Examples

**Passkey Challenge:**

```typescript
const challengeData = await client.getChallengeData(session, 'passkey');
// Use challengeData.challengeData with WebAuthn API
const credential = await navigator.credentials.get({
  publicKey: challengeData.challengeData as PublicKeyCredentialRequestOptions,
});
```

**Angular:**

```typescript
this.authService.getChallengeData(session, 'passkey').subscribe((response) => {
  // Handle WebAuthn challenge
  this.handlePasskeyChallenge(response.challengeData);
});
```

## Related Types

- [`ChallengeResponse`](./challenge-response) - Challenge response union
- [`AuthChallenge`](./auth-challenge) - Challenge types enum
- [`MFAMethod`](./mfa-method) - MFA method types

## Used By

- [NAuthClient.getChallengeData()](../nauth-client#getchallengedata) - Returns [`GetChallengeDataResponse`](./get-challenge-data-response)
- [Angular AuthService.getChallengeData()](../../angular/auth-service#getchallengedata) - Observable wrapper
- [Challenge Handling Guide](../../guides/challenge-handling) - Complete challenge flow guide
