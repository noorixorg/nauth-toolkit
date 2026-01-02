---
title: ErrorResponseDTO
description: Standardized error response DTO with error code, message, details, and timestamp. Used for all authentication error responses.
keywords: [error, response, dto, exception, api]
image: /img/api-social-card.png
sidebar_position: 200
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ErrorResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Standardized error response format for all nauth-toolkit errors.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ErrorResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ErrorResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ErrorResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property     | Type                      | Required | Description                                                      |
| ------------ | ------------------------- | -------- | ---------------------------------------------------------------- |
| `statusCode` | `number`                  | Yes      | HTTP status code (100-599).                                       |
| `code`       | `string`                  | Yes      | Error code. Uppercase letters, numbers, underscores only. Max 100 characters. |
| `message`    | `string`                  | Yes      | Human-readable error message. Max 500 characters.                |
| `details`    | `Record<string, unknown>` | No       | Additional error metadata (retryAfter, field names, etc.).        |
| `timestamp`  | `string`                  | Yes      | ISO 8601 timestamp when error occurred.                           |
| `path`       | `string`                  | No       | Request path where error occurred. Max 500 characters.            |

## Example

```json
{
  "statusCode": 429,
  "code": "RATE_LIMIT_SMS",
  "message": "Too many verification SMS sent. Please try again later.",
  "details": {
    "retryAfter": 3600,
    "currentCount": 4,
    "maxAttempts": 3
  },
  "timestamp": "2025-10-31T01:43:03.132Z",
  "path": "/auth/verify-phone/send"
}
```

## Used By

- Framework adapters convert [NAuthException](../exceptions/nauth-exception) to this format
