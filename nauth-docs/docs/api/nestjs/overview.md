---
title: NestJS Adapter
description: NestJS adapter with guards, decorators, interceptors, and module configuration
keywords: [nestjs, adapter, guards, decorators, interceptors, api]
image: /img/api-social-card.png
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
| `NAuthContextGuard` | [NAuthContextGuard](/docs/api/nestjs/guards/nauth-context-guard) |
| `CsrfGuard` | [CsrfGuard](/docs/api/nestjs/guards/csrf-guard) |

### Decorators

| Export | Documentation |
|--------|---------------|
| `@CurrentUser()` | [CurrentUser](/docs/api/nestjs/decorators/current-user) |
| `@Public()` | [Public](/docs/api/nestjs/decorators/public) |
| `IS_PUBLIC_KEY` | Metadata key set by `@Public()` — use in custom guards |
| `@ClientInfo()` | [ClientInfo](/docs/api/nestjs/decorators/client-info) |
| `@TokenDelivery()` | [TokenDelivery](/docs/api/nestjs/decorators/token-delivery) |
| `TOKEN_DELIVERY_KEY` | Metadata key set by `@TokenDelivery()` — use in custom interceptors |
| `RouteDelivery` | Enum of delivery modes used with `@TokenDelivery()` |
| `@RequireRecaptcha()` | [RequireRecaptcha](/docs/api/nestjs/decorators/require-recaptcha) |

### Hook Decorators

| Export | When It Fires |
|--------|---------------|
| `@PreSignupHook()` | Before a user account is created |
| `@PostSignupHook()` | After a user account is created |
| `@UserProfileUpdatedHook()` | After user profile attributes change |
| `@PasswordChangedHook()` | After a password is changed |
| `@MFADeviceRemovedHook()` | After an MFA device is removed |
| `@AdaptiveMFARiskDetectedHook()` | When high-risk signin activity is detected |
| `@AccountStatusChangedHook()` | After an account is enabled or disabled |
| `@EmailChangedHook()` | After a user's email address is changed |
| `@AccountLockedHook()` | After an account is locked |
| `@SessionsRevokedHook()` | After user sessions are bulk revoked |
| `@MFAFirstEnabledHook()` | After a user enables MFA for the first time |
| `HookDecoratorOptions` | Options interface shared by all hook decorators |

### Hooks Module

| Export | Description |
|--------|-------------|
| `NAuthHooksModule` | [NAuthHooksModule](/docs/api/nestjs/decorators/nauth-hooks-module) — auto-registers lifecycle hook providers |

### Interceptors

| Export | Documentation |
|--------|---------------|
| `NAuthContextInterceptor` | [NAuthContextInterceptor](/docs/api/nestjs/interceptors/nauth-context-interceptor) |
| `CookieTokenInterceptor` | [CookieTokenInterceptor](/docs/api/nestjs/interceptors/cookie-token-interceptor) |

### Filters

| Export | Documentation |
|--------|---------------|
| `NAuthHttpExceptionFilter` | [NAuthHttpExceptionFilter](/docs/api/nestjs/filters/nauth-exception-filter) |

### Pipes

| Export | Documentation |
|--------|---------------|
| `NAuthValidationPipe` | [NAuthValidationPipe](/docs/api/nestjs/pipes/nauth-validation-pipe) |

### Providers

| Export | Documentation |
|--------|---------------|
| `NestJsLoggerAdapter` | [NestJsLoggerAdapter](/docs/api/nestjs/providers/nestjs-logger-adapter) |

### Services

| Export | Description |
|--------|-------------|
| `CsrfService` | CSRF token generation and validation service |

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
- [Interceptors](/docs/api/nestjs/interceptors/nauth-context-interceptor)
- [Filters](/docs/api/nestjs/filters/nauth-exception-filter)
