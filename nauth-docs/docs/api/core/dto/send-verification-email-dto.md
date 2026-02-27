---
title: SendVerificationEmailDTO
description: Request DTO for sending email verification codes. Includes user identifier, optional base URL for verification links, and skip flag for MFA contexts.
keywords: [email, verification, dto, request, send, code, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SendVerificationEmailDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for sending verification emails with codes and optional verification links.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SendVerificationEmailDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SendVerificationEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SendVerificationEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property                    | Type      | Required | Description                                                                                    |
| --------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------- |
| `sub`                       | `string`  | Yes      | User identifier (UUID v4). Trimmed and lowercased.                                             |
| `baseUrl`                   | `string`  | No       | Base URL for verification link. Must be valid URL with http:// or https://. Max 2048 chars.    |
| `skipAlreadyVerifiedCheck` | `boolean` | No       | Skip "already verified" check. Used for MFA contexts where codes needed even if email verified. |
| `challengeSessionId`        | `number`  | No       | Challenge session ID to link this verification to. Prevents old tokens from being used with new sessions. |
| `challengeSessionToken`     | `string`  | No       | Challenge session token (UUID v4). Included in verification link for cross-browser verification. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "baseUrl": "https://example.com",
  "skipAlreadyVerifiedCheck": false,
  "challengeSessionId": 42,
  "challengeSessionToken": "b32c765d-3857-5279-bdff-d286194b76de"
}
```

## Used By

- [EmailVerificationService.sendVerificationEmail()](../services/email-verification-service#sendverificationemail)

