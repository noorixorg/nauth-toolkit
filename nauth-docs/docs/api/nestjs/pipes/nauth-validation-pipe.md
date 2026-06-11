---
title: NAuthValidationPipe
description: NestJS validation pipe that uses nauth-toolkit DTO validation to ensure validation failures always throw NAuthException in the NAUTHError format.
keywords: [nestjs, pipe, validation, dto, api]
image: /img/api-social-card.png
---
# NAuthValidationPipe

**Package:** `@nauth-toolkit/nestjs`
**Type:** NestJS Pipe

```typescript
import { NAuthValidationPipe } from '@nauth-toolkit/nestjs';
```

## Overview

`NAuthValidationPipe` is a drop-in replacement for NestJS's built-in `ValidationPipe` that ensures validation failures always serialize as `NAuthException` in the **NAUTHError** format, rather than NestJS's `BadRequestException` with a different payload shape.

**Why this exists:**
- Nest's `ValidationPipe` throws `BadRequestException` with `message` as an array.
- `NAuthValidationPipe` keeps `message` as a string and places field errors under `details.validationErrors`.
- This keeps the error contract consistent across all nauth-toolkit endpoints.

## Usage

Register globally in `main.ts` alongside `NAuthHttpExceptionFilter`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NAuthValidationPipe, NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new NAuthValidationPipe());
  app.useGlobalFilters(new NAuthHttpExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

:::tip
Use `NAuthValidationPipe` together with [`NAuthHttpExceptionFilter`](/docs/api/nestjs/filters/nauth-exception-filter) to ensure a consistent error response format across all endpoints.
:::

## Behavior

| Input                           | Behavior                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| Valid DTO                       | Returns the validated and transformed DTO instance                       |
| Invalid DTO (validation errors) | Throws `NAuthException` with field errors in `details.validationErrors` |
| Primitive type (string, number) | Passes through without validation                                        |
| `undefined` value               | Passes through without validation (GET requests, optional bodies)        |

## Error Response Shape

When validation fails, the response follows the standard `NAuthException` format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "details": {
    "validationErrors": {
      "email": ["Invalid email format"],
      "password": ["Password must be at least 8 characters"]
    }
  }
}
```

## Related

- [NAuthHttpExceptionFilter](/docs/api/nestjs/filters/nauth-exception-filter) - Exception filter that serializes `NAuthException` responses
- [Error Handling](/docs/concepts/error-handling) - Error handling concepts
