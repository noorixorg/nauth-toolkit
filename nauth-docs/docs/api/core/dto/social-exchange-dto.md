---
title: SocialExchangeDTO
description: Request DTO for exchanging a social redirect exchange token into an AuthResponse
sidebar_position: 680
keywords: [dto, social, oauth, redirect, exchange, token, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SocialExchangeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for exchanging a short-lived exchange token (from redirect-first social login callback) into an [`AuthResponseDTO`](./auth-response-dto).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SocialExchangeDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SocialExchangeDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SocialExchangeDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `exchangeToken` | `string` | Yes | One-time exchange token from callback redirect URL. Max 500 characters. Trimmed. |

## Example

```json
{
  "exchangeToken": "a1b2c3d4e5f6..."
}
```

## Used By

- [`SocialRedirectHandler`](../services/social-auth-service) - Redirect-first social login handler

## Related

- [`StartSocialRedirectQueryDTO`](./start-social-redirect-query-dto) - Start redirect-first flow
- [`SocialCallbackQueryDTO`](./social-callback-query-dto) - OAuth callback query parameters
- [`SocialCallbackFormDTO`](./social-callback-form-dto) - OAuth callback form data (Apple)

