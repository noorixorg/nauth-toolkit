---
title: GetChallengeDataDTO
description: Request DTO for MFA challenge data retrieval. Currently only supports passkey method for WebAuthn challenge options.
keywords: [mfa, challenge, data, dto, request, passkey, webauthn, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetChallengeDataDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for requesting MFA challenge data (currently only for passkey/WebAuthn).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetChallengeDataDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetChallengeDataDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetChallengeDataDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type                 | Required | Description                                                      |
| --------- | -------------------- | -------- | ---------------------------------------------------------------- |
| `session` | `string`             | Yes      | Challenge session token. UUID v4 format. Trimmed and lowercased. |
| `method`  | `MFAChallengeMethod` | Yes      | MFA method. Must be: passkey.                                   |

## Example

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "method": "passkey"
}
```

## Used By

- [MFAService.getChallengeData()](../services/mfa-service#getchallengedata)
