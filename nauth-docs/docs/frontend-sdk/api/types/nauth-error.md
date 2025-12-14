---
title: NAuthError
description: Interface for structured authentication errors
sidebar_position: 200
keywords: [error, interface, api]
image: /img/api-social-card.png
---

# NAuthError

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Interface for structured authentication errors returned by the SDK. Implemented by [`NAuthClientError`](../nauth-client-error).

```typescript
import { NAuthError } from '@nauth-toolkit/client';
```

## Properties

| Property     | Type                                   | Required | Description                      |
| ------------ | -------------------------------------- | -------- | -------------------------------- |
| `code`       | [`NAuthErrorCode`](./nauth-error-code) | Yes      | Standardized error code          |
| `message`    | `string`                               | Yes      | Human-readable error message     |
| `details`    | `Record<string, unknown>`              | No       | Additional error details         |
| `timestamp`  | `string`                               | No       | Error timestamp (ISO 8601)       |
| `statusCode` | `number`                               | No       | HTTP status code (if applicable) |

## Example

```json
{
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "statusCode": 401
}
```

## Used By

- [NAuthClientError](../nauth-client-error) - Implements [`NAuthError`](./nauth-error) interface

## Related Types

- [`NAuthErrorCode`](./nauth-error-code) - Error code enum
- [`NAuthClientError`](../nauth-client-error) - Error class implementation
