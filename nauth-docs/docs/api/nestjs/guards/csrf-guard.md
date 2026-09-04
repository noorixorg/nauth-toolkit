---
title: CsrfGuard
description: CSRF token validation guard for cookie-based token delivery in NestJS
keywords: [nestjs, guard, csrf, security, cookie, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CsrfGuard

**Package:** `@nauth-toolkit/nestjs`
**Type:** Guard

NestJS guard that validates CSRF tokens for state-changing requests when using cookie-based token delivery.

:::tip[Import from NestJS Package]
```typescript
import { CsrfGuard } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `CsrfGuard` protects against Cross-Site Request Forgery (CSRF) attacks when using cookie-based token delivery. It validates that CSRF tokens from request headers match the values stored in cookies.

**Key Features:**

- Automatic enforcement when `tokenDelivery.method === 'cookies'` or `'hybrid'`
- Skips safe HTTP methods (GET, HEAD, OPTIONS)
- Respects `@Public()` decorator
- Supports excluded paths configuration
- Only enforces for cookie-based delivery (JSON/Bearer tokens are CSRF-safe)

**Security Rules:**

- Only enforces for cookie-based token delivery
- Skips safe HTTP methods automatically
- Validates header token matches cookie value
- Throws `NAuthException` on validation failure

:::note
Auto-applied globally via `AuthModule` when `tokenDelivery.method === 'cookies'` or `'hybrid'`. No manual configuration needed.
:::

## Usage

### Automatic Application

The guard is automatically registered when using cookie-based token delivery:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [
    AuthModule.forRoot({
      tokenDelivery: {
        method: 'cookies', // CSRF guard automatically applied
      },
      security: {
        csrf: {
          headerName: 'x-csrf-token',
          cookieName: 'nauth_csrf_token',
        },
      },
    }),
  ],
})
export class AppModule {}
```

### Manual Application

Apply guard to specific routes:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '@nauth-toolkit/nestjs';

@Controller('api')
export class ApiController {
  @UseGuards(CsrfGuard)
  @Post('sensitive-action')
  async sensitiveAction() {
    return { success: true };
  }
}
```

### Public Routes

Public routes automatically bypass CSRF validation:

```typescript
import { Controller, Post } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @Public() // CSRF validation skipped
  @Post('login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }
}
```

### Excluded Paths

Configure paths to exclude from CSRF validation:

```typescript
AuthModule.forRoot({
  tokenDelivery: {
    method: 'cookies',
  },
  security: {
    csrf: {
      excludedPaths: ['/webhook', '/public-api'],
    },
  },
})
```

## Token Delivery Modes

### Cookie Mode

CSRF protection is **required** and automatically enforced:

```typescript
tokenDelivery: {
  method: 'cookies',
}
```

### Hybrid Mode

CSRF protection applies only when request uses cookie delivery (web origins):

```typescript
tokenDelivery: {
  method: 'hybrid',
  hybridPolicy: {
    webOrigins: ['https://example.com'],
  },
}
```

### JSON Mode

CSRF protection is **not required** (Bearer tokens are CSRF-safe):

```typescript
tokenDelivery: {
  method: 'json', // CSRF guard not applied
}
```

## Frontend Integration

Frontend must send CSRF token in headers for state-changing requests:

```typescript
// 1. Read CSRF token from cookie
const csrfToken = getCookie('nauth_csrf_token');

// 2. Send in header for POST/PUT/DELETE/PATCH
fetch('/api/sensitive-action', {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ data: 'value' }),
});
```

## Errors

| Code | When | Details |
| ---- | ---- | ------- |
| `CSRF_TOKEN_MISSING` | Token missing in header or cookie | `undefined` |
| `CSRF_TOKEN_INVALID` | Token mismatch | `undefined` |

**Error Response Example:**

```json
{
  "statusCode": 403,
  "message": "CSRF token missing in header: x-csrf-token",
  "error": "Forbidden",
  "code": "CSRF_TOKEN_MISSING"
}
```

## Configuration

Configure CSRF behavior via `NAuthConfig`:

```typescript
{
  tokenDelivery: {
    method: 'cookies', // Required for CSRF enforcement
  },
  security: {
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
      tokenLength: 32,
      excludedPaths: ['/webhook'],
      cookieOptions: {
        secure: true,
        sameSite: 'strict',
        path: '/',
      },
    },
  },
}
```

## Related APIs

- [AuthGuard](./auth-guard) - JWT authentication guard
- [`@Public()` Decorator](../decorators/public) - Bypass CSRF validation
- [`@TokenDelivery()` Decorator](../decorators/token-delivery) - Override delivery mode
- [CsrfService](/docs/api/core/services/csrf-service) - CSRF token generation
