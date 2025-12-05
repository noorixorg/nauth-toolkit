---
title: VerifyPhoneResponseDTO
description: Response DTO for phone verification operations. Returns success message confirming phone verification.
keywords: [phone, verification, dto, response, success, api]
image: /img/api-social-card.png
sidebar_position: 24
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyPhoneResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for phone verification operations (code-based).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyPhoneResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyPhoneResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyPhoneResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description              |
| --------- | -------- | -------- | ------------------------ |
| `message` | `string` | Yes      | Success message          |

## Example

```json
{
  "message": "Phone verified successfully. Please log in to continue."
}
```

## Used By

- [PhoneVerificationService.verifyPhoneWithCode()](../services/phone-verification-service#verifyphonewithcode)
- [PhoneVerificationService.verifyPhoneWithCodeBySub()](../services/phone-verification-service#verifyphonewithcodebysub)

