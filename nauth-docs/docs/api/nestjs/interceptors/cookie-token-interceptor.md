---
title: CookieTokenInterceptor
description: NestJS interceptor for cookie-based token delivery
keywords: [nestjs, interceptor, cookies, token, api]
image: /img/api-social-card.png
---
# CookieTokenInterceptor

**Package:** `@nauth-toolkit/nestjs`
**Type:** NestJS Interceptor

Intercepts responses containing `AuthResponseDTO` and sets authentication cookies based on delivery mode.

## Import

```typescript
import { CookieTokenInterceptor } from '@nauth-toolkit/nestjs';
```

## Usage

### Global Registration

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CookieTokenInterceptor } from '@nauth-toolkit/nestjs';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CookieTokenInterceptor,
    },
  ],
})
export class AppModule {}
```

### Controller-Level

```typescript
import { Controller, UseInterceptors } from '@nestjs/common';
import { CookieTokenInterceptor } from '@nauth-toolkit/nestjs';

@Controller('auth')
@UseInterceptors(CookieTokenInterceptor)
export class AuthController {}
```

## Behavior

- Detects `AuthResponseDTO` in response body
- Sets `accessToken` and `refreshToken` cookies based on delivery mode
- Removes tokens from JSON body when using cookie delivery
- Sets CSRF token cookie

## Cookie Options

Configured via `config.tokenDelivery.cookieOptions`:

| Option | Type | Description |
|--------|------|-------------|
| `secure` | `boolean` | HTTPS only |
| `httpOnly` | `boolean` | Always `true` --- hardcoded for security, cannot be disabled |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | CSRF protection |
| `domain` | `string` | Cookie domain |
| `path` | `string` | Cookie path (defaults to `'/'`) |
| `maxAge` | `number` | Cookie max age in milliseconds |

## Related

- [@TokenDelivery()](/docs/api/nestjs/decorators/token-delivery)

