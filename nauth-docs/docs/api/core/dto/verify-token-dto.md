---
title: VerifyTokenDTO
description: Native mobile app token verification DTO with ID token, access token, and profile data. Used for Google Sign-In, Sign in with Apple, etc.
keywords: [token, verify, mobile, native, dto, request, google, apple, ios, android]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyTokenDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Token verification request for native mobile app authentication using provider SDKs.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyTokenDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                      | Required | Description                                                                               |
| ------------- | ------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `accessToken` | `string`                  | No       | Optional access token from native SDK. Max 2000 characters. Trimmed.                      |
| `idToken`     | `string`                  | Yes      | ID token from native SDK. Max 10000 characters. Trimmed.                                  |
| `profileData` | `Record<string, unknown>` | No       | Optional profile data from native SDK (e.g., Apple first-time signin). Must be an object. |

## Example

### Google Sign-In (iOS/Android)

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "accessToken": "ya29.a0AfH6SM..."
}
```

### Sign in with Apple (iOS)

```json
{
  "idToken": "eyJraWQiOiJlWGF1bm...",
  "profileData": {
    "name": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "email": "user@privaterelay.appleid.com"
  }
}
```

## Used By

- `BaseSocialAuthProviderService.verifyToken()` - Internal provider method
