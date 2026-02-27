---
title: ValidateAccessTokenResponseDTO
description: Response DTO for token validation operations. Contains validation result with decoded payload or error information.
keywords: [token, validate, response, jwt, payload, dto, api, authentication]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ValidateAccessTokenResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for JWT access token validation operations. Returns validation result with decoded payload or error information.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ValidateAccessTokenResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ValidateAccessTokenResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ValidateAccessTokenResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property    | Type                                             | Required | Description                                                                                         |
| ----------- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `error`     | `string`                                         | No       | Error message if validation failed. Examples: "Token expired", "Invalid token signature".          |
| `errorType` | `'expired' \| 'invalid' \| 'malformed' \| 'blacklisted'` | No       | Error type for programmatic handling. Only present when valid is false.                              |
| `payload`   | `JwtPayload`                                     | No       | Decoded JWT payload containing user and session information. Only present when valid is true.       |
| `valid`     | `boolean`                                        | Yes      | Whether the token is valid. If true, payload is present. If false, error and errorType are present. |

## JwtPayload Properties

| Property      | Type                     | Required | Description                                        |
| ------------- | ------------------------ | -------- | -------------------------------------------------- |
| `aud`         | `string \| string[]`     | No       | Audience claim                                     |
| `deviceId`    | `string`                 | No       | Device identifier                                  |
| `email`       | `string`                 | Yes      | User email address                                 |
| `exp`         | `number`                 | Yes      | Expiration timestamp (Unix epoch)                  |
| `iat`         | `number`                 | Yes      | Issued at timestamp (Unix epoch)                   |
| `iss`         | `string`                 | No       | Issuer claim                                       |
| `sessionId`   | `string`                 | Yes      | Session identifier                                 |
| `sub`         | `string`                 | Yes      | User ID (subject)                                  |
| `tokenFamily` | `string`                 | No       | Token family ID for rotation detection             |
| `type`        | `'access' \| 'refresh'`  | Yes      | Token type - always 'access' for access tokens     |

## Error Types

| Error Type    | Description                                               |
| ------------- | --------------------------------------------------------- |
| `expired`     | Token has expired (exp claim < current time)              |
| `invalid`     | Token signature verification failed or invalid format     |
| `malformed`   | Token structure is invalid (not a proper JWT)             |
| `blacklisted` | Token has been revoked or blacklisted                     |

## Examples

Valid token response:

```json
{
  "valid": true,
  "payload": {
    "sub": "a21b654c-2746-4168-acee-c175083a65cd",
    "email": "user@example.com",
    "type": "access",
    "sessionId": "session-uuid-123",
    "iat": 1704067200,
    "exp": 1704070800,
    "iss": "nauth-toolkit",
    "aud": "my-app"
  }
}
```

Invalid token response:

```json
{
  "valid": false,
  "error": "Token expired",
  "errorType": "expired"
}
```

## Used By

- [AuthService.validateAccessToken()](../services/auth-service#validateaccesstoken)


