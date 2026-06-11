---
title: HandleCallbackDTO
description: OAuth callback request DTO with authorization code and CSRF state. Used for processing social authentication callbacks.
keywords: [oauth, callback, social auth, dto, request, google, apple, facebook]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# HandleCallbackDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

OAuth callback request containing authorization code and CSRF state parameter.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { HandleCallbackDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { HandleCallbackDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { HandleCallbackDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                      | Required | Description                                                            |
| ------------- | ------------------------- | -------- | ---------------------------------------------------------------------- |
| `code`        | `string`                  | Yes      | Authorization code from OAuth callback. Max 2000 characters. Trimmed.  |
| `state`       | `string`                  | Yes      | CSRF state parameter from OAuth callback. Max 500 characters. Trimmed. |
| `profileData` | `Record<string, unknown>` | No       | Optional profile data from OAuth callback. Used by providers like Apple that send user data directly in the callback (first sign-in only). |

## Example

```json
{
  "code": "4/0AQlEd8y...",
  "state": "random-csrf-state-123"
}
```

**Apple callback with profile data (first sign-in only):**

```json
{
  "code": "abc123...",
  "state": "csrf-state-xyz",
  "profileData": {
    "name": { "firstName": "John", "lastName": "Doe" },
    "email": "user@privaterelay.appleid.com"
  }
}
```

## Used By

- `BaseSocialAuthProviderService.handleCallback()` - Internal provider method
- `BaseSocialAuthProviderService.getUserProfileFromCallback()` - Internal provider method
