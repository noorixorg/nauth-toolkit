---
title: NestJS Adapter
description: NestJS adapter with guards, decorators, interceptors, and module configuration
keywords: [nestjs, adapter, guards, decorators, interceptors, api]
image: /img/api-social-card.png
sidebar_position: 0
---

# NestJS Adapter

**Package:** `@nauth-toolkit/nestjs`
**Type:** Framework Adapter

```bash npm2yarn
npm install @nauth-toolkit/nestjs
```

## Exports

### Module

| Export | Description |
|--------|-------------|
| `AuthModule` | Main module with `forRoot()` |
| `NAuthModuleConfig` | Module configuration type |

### Guards

| Export | Documentation |
|--------|---------------|
| `AuthGuard` | [AuthGuard](/docs/api/nestjs/guards/auth-guard) |
| `CsrfGuard` | [CsrfGuard](/docs/api/nestjs/guards/csrf-guard) |

### Decorators

| Export | Documentation |
|--------|---------------|
| `@CurrentUser()` | [CurrentUser](/docs/api/nestjs/decorators/current-user) |
| `@Public()` | [Public](/docs/api/nestjs/decorators/public) |
| `@ClientInfo()` | [ClientInfo](/docs/api/nestjs/decorators/client-info) |
| `@TokenDelivery()` | [TokenDelivery](/docs/api/nestjs/decorators/token-delivery) |

### Interceptors

| Export | Documentation |
|--------|---------------|
| `ClientInfoInterceptor` | [ClientInfoInterceptor](/docs/api/nestjs/interceptors/client-info-interceptor) |
| `CookieTokenInterceptor` | [CookieTokenInterceptor](/docs/api/nestjs/interceptors/cookie-token-interceptor) |

### Filters

| Export | Documentation |
|--------|---------------|
| `NAuthHttpExceptionFilter` | [NAuthHttpExceptionFilter](/docs/api/nestjs/filters/nauth-exception-filter) |

### Providers

| Export | Documentation |
|--------|---------------|
| `NestJsLoggerAdapter` | [NestJsLoggerAdapter](/docs/api/nestjs/providers/nestjs-logger-adapter) |

### Storage Factories

| Export | Description |
|--------|-------------|
| `createRedisStorageAdapter(url)` | Redis session storage |
| `createDatabaseStorageAdapter()` | Database session storage |
| `createRedisClusterAdapter(nodes)` | Redis cluster storage |

### Re-exports from Core

All exports from `@nauth-toolkit/core`:
- Services: `AuthService`, `MFAService`, `SocialAuthService`, etc.
- DTOs: `SignupDTO`, `LoginDTO`, `AuthResponseDTO`, etc.
- Interfaces: `NAuthConfig`, `IUser`, `ISession`, etc.
- Enums: `MFAMethod`, `AuthErrorCode`, etc.
- Exceptions: `NAuthException`

## AuthModule

### forRoot()

```typescript
AuthModule.forRoot(config: NAuthModuleConfig): DynamicModule
```

**Example**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      entities: getNAuthEntities(),
    }),
    AuthModule.forRoot({
      jwt: {
        algorithm: 'HS256',
        accessToken: { secret: 'secret', expiresIn: '15m' },
        refreshToken: { secret: 'refresh', expiresIn: '7d' },
      },
    }),
  ],
})
export class AppModule {}
```

## Related

- [Guards](/docs/api/nestjs/guards/auth-guard)
- [Decorators](/docs/api/nestjs/decorators/current-user)
- [Interceptors](/docs/api/nestjs/interceptors/client-info-interceptor)
- [Filters](/docs/api/nestjs/filters/nauth-exception-filter)
