---
title: SignupDTO
description: User registration DTO with email, password, optional username, phone, and profile fields. Includes comprehensive validation and input sanitization.
keywords: [signup, registration, dto, authentication, request, email, password, username, phone, api]
image: /img/api-social-card.png
sidebar_position: 80
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SignupDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer object for user registration with comprehensive validation and optional profile fields.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SignupDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SignupDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SignupDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type                      | Required | Description                                                                                    |
| ---------- | ------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `email`    | `string`                  | Yes      | User email address. Valid email format. Max 255 characters. Trimmed and lowercased.           |
| `password` | `string`                  | Yes      | User password. 8-128 characters. Not trimmed.                                                  |
| `username` | `string`                  | No       | Username. 3-255 characters. Alphanumeric, underscores, hyphens only. Trimmed and lowercased.   |
| `firstName` | `string`                  | No       | First name. 1-100 characters. Letters, spaces, hyphens, apostrophes only. Trimmed.             |
| `lastName` | `string`                  | No       | Last name. 1-100 characters. Letters, spaces, hyphens, apostrophes only. Trimmed.               |
| `phone`    | `string`                  | No       | Phone number. E.164 format (e.g., +14155552671). Max 20 characters. Whitespace removed.      |
| `metadata` | `Record<string, unknown>` | No       | Custom metadata fields. Validated in service layer.                                           |

## Example

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155552671"
}
```

## Used By

- [AuthService.signup()](../services/auth-service#signup)
