---
title: SetPhoneAndSendVerificationResponseDTO
description: Response DTO for setPhoneAndSendVerification. Returns the verification token ID and whether the phone on file was replaced.
keywords: [phone, verification, sms, dto, response, token, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SetPhoneAndSendVerificationResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for the set-phone-and-send-verification operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetPhoneAndSendVerificationResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetPhoneAndSendVerificationResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetPhoneAndSendVerificationResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property       | Type      | Required | Description                                                                   |
| -------------- | --------- | -------- | ----------------------------------------------------------------------------- |
| `phoneChanged` | `boolean` | Yes      | `true` when the phone on file was replaced and its verification was reset.    |
| `tokenId`      | `number`  | Yes      | Verification token ID (internal use)                                          |

## Example

```json
{
  "tokenId": 12345,
  "phoneChanged": true
}
```

## Used By

- [PhoneVerificationService.setPhoneAndSendVerification()](../services/phone-verification-service#setphoneandsendverification)
