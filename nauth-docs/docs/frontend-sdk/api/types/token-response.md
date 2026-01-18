---
title: TokenResponse
description: Access and refresh token response from token refresh operations
keywords: [token, refresh, response, api]
image: /img/api-social-card.png
---

# TokenResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response from token refresh operations containing new access and refresh tokens with expiry timestamps.

```typescript
import { TokenResponse } from '@nauth-toolkit/client';
```

## Properties

| Property                | Type     | Description                                               |
| ----------------------- | -------- | --------------------------------------------------------- |
| `accessToken`           | `string` | New access token (JWT)                                    |
| `refreshToken`          | `string` | New refresh token (JWT)                                   |
| `accessTokenExpiresAt`  | `number` | Access token expiry timestamp (milliseconds since epoch)  |
| `refreshTokenExpiresAt` | `number` | Refresh token expiry timestamp (milliseconds since epoch) |

## Example

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresAt": 1704067200000,
  "refreshTokenExpiresAt": 1704153600000
}
```

## Related Types

- [`AuthResponse`](./auth-response) - Contains tokens on successful authentication
- [`NAuthClientConfig`](../nauth-client-config) - Token delivery configuration

## Used By

- [NAuthClient.refreshTokens()](../nauth-client#refreshtokens) - Returns [`TokenResponse`](./token-response)
- [Token Management](../../token-management) - Token refresh strategy guide
- [Angular Interceptor](../../angular/interceptor) - Automatic token refresh
