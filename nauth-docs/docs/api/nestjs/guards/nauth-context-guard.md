---
title: NAuthContextGuard
description: NestJS guard for initializing AsyncLocalStorage context
keywords: [nestjs, guard, context, async-local-storage, api]
image: /img/api-social-card.png
---
# NAuthContextGuard

**Package:** `@nauth-toolkit/nestjs`
**Type:** NestJS Guard

Global guard that initializes AsyncLocalStorage context and extracts client information for all HTTP requests. Runs FIRST before other guards to ensure context is available.

:::tip[Import from NestJS Package]
```typescript
import { NAuthContextGuard } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `NAuthContextGuard` is automatically registered as a global guard by `AuthModule`. It initializes the AsyncLocalStorage context that is used throughout the request lifecycle.

**Key Features:**

- Initializes AsyncLocalStorage context early (before other guards)
- Extracts client information (IP, user agent, device token, geolocation)
- Stores HTTP response object for services that need response access
- Works with both Express and Fastify adapters
- Mirrors the core FastifyAdapter pattern for context management

**Why a Guard (not Middleware):**

- Guards run before interceptors, ensuring context is available for both guards and controllers
- Works with Fastify adapter (Nest middleware is not consistently supported)
- Ensures context is initialized before `AuthGuard` runs

## Automatic Registration

The guard is automatically registered by `AuthModule` as `APP_GUARD`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [AuthModule.forRoot(config)],
})
export class AppModule {}
```

No manual registration needed - the guard runs automatically for all HTTP requests.

## Context Data

The guard extracts and stores the following client information:

| Property | Type | Description |
|----------|------|-------------|
| `ipAddress` | `string` | Client IP address (handles proxies/load balancers) |
| `userAgent` | `string` | Raw User-Agent header |
| `deviceToken` | `string \| undefined` | Device token from cookie or header |
| `deviceName` | `string \| undefined` | Parsed device name |
| `deviceType` | `'desktop' \| 'mobile' \| 'tablet' \| undefined` | Parsed device type |
| `platform` | `string \| undefined` | OS platform (e.g., 'Windows', 'iOS') |
| `browser` | `string \| undefined` | Browser name (e.g., 'Chrome', 'Safari') |
| `ipCountry` | `string \| undefined` | IP geolocation country (if MaxMind configured) |
| `ipCity` | `string \| undefined` | IP geolocation city (if MaxMind configured) |
| `ipLatitude` | `number \| undefined` | IP geolocation latitude (if MaxMind configured) |
| `ipLongitude` | `number \| undefined` | IP geolocation longitude (if MaxMind configured) |
| `sessionId` | `number \| undefined` | Session ID (set by AuthGuard after token validation) |
| `userId` | `number \| undefined` | User ID (set by AuthGuard after token validation) |

## Request Flow

1. **Guard Executes:** Runs FIRST for all HTTP requests
2. **Context Initialization:** Creates new AsyncLocalStorage store
3. **Client Info Extraction:** Extracts IP, user agent, device token
4. **Geolocation Lookup:** Optional geolocation if MaxMind configured
5. **Context Storage:** Stores client info and HTTP response in context
6. **Context Persistence:** Stores context store on request object for restoration
7. **Continue:** Returns true to allow request to proceed

## Accessing Context Data

Client information is automatically available via services:

```typescript
import { Injectable } from '@nestjs/common';
import { ClientInfoService } from '@nauth-toolkit/core';

@Injectable()
export class MyService {
  constructor(private readonly clientInfoService: ClientInfoService) {}

  async doSomething() {
    // Get client info from context (transparent!)
    const clientInfo = this.clientInfoService.get();

    console.log(`Request from IP: ${clientInfo.ipAddress}`);
    console.log(`User Agent: ${clientInfo.userAgent}`);
    console.log(`Device: ${clientInfo.deviceType}`);
  }
}
```

## Configuration

The guard behavior is configured via `NAuthConfig`:

```typescript
{
  geoLocation: {
    maxMind: {
      // MaxMind configuration for geolocation
      // If not provided, geolocation fields remain undefined
    },
  },
}
```

## Related

- [NAuthContextInterceptor](/docs/api/nestjs/interceptors/nauth-context-interceptor) - Restores context for controllers
- [AuthGuard](/docs/api/nestjs/guards/auth-guard) - Authentication guard (runs after context guard)
- [ClientInfoService](/docs/api/core/services/client-info-service) - Service for accessing client info
- [@ClientInfo()](/docs/api/nestjs/decorators/client-info) - Decorator to inject client info

