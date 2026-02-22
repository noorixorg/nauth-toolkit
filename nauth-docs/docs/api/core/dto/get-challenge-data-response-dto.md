---
title: GetChallengeDataResponseDTO
description: Response DTO for MFA challenge data. Shape varies by MFA method — passkey returns WebAuthn options, SMS returns a masked phone string, email returns a masked email string.
keywords: [mfa, challenge, data, response, dto, passkey, sms, email, webauthn, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetChallengeDataResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for MFA challenge data. The shape of `challengeData` varies by MFA method.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetChallengeDataResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetChallengeDataResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetChallengeDataResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property        | Type                      | Description                                                                                       |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `challengeData` | `Record<string, unknown>` | Method-specific challenge data. Shape varies by MFA method — see below. |

## `challengeData` shape by method

| Method    | Shape                     | Description                                                          |
| --------- | ------------------------- | -------------------------------------------------------------------- |
| `passkey` | `Record<string, unknown>` | WebAuthn public key options object (`{ publicKey: { challenge, allowCredentials, rpId, ... } }`) |
| `sms`     | `string`                  | Masked phone number (e.g., `***-***-1234`)                          |
| `email`   | `string`                  | Masked email address (e.g., `u***r@example.com`)                    |

Use `typeof challengeData === 'string'` to distinguish SMS/email from passkey on the client.

## Examples

**Passkey**

```json
{
  "challengeData": {
    "publicKey": {
      "challenge": "base64url-encoded-challenge",
      "allowCredentials": [],
      "rpId": "example.com",
      "userVerification": "preferred"
    }
  }
}
```

**SMS / Email**

```json
{
  "challengeData": "***-***-1234"
}
```

## Used By

- [MFAService.getChallengeData()](../services/mfa-service#getchallengedata)

