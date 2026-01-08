---
title: "@ClientInfo()"
description: Extract client information (IP address, user agent, device info) in NestJS controllers
keywords: [nestjs, decorator, client-info, ip, user-agent, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# @ClientInfo()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Parameter Decorator

Parameter decorator that injects client information (IP address, user agent, device info) into controller methods.

:::tip Import from NestJS Package
```typescript
import { ClientInfo } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `@ClientInfo()` decorator provides a clean, type-safe way to access client metadata without manual extraction. Client information is automatically extracted by `NAuthContextGuard` and made available via this decorator.

**Key Features:**

- Automatic IP address extraction (handles proxies/load balancers)
- User agent parsing
- Device token support
- Optional geolocation data
- Type-safe access to client metadata

:::note
Client information is automatically extracted by `NAuthContextGuard` when using `AuthModule`. No manual setup required.
:::

## Usage

### Full Client Info Object

Get complete client information:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ClientInfo, IClientInfo } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(
    @Body() dto: LoginDTO,
    @ClientInfo() clientInfo: IClientInfo,
  ) {
    // clientInfo.ipAddress - automatically extracted
    // clientInfo.userAgent - automatically extracted
    // clientInfo.deviceToken - from request body or header (optional)
    return this.authService.login(dto, clientInfo);
  }
}
```

### Specific Field

Extract a specific field:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ClientInfo } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @Post('signup')
  async signup(
    @Body() dto: SignupDTO,
    @ClientInfo('ipAddress') ip: string,
  ) {
    // Just the IP address
    return this.authService.signup(dto, ip);
  }
}
```

### With Authentication

Use with authenticated routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, ClientInfo, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IClientInfo, IUser } from '@nauth-toolkit/nestjs';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  @Get('activity')
  getActivity(
    @CurrentUser() user: IUser,
    @ClientInfo() clientInfo: IClientInfo,
  ) {
    return {
      userId: user.sub,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      location: {
        country: clientInfo.ipCountry,
        city: clientInfo.ipCity,
      },
    };
  }
}
```

## Client Info Interface

```typescript
interface IClientInfo {
  ipAddress: string;
  userAgent: string;
  deviceToken?: string;
  ipCountry?: string;
  ipCity?: string;
  ipLatitude?: number;
  ipLongitude?: number;
}
```

## Field Access

Access specific fields:

```typescript
@Post('track')
async track(
  @ClientInfo('ipAddress') ip: string,
  @ClientInfo('userAgent') ua: string,
  @ClientInfo('ipCountry') country?: string,
) {
  // Use individual fields
}
```

## Geolocation

Geolocation data is automatically populated when `GeoLocationService` is configured:

```typescript
@Post('login')
async login(
  @Body() dto: LoginDTO,
  @ClientInfo() clientInfo: IClientInfo,
) {
  if (clientInfo.ipCountry) {
    // Geolocation available
    console.log(`Login from ${clientInfo.ipCountry}`);
  }
}
```

## Related APIs

- [NAuthContextGuard](/docs/api/nestjs/guards/nauth-context-guard) - Automatic client info extraction and context initialization
- [NAuthContextInterceptor](/docs/api/nestjs/interceptors/nauth-context-interceptor) - Context restoration for controllers
- [AuthGuard](../guards/auth-guard) - Route protection
- [`@CurrentUser()` Decorator](./current-user) - Extract authenticated user
