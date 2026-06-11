# @nauth-toolkit/nestjs

NestJS module for [nauth-toolkit](https://nauth.dev) — the embedded authentication library for Node.js.

Provides a `DynamicModule` with `forRoot()` / `forRootAsync()` that wires the nauth-toolkit core into NestJS dependency injection. Adds guards, decorators, and interceptors so authentication integrates with NestJS conventions.

**[Documentation](https://nauth.dev/docs/quick-start/nestjs)** · **[API Reference](https://nauth.dev/docs/api/nestjs/overview)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core` and a database package.

---

## What's included

- **AuthModule** — `forRoot()` and `forRootAsync()` registration with full config support
- **Guards** — `AuthGuard` (JWT validation), `CsrfGuard` (CSRF token enforcement)
- **Decorators** — `@CurrentUser()`, `@Public()`, `@ClientInfo()`, `@TokenDelivery()`, `@RequireRecaptcha()`
- **Interceptors** — context management and cookie-based token delivery
- **Auto-registration** — MFA and social providers are discovered and registered at bootstrap

---

## Install

```bash
npm install @nauth-toolkit/core @nauth-toolkit/nestjs \
  @nauth-toolkit/database-typeorm-postgres \
  @nauth-toolkit/storage-database \
  @nauth-toolkit/email-console \
  @nauth-toolkit/sms-console
# Or for MySQL: replace database-typeorm-postgres with database-typeorm-mysql
```

---

## Quick start

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { AuthModule as NAuthModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig)],
  controllers: [AuthController],
})
export class AuthModule {}
```

```typescript
// auth.controller.ts
import { AuthService, SignupDTO, LoginDTO, AuthGuard, Public, CurrentUser, IUser } from '@nauth-toolkit/nestjs';

@UseGuards(AuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  @Get('me')
  profile(@CurrentUser() user: IUser) {
    return user;
  }
}
```

Full guide: [nauth.dev/docs/quick-start/nestjs](https://nauth.dev/docs/quick-start/nestjs)

---

## Adding providers

MFA and social providers auto-register when imported into your module:

```typescript
import { TOTPMFAModule } from '@nauth-toolkit/mfa-totp/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';

@Module({
  imports: [
    NAuthModule.forRoot(authConfig),
    TOTPMFAModule,
    GoogleSocialAuthModule,
  ],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/core`](https://www.npmjs.com/package/@nauth-toolkit/core) | Auth engine — required peer dependency |
| [`@nauth-toolkit/database-typeorm-postgres`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-postgres) | PostgreSQL entities |
| [`@nauth-toolkit/database-typeorm-mysql`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-mysql) | MySQL entities |
| [`@nauth-toolkit/mfa-totp`](https://www.npmjs.com/package/@nauth-toolkit/mfa-totp) | TOTP authenticator apps |
| [`@nauth-toolkit/social-google`](https://www.npmjs.com/package/@nauth-toolkit/social-google) | Google OAuth |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

## Documentation

| Resource | Link |
| --- | --- |
| NestJS quick start | [nauth.dev/docs/quick-start/nestjs](https://nauth.dev/docs/quick-start/nestjs) |
| Configuration | [nauth.dev/docs/concepts/configuration](https://nauth.dev/docs/concepts/configuration) |
| API reference | [nauth.dev/docs/api/overview](https://nauth.dev/docs/api/overview) |
| Example app | [github.com/noorixorg/nauth-toolkit/examples/nestjs](https://github.com/noorixorg/nauth-toolkit/tree/main/examples/nestjs) |

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
