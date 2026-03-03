# @nauth-toolkit/core

The authentication engine behind nauth-toolkit. All auth business logic lives here — signup, login, MFA, social OAuth, sessions, JWT lifecycle, and more. Runs inside your server process, stores all data in your own database, makes zero external API calls.

**[Documentation](https://nauth.dev)** · **[Quick Start](https://nauth.dev/docs/quick-start/nestjs)** · **[API Reference](https://nauth.dev/docs/api/overview)** · **[Live Demo](https://demo.nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth)**

---

## What it includes

- **Auth flows** — signup, login, email/phone verification, forgot password, change password, account lockout
- **Social OAuth** — Google, Apple, Facebook with web redirect and native mobile token flows, automatic account linking
- **Multi-factor auth** — TOTP, SMS OTP, email OTP, WebAuthn passkeys, recovery codes, adaptive MFA by login risk
- **JWT lifecycle** — access + refresh tokens, rotation with reuse detection, cookie or JSON delivery
- **Sessions** — concurrent session limits, device tracking, IP geolocation, trusted devices, session revocation
- **Security** — Argon2id password hashing, CSRF protection, per-IP and per-user rate limiting, account lockout
- **Audit trail** — structured event log for logins, MFA, password changes, and security incidents
- **Challenge-based flows** — verification, MFA, and password steps return challenge states, not hard errors
- **Single config** — one TypeScript object defines your entire auth policy; everything bootstraps from it

---

## Install

**Express or Fastify** — adapters (`ExpressAdapter`, `FastifyAdapter`) are included in this package:

```bash
npm install @nauth-toolkit/core @nauth-toolkit/database-typeorm-postgres @nauth-toolkit/storage-database @nauth-toolkit/email-console @nauth-toolkit/sms-console
# Or for MySQL: replace database-typeorm-postgres with database-typeorm-mysql
```

**NestJS** — install both core and the NestJS module:

```bash
npm install @nauth-toolkit/core @nauth-toolkit/nestjs @nauth-toolkit/database-typeorm-postgres @nauth-toolkit/storage-database @nauth-toolkit/email-console @nauth-toolkit/sms-console
# Or for MySQL: replace database-typeorm-postgres with database-typeorm-mysql
```

---

## Quick start

### Express

```typescript
import express from 'express';
import { DataSource } from 'typeorm';
import { NAuth, ExpressAdapter, NAuthConfig } from '@nauth-toolkit/core';
// PostgreSQL:
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';
// MySQL: import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';

const app = express();
app.use(express.json());

// Database
const dataSource = new DataSource({
  type: 'postgres', // or 'mysql'
  url: process.env.DATABASE_URL,
  entities: getNAuthEntities(),
  synchronize: true, // dev only
});
await dataSource.initialize();

// Bootstrap
const nauth = await NAuth.create({
  config: {
    jwt: { secret: process.env.JWT_SECRET },
    signup: { requireEmailVerification: false },
    tokenDelivery: { mode: 'json' },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});

// Middleware — order matters
app.use(nauth.middleware.clientInfo); // MUST be first — initializes context
app.use(nauth.middleware.csrf); // CSRF validation
app.use(nauth.middleware.auth); // JWT validation
app.use(nauth.middleware.tokenDelivery); // Cookie delivery interceptor

// Routes
app.post('/auth/signup', nauth.helpers.public(), async (req, res, next) => {
  try {
    res.status(201).json(await nauth.authService.signup(req.body));
  } catch (err) {
    next(err);
  }
});

app.post('/auth/login', nauth.helpers.public(), async (req, res, next) => {
  try {
    res.json(await nauth.authService.login(req.body));
  } catch (err) {
    next(err);
  }
});

app.get('/auth/me', nauth.helpers.requireAuth(), (req, res, next) => {
  try {
    res.json(nauth.helpers.getCurrentUser());
  } catch (err) {
    next(err);
  }
});

app.listen(3000);
```

Full guide: [nauth.dev/docs/quick-start/express](https://nauth.dev/docs/quick-start/express)

### Fastify

```typescript
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new FastifyAdapter(),
});

// Hooks — order matters
fastify.addHook('preHandler', nauth.middleware.clientInfo); // MUST be first
fastify.addHook('preHandler', nauth.middleware.csrf);
fastify.addHook('preHandler', nauth.middleware.auth);
fastify.addHook('onSend', nauth.middleware.tokenDelivery);

// Routes — wrap handlers with nauth.adapter.wrapRouteHandler for context access
fastify.post(
  '/auth/signup',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => nauth.authService.signup(req.body)),
);
```

Full guide: [nauth.dev/docs/quick-start/fastify](https://nauth.dev/docs/quick-start/fastify)

### NestJS

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

## Example apps

Full working examples with Docker, database setup, and frontend integration:

| Example                                                                  | Description                                 |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| [Express](https://github.com/noorixorg/nauth/tree/main/examples/express) | Express + TypeORM + PostgreSQL              |
| [Fastify](https://github.com/noorixorg/nauth/tree/main/examples/fastify) | Fastify + TypeORM + PostgreSQL              |
| [NestJS](https://github.com/noorixorg/nauth/tree/main/examples/nestjs)   | NestJS + TypeORM + PostgreSQL               |
| [React](https://github.com/noorixorg/nauth/tree/main/examples/react)     | React frontend with `@nauth-toolkit/client` |

**Repository:** [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth)

---

## Package ecosystem

nauth-toolkit is modular. Start with this package plus a database adapter, then add providers for MFA, social, email, and SMS as needed.

### Framework adapter

| Package                                                                        | Purpose                                                                                |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [`@nauth-toolkit/nestjs`](https://www.npmjs.com/package/@nauth-toolkit/nestjs) | NestJS DynamicModule with `AuthModule.forRoot()`, guards, decorators, and interceptors |

### Frontend SDKs

| Package                                                                                        | Purpose                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`@nauth-toolkit/client`](https://www.npmjs.com/package/@nauth-toolkit/client)                 | Framework-agnostic client SDK — React, Vue, Svelte, vanilla JS                    |
| [`@nauth-toolkit/client-angular`](https://www.npmjs.com/package/@nauth-toolkit/client-angular) | Angular SDK with `NAuthModule`, `AuthService`, HTTP interceptor, and route guards |

### Database

Pick one. Provides TypeORM entity definitions for your database.

| Package                                                                                                              | Purpose             |
| -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| [`@nauth-toolkit/database-typeorm-postgres`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-postgres) | PostgreSQL entities |
| [`@nauth-toolkit/database-typeorm-mysql`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-mysql)       | MySQL entities      |

### Storage

Used for rate limiting, token blacklisting, account lockout, and distributed locks.

| Package                                                                                            | Purpose                                                           |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`@nauth-toolkit/storage-database`](https://www.npmjs.com/package/@nauth-toolkit/storage-database) | Database-backed storage — no Redis required                       |
| [`@nauth-toolkit/storage-redis`](https://www.npmjs.com/package/@nauth-toolkit/storage-redis)       | Redis — recommended for production and multi-instance deployments |

### MFA providers

Each method is a separate package. Install only what you need.

| Package                                                                                  | Method                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`@nauth-toolkit/mfa-totp`](https://www.npmjs.com/package/@nauth-toolkit/mfa-totp)       | TOTP — Google Authenticator, Authy               |
| [`@nauth-toolkit/mfa-sms`](https://www.npmjs.com/package/@nauth-toolkit/mfa-sms)         | SMS OTP                                          |
| [`@nauth-toolkit/mfa-email`](https://www.npmjs.com/package/@nauth-toolkit/mfa-email)     | Email OTP                                        |
| [`@nauth-toolkit/mfa-passkey`](https://www.npmjs.com/package/@nauth-toolkit/mfa-passkey) | WebAuthn / passkeys — Face ID, Touch ID, YubiKey |

### Social OAuth

Each provider is a separate package with web redirect and native mobile token support.

| Package                                                                                          | Provider           |
| ------------------------------------------------------------------------------------------------ | ------------------ |
| [`@nauth-toolkit/social-google`](https://www.npmjs.com/package/@nauth-toolkit/social-google)     | Google OAuth 2.0   |
| [`@nauth-toolkit/social-apple`](https://www.npmjs.com/package/@nauth-toolkit/social-apple)       | Sign in with Apple |
| [`@nauth-toolkit/social-facebook`](https://www.npmjs.com/package/@nauth-toolkit/social-facebook) | Facebook Login     |

### Email providers

Required if you enable email verification, email OTP, or password reset emails.

| Package                                                                                            | Purpose                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`@nauth-toolkit/email-nodemailer`](https://www.npmjs.com/package/@nauth-toolkit/email-nodemailer) | Nodemailer — SMTP, AWS SES, SendGrid, and any transport |
| [`@nauth-toolkit/email-console`](https://www.npmjs.com/package/@nauth-toolkit/email-console)       | Log emails to console — development use                 |

### SMS providers

Required if you enable phone verification or SMS MFA.

| Package                                                                                  | Purpose                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------ |
| [`@nauth-toolkit/sms-aws-sns`](https://www.npmjs.com/package/@nauth-toolkit/sms-aws-sns) | AWS SNS                              |
| [`@nauth-toolkit/sms-console`](https://www.npmjs.com/package/@nauth-toolkit/sms-console) | Log SMS to console — development use |

### Other

| Package                                                                              | Purpose                          |
| ------------------------------------------------------------------------------------ | -------------------------------- |
| [`@nauth-toolkit/recaptcha`](https://www.npmjs.com/package/@nauth-toolkit/recaptcha) | reCAPTCHA v2, v3, and Enterprise |

---

## Documentation

| Resource                | Link                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Full documentation      | [nauth.dev](https://nauth.dev)                                                         |
| Quick Start — NestJS    | [nauth.dev/docs/quick-start/nestjs](https://nauth.dev/docs/quick-start/nestjs)         |
| Quick Start — Express   | [nauth.dev/docs/quick-start/express](https://nauth.dev/docs/quick-start/express)       |
| Quick Start — Fastify   | [nauth.dev/docs/quick-start/fastify](https://nauth.dev/docs/quick-start/fastify)       |
| Configuration reference | [nauth.dev/docs/concepts/configuration](https://nauth.dev/docs/concepts/configuration) |
| Auth flows guide        | [nauth.dev/docs/guides/basic-auth](https://nauth.dev/docs/guides/basic-auth)           |
| API reference           | [nauth.dev/docs/api/overview](https://nauth.dev/docs/api/overview)                     |
| Frontend SDK            | [nauth.dev/docs/frontend-sdk/overview](https://nauth.dev/docs/frontend-sdk/overview)   |
| Example apps            | [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth/tree/main/examples)    |
| Live demo               | [demo.nauth.dev](https://demo.nauth.dev)                                               |

---

Free to use. See [license](https://nauth.dev/docs/license).
