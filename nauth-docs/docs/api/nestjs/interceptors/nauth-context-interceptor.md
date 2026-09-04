---
title: NAuthContextInterceptor
description: NestJS interceptor for restoring AsyncLocalStorage context
keywords: [nestjs, interceptor, context, async-local-storage, api]
image: /img/api-social-card.png
---
# NAuthContextInterceptor

**Package:** `@nauth-toolkit/nestjs`
**Type:** NestJS Interceptor

Global interceptor that restores the AsyncLocalStorage context that was initialized by `NAuthContextGuard`. This ensures controllers and services run inside the same request-scoped context.

:::tip[Import from NestJS Package]
```typescript
import { NAuthContextInterceptor } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `NAuthContextInterceptor` is automatically registered as a global interceptor by `AuthModule`. It restores the AsyncLocalStorage context that was created by `NAuthContextGuard`.

**Key Features:**

- Restores AsyncLocalStorage context for controllers/services
- Works with both Express and Fastify adapters
- Mirrors the core FastifyAdapter pattern for context restoration
- Zero business logic - only context restoration

**Why This is Needed:**

- Guards and interceptors run in separate execution contexts
- AsyncLocalStorage context from the guard is not automatically available to controllers
- This interceptor restores the context using `ContextStorage.enterStore()`

## Automatic Registration

The interceptor is automatically registered by `AuthModule` as `APP_INTERCEPTOR`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [AuthModule.forRoot(config)],
})
export class AppModule {}
```

No manual registration needed - the interceptor runs automatically for all HTTP requests.

## Request Flow

1. **NAuthContextGuard:** Initializes context and stores it on request
2. **AuthGuard:** Validates token and loads user (uses context)
3. **NAuthContextInterceptor:** Restores context for controller execution
4. **Controller:** Executes with full context access
5. **Services:** Can access context via `ClientInfoService.get()`

## Context Access

After the interceptor runs, services can access context:

```typescript
import { Injectable } from '@nestjs/common';
import { ClientInfoService, ContextStorage } from '@nauth-toolkit/core';

@Injectable()
export class MyService {
  constructor(private readonly clientInfoService: ClientInfoService) {}

  async doSomething() {
    // Access client info (set by NAuthContextGuard)
    const clientInfo = this.clientInfoService.get();

    // Access current user (set by AuthGuard)
    const user = ContextStorage.get('CURRENT_USER');

    // Access current session (set by AuthGuard)
    const sessionId = ContextStorage.get('CURRENT_SESSION');
  }
}
```

## Related

- [NAuthContextGuard](/docs/api/nestjs/guards/nauth-context-guard) - Initializes context (runs before interceptor)
- [AuthGuard](/docs/api/nestjs/guards/auth-guard) - Authentication guard
- [ClientInfoService](/docs/api/core/services/client-info-service) - Service for accessing client info

