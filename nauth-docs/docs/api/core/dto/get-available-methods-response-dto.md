---
title: GetAvailableMethodsResponseDTO
description: Response DTO listing the MFA methods registered and permitted by configuration, which a user may set up.
keywords: [mfa, methods, available, dto, response, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetAvailableMethodsResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

The MFA methods this deployment permits, whether or not the caller has enrolled them.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetAvailableMethodsResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetAvailableMethodsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetAvailableMethodsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property           | Type       | Required | Description                                                                             |
| ------------------ | ---------- | -------- | --------------------------------------------------------------------------------------- |
| `availableMethods` | `string[]` | Yes      | Method names registered as providers and allowed by configuration. Derived from configuration, so identical for every user. |

## Example

```json
{
  "availableMethods": ["totp", "sms", "passkey", "email"]
}
```

## Used By

- [MFAService.getAvailableMethods()](../services/mfa-service#getavailablemethods)
