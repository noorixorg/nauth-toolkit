---
title: NAuthHttpExceptionFilter
description: NestJS exception filter for NAuthException handling
keywords: [nestjs, filter, exception, error, api]
image: /img/api-social-card.png
---
# NAuthHttpExceptionFilter

**Package:** `@nauth-toolkit/nestjs`
**Type:** NestJS Exception Filter

Maps `NAuthException` to HTTP responses with appropriate status codes.

## Import

```typescript
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';
```

## Usage

### Global Registration

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: NAuthHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
```

### Controller-Level

```typescript
import { Controller, UseFilters } from '@nestjs/common';
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';

@Controller('auth')
@UseFilters(NAuthHttpExceptionFilter)
export class AuthController {}
```

## Response Format

```json
{
  "statusCode": 429,
  "code": "RATE_LIMIT_SMS",
  "message": "Too many verification SMS sent",
  "details": {
    "retryAfter": 3600,
    "currentCount": 4
  },
  "timestamp": "2025-10-31T12:00:00.000Z",
  "path": "/auth/verify-phone"
}
```

## Status Code Mapping

Status codes are determined by `getHttpStatusForErrorCode()`:

| Error Code Pattern | HTTP Status | Examples |
| --- | --- | --- |
| `RATE_LIMIT_*` | 429 | `RATE_LIMIT_SMS`, `RATE_LIMIT_LOGIN` |
| `AUTH_*` (most) | 401 | `INVALID_CREDENTIALS`, `TOKEN_INVALID`, `TOKEN_EXPIRED` |
| `AUTH_ACCOUNT_INACTIVE`, `AUTH_ACCOUNT_LOCKED` | 403 | Account access blocked |
| `SIGNUP_EMAIL_EXISTS`, `SIGNUP_USERNAME_EXISTS`, `SIGNUP_PHONE_EXISTS` | 409 | Duplicate registration |
| `SIGNUP_DISABLED` | 403 | Signup not allowed |
| `VALIDATION_*`, `INVALID_*` | 400 | `VALIDATION_FAILED`, `INVALID_PHONE` |
| `RESOURCE_NOT_FOUND` | 404 | Resource not found |
| `FORBIDDEN` | 403 | Permission denied |
| `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` | 500 | Server errors |
| All others | 400 | Default |

:::note
The table above uses the enum **values** (not the enum key names). For example, `INVALID_CREDENTIALS` is the enum key for the value `AUTH_INVALID_CREDENTIALS`, which matches the `AUTH_*` → 401 rule.
:::

## Related

- [NAuthException](/docs/api/core/exceptions/nauth-exception)
- [AuthErrorCode](/docs/api/core/enums/overview)
