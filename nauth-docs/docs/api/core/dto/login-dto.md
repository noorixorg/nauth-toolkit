---
title: LoginDTO
description: User login request DTO with email, username, or phone authentication support. Includes optional device tracking for session management.
keywords: [login, dto, authentication, request, email, username, phone, api]
image: /img/api-social-card.png
sidebar_position: 45
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LoginDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for user login requests. Supports email, username, or phone number as identifier.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LoginDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LoginDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LoginDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property     | Type                                | Required | Description                                                                                    |
| ------------ | ----------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `identifier` | `string`                            | Yes      | Email, username, or phone number. Auto-detects type. 1-255 characters.                         |
| `password`   | `string`                            | Yes      | User password. 1-128 characters. Not trimmed.                                                  |
| `deviceName` | `string`                            | No       | Human-readable device name (e.g., "John's iPhone"). Max 255 characters.                        |
| `deviceType` | `'mobile' \| 'desktop' \| 'tablet'` | No       | Device type for session categorization. Must be `mobile`, `desktop`, or `tablet`. Lowercased. |

## Example

```json
{
  "identifier": "user@example.com",
  "password": "SecurePass123!",
  "deviceName": "John's iPhone 15",
  "deviceType": "mobile"
}
```

## Used By

- [AuthService.login()](../services/auth-service#login)
