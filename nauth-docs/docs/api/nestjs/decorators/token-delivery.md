---
title: "@TokenDelivery()"
description: Override token delivery mode for specific routes in NestJS
keywords: [nestjs, decorator, token-delivery, cookies, json, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# @TokenDelivery()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Method Decorator

Method decorator that overrides the global token delivery mode for a specific route.

:::tip Import from NestJS Package
```typescript
import { TokenDelivery } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `@TokenDelivery()` decorator allows you to force a specific token delivery mode for an endpoint, regardless of the global configuration. This is useful when you need different delivery modes for different clients (web vs mobile).

**Key Features:**

- Override global token delivery mode per route
- Force cookie-based delivery for web endpoints
- Force JSON delivery for mobile/API endpoints
- Works with hybrid mode configuration

## Usage

### Force Cookie Delivery

Force cookie-based delivery for web endpoints:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Public, TokenDelivery } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('login/web')
  @TokenDelivery('cookies')
  async loginWeb(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }
}
```

### Force JSON Delivery

Force JSON delivery for mobile/API endpoints:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Public, TokenDelivery } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('login/mobile')
  @TokenDelivery('json')
  async loginMobile(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }
}
```

### Mixed Delivery Modes

Use different delivery modes for different endpoints:

```typescript
import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, TokenDelivery, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('api')
@UseGuards(AuthGuard)
export class ApiController {
  @Get('web/data')
  @TokenDelivery('cookies')
  getWebData(@CurrentUser() user: IUser) {
    return { data: 'web data' };
  }

  @Get('mobile/data')
  @TokenDelivery('json')
  getMobileData(@CurrentUser() user: IUser) {
    return { data: 'mobile data' };
  }
}
```

## Delivery Modes

### `'cookies'`

Forces cookie-based token delivery:

- Tokens set as httpOnly cookies
- Tokens stripped from response body
- CSRF protection required
- Suitable for web applications

### `'json'`

Forces JSON token delivery:

- Tokens returned in response body
- No cookies set
- CSRF protection not required
- Suitable for mobile/API clients

## Configuration Validation

The decorator validates that the requested mode is allowed by global configuration:

```typescript
// Global config: tokenDelivery.method = 'json'
@TokenDelivery('cookies') // Throws COOKIES_NOT_ALLOWED

// Global config: tokenDelivery.method = 'cookies'
@TokenDelivery('json') // Throws BEARER_NOT_ALLOWED

// Global config: tokenDelivery.method = 'hybrid'
@TokenDelivery('cookies') // Allowed
@TokenDelivery('json') // Allowed
```

## Errors

| Code | When | Details |
| ---- | ---- | ------- |
| `COOKIES_NOT_ALLOWED` | Route requests cookies but global config is 'json' | `undefined` |
| `BEARER_NOT_ALLOWED` | Route requests JSON but global config is 'cookies' | `undefined` |

## Related APIs

- [AuthGuard](../guards/auth-guard) - Route protection
- [CsrfGuard](../guards/csrf-guard) - CSRF protection (required for cookies)
- [`@Public()` Decorator](./public) - Mark routes as public
- [Token Delivery](/docs/features/token-delivery) - Token delivery modes guide
