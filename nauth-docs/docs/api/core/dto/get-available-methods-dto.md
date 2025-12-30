---
title: GetAvailableMethodsDTO
description: Request and response DTOs for retrieving available MFA methods that can be set up for a user. Returns array of registered provider method names.
keywords: [mfa, methods, available, dto, request, response, api]
image: /img/api-social-card.png
sidebar_position: 480
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetAvailableMethodsDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for getting available MFA methods that can be set up for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetAvailableMethodsDTO, GetAvailableMethodsResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetAvailableMethodsDTO, GetAvailableMethodsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetAvailableMethodsDTO, GetAvailableMethodsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## GetAvailableMethodsDTO (Request)

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `sub`    | `string` | Yes      | User sub. UUID v4 format. Trimmed and lowercased.               |

## GetAvailableMethodsResponseDTO (Response)

| Property          | Type       | Description                           |
| ----------------- | ---------- | ------------------------------------- |
| `availableMethods` | `string[]` | Array of available method names.       |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

**Response:**

```json
{
  "availableMethods": ["totp", "sms", "passkey", "email"]
}
```

## Used By

- [MFAService.getAvailableMethods()](../services/mfa-service#getavailablemethods)

