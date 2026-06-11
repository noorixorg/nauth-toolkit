---
title: HasProviderDTO
description: Request and response DTOs for checking if an MFA provider is registered. Returns boolean indicating provider availability.
keywords: [mfa, provider, check, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# HasProviderDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for checking if an MFA provider is registered.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { HasProviderDTO, HasProviderResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { HasProviderDTO, HasProviderResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { HasProviderDTO, HasProviderResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## HasProviderDTO (Request)

| Property    | Type     | Required | Description                                                      |
| ----------- | -------- | -------- | ---------------------------------------------------------------- |
| `methodName` | `string` | Yes      | Provider method name. Must be: totp, sms, email, passkey. Max 50 characters. Trimmed and lowercased. |

## HasProviderResponseDTO (Response)

| Property     | Type      | Description                    |
| ------------ | --------- | ------------------------------ |
| `hasProvider` | `boolean` | True if provider exists.        |

## Example

```json
{
  "methodName": "totp"
}
```

**Response:**

```json
{
  "hasProvider": true
}
```

## Used By

- [MFAService.hasProvider()](../services/mfa-service#hasprovider)

