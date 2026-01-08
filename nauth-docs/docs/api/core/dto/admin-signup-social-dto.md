---
title: AdminSignupSocialDTO
description: Administrative social user import DTO for migrating users from external platforms with social account linkage
keywords: [dto, admin, social, import, migration, cognito]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminSignupSocialDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Administrative social user import with override capabilities for migrating users from external platforms (e.g., Cognito, Auth0) while preserving social login connections.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminSignupSocialDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminSignupSocialDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminSignupSocialDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `email` | `string` | Yes | User email address. Valid email format, max 255 chars. Trimmed and lowercased. Automatically verified for social imports (like normal social signup). |
| `firstName` | `string` | No | First name. 1-100 chars. Letters, spaces, hyphens, apostrophes only. |
| `isPhoneVerified` | `boolean` | No | Bypass phone verification. Default: false. |
| `lastName` | `string` | No | Last name. 1-100 chars. Letters, spaces, hyphens, apostrophes only. |
| `metadata` | `Record<string, unknown>` | No | Custom user metadata. |
| `mustChangePassword` | `boolean` | No | Force password change on first login. Only relevant if password provided. Default: false. |
| `password` | `string` | No | Optional password for hybrid social+password accounts. Min 8, max 128 chars. Policy enforced. |
| `phone` | `string` | No | Phone number in E.164 format (e.g., +14155552671). Max 20 chars. |
| `provider` | `'google' \| 'apple' \| 'facebook'` | Yes | Social provider name. |
| `providerEmail` | `string` | No | Email from provider's OAuth profile. Max 255 chars. Used for audit/debugging. |
| `providerId` | `string` | Yes | Provider's unique user ID. Max 255 chars. Must be unique per provider. |
| `socialMetadata` | `Record<string, unknown>` | No | Raw OAuth profile data from provider. Stored for debugging/audit. |
| `username` | `string` | No | Username. 3-255 chars. Alphanumeric, underscores, hyphens only. |

## Example

```json
{
  "email": "user@example.com",
  "provider": "google",
  "providerId": "google_12345",
  "providerEmail": "user@gmail.com",
  "socialMetadata": {
    "sub": "google_12345",
    "given_name": "John",
    "picture": "https://..."
  }
}
```

:::note Email Verification
Email is automatically verified for all social imports (like normal social signup). The `isEmailVerified` field is not required and is not part of the DTO.
:::

## Response

[`AdminSignupSocialResponseDTO`](./admin-signup-social-response-dto)

## Related

- [`AuthService.adminSignupSocial()`](../services/auth-service#adminsignupsocial) - Uses this DTO
- [`AdminSignupDTO`](./admin-signup-dto) - For password-only admin signup

