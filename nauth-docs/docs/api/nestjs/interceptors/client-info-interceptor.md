---
title: ClientInfoInterceptor
description: NestJS interceptor for extracting client information
keywords: [nestjs, interceptor, client-info, api]
image: /img/api-social-card.png
sidebar_position: 1
---

# ClientInfoInterceptor

**Package:** `@nauth-toolkit/nestjs`
**Type:** NestJS Interceptor

Extracts client information (IP, User-Agent, device) from requests and populates AsyncLocalStorage context.

## Import

```typescript
import { ClientInfoInterceptor } from '@nauth-toolkit/nestjs';
```

## Usage

### Global Registration

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientInfoInterceptor } from '@nauth-toolkit/nestjs';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClientInfoInterceptor,
    },
  ],
})
export class AppModule {}
```

### Controller-Level

```typescript
import { Controller, UseInterceptors } from '@nestjs/common';
import { ClientInfoInterceptor } from '@nauth-toolkit/nestjs';

@Controller('api')
@UseInterceptors(ClientInfoInterceptor)
export class ApiController {}
```

## Context Data

| Property | Type | Description |
|----------|------|-------------|
| `ip` | `string` | Client IP address |
| `userAgent` | `string` | Raw User-Agent header |
| `deviceName` | `string` | Parsed device name |
| `deviceType` | `string` | `mobile` \| `desktop` \| `tablet` |
| `platform` | `string` | OS platform |
| `browser` | `string` | Browser name |

## Related

- [@ClientInfo()](/docs/api/nestjs/decorators/client-info)
- [ClientInfoService](/docs/api/core/services/client-info-service)

