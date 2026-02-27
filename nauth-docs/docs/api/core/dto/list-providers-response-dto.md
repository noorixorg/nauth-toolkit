---
title: ListProvidersResponseDTO
description: Response DTO for listing all registered MFA provider method names. Returns array of available provider names.
keywords: [mfa, providers, list, dto, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ListProvidersResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for listing all registered MFA provider method names.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ListProvidersResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ListProvidersResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ListProvidersResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type       | Description                    |
| ---------- | ---------- | ------------------------------ |
| `providers` | `string[]` | Array of registered provider method names. |

## Example

```json
{
  "providers": ["totp", "sms", "passkey", "email"]
}
```

## Used By

- [MFAService.listProviders()](../services/mfa-service#listproviders)

