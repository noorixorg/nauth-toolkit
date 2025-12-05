# @nauth-toolkit/nestjs

NestJS adapter for nauth-toolkit. This package provides NestJS-specific integrations including modules, guards, interceptors, and decorators for the platform-agnostic `@nauth-toolkit/core`.

## Installation

```bash
yarn add @nauth-toolkit/nestjs
```

## Usage

This package re-exports everything from `@nauth-toolkit/core` plus NestJS-specific features.

```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [
    AuthModule.forRootAsync({
      useFactory: async () => ({
        // Your configuration
      }),
    }),
  ],
})
export class AppModule {}
```

## Features

- **AuthModule**: NestJS dynamic module for easy integration
- **Guards**: `AuthGuard` for route protection
- **Interceptors**: `ClientInfoInterceptor`, `CookieTokenInterceptor`
- **Decorators**: `@CurrentUser()`, `@Public()`, `@ClientInfo()`
- **Filters**: `NAuthHttpExceptionFilter` for error handling

## Documentation

See the [main documentation](../../docs/ARCHITECTURE.md) for full details.

## License

MIT

