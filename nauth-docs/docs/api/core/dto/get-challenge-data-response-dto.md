---
title: GetChallengeDataResponseDTO
description: Response DTO for MFA challenge data. Currently only used for passkey method to return WebAuthn public key options.
keywords: [mfa, challenge, data, response, dto, passkey, webauthn, api]
image: /img/api-social-card.png
sidebar_position: 240
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetChallengeDataResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for MFA challenge data (currently only for passkey/WebAuthn).

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

| Property       | Type                      | Description                    |
| -------------- | ------------------------- | ------------------------------ |
| `challengeData` | `Record<string, unknown>` | Provider-specific challenge data. For passkey: WebAuthn public key options with structure containing publicKey object with challenge, allowCredentials array, and other WebAuthn options. |

## Example

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

## Used By

- [MFAService.getChallengeData()](../services/mfa-service#getchallengedata)

