---
title: AdminSignupSocialResponseDTO
description: Response DTO for administrative social user import containing user object and social account confirmation
keywords: [dto, response, admin, social]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminSignupSocialResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response for administrative social user import containing the created user object and social account linkage confirmation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminSignupSocialResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminSignupSocialResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminSignupSocialResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Description |
| -------- | ---- | ----------- |
| `socialAccount` | `{ provider: string; providerId: string; providerEmail: string \| null }` | Social account linkage confirmation. |
| `user` | [`UserResponseDTO`](./user-response-dto) | Created user object (sanitized, excludes sensitive fields). |

## Example

```json
{
  "user": {
    "sub": "user-uuid-123",
    "email": "user@example.com",
    "isEmailVerified": true,
    "hasSocialAuth": true,
    "socialProviders": ["google"]
  },
  "socialAccount": {
    "provider": "google",
    "providerId": "google_12345",
    "providerEmail": "user@gmail.com"
  }
}
```

## Related

- [`AdminAuthService.signupSocial()`](../services/admin-auth-service#signupsocial) - Returns this DTO
- [`AdminSignupSocialDTO`](./admin-signup-social-dto) - Request DTO

