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
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "statusCode": 401,
  "details": {}
}
```

## Status Code Mapping

| Error Code            | HTTP Status |
| --------------------- | ----------- |
| `INVALID_CREDENTIALS` | 401         |
| `UNAUTHORIZED`        | 401         |
| `TOKEN_EXPIRED`       | 401         |
| `USER_NOT_FOUND`      | 404         |
| `USER_ALREADY_EXISTS` | 409         |
| `VALIDATION_ERROR`    | 400         |
| `MFA_REQUIRED`        | 403         |
| `CSRF_INVALID`        | 403         |

## Related

- [NAuthException](/docs/api/core/exceptions/nauth-exception)
- [AuthErrorCode](/docs/api/core/enums/overview)
