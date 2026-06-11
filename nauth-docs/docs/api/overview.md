---
title: API Reference
description: 'API reference covering core services (AuthService, MFAService, SocialAuthService), 90+ DTOs, enums, interfaces, NestJS/Express/Fastify adapters, and provider packages for MFA, social auth, email, SMS, database, and storage'
keywords: [api, reference, documentation, nestjs, express, fastify, authentication]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# API Reference

Complete reference documentation for nauth-toolkit. All APIs documented with TypeScript signatures, validation rules, and framework-specific examples.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

## Getting Started

```typescript
import { AuthService, AuthModule, AuthGuard } from '@nauth-toolkit/nestjs';
```

## Documentation Structure

### Framework Integration

- **[NestJS Overview](/docs/api/nestjs/overview)** - Modules, configuration, setup
- **[Guards](/docs/api/nestjs/guards/auth-guard)** - Route protection with `@UseGuards(AuthGuard)`
- **[Decorators](/docs/api/nestjs/decorators/current-user)** - Extract user data with `@CurrentUser()`

### Core Services

- **[AuthService](/docs/api/core/services/auth-service)** - Login, signup, password management, sessions
- **[MFAService](/docs/api/core/services/mfa-service)** - Multi-factor authentication setup and verification
- **[SocialAuthService](/docs/api/core/services/social-auth-service)** - Google, Apple, Facebook OAuth
- **[All Services](/docs/api/core/services/overview)** - Complete service list

### Data Transfer Objects

- **[LoginDTO](/docs/api/core/dto/login-dto)** - User login request
- **[SignupDTO](/docs/api/core/dto/signup-dto)** - User registration request
- **[AuthResponseDTO](/docs/api/core/dto/auth-response-dto)** - Unified authentication response
- **[All DTOs](/docs/api/core/dto/overview)** - Complete DTO list

### Error Handling

- **[NAuthException](/docs/api/core/exceptions/nauth-exception)** - Structured exception class
- **[Error Handling Guide](/docs/concepts/error-handling)** - Best practices and patterns

## Feature Packages

### MFA Providers

```bash npm2yarn
npm install @nauth-toolkit/mfa-totp
```

```typescript
import { TOTPMFAModule } from '@nauth-toolkit/mfa-totp/nestjs';
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';

@Module({
  imports: [
    AuthModule.forRoot(config),
    TOTPMFAModule,
    SMSMFAModule,
  ],
})
```

### Social Auth Providers

```bash npm2yarn
npm install @nauth-toolkit/social-google
```

```typescript
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { AppleSocialAuthModule } from '@nauth-toolkit/social-apple/nestjs';

@Module({
  imports: [
    AuthModule.forRoot(config),
    GoogleSocialAuthModule,
    AppleSocialAuthModule,
  ],
})
```

### Email & SMS Providers

```bash npm2yarn
npm install @nauth-toolkit/email-nodemailer
```

Configure in `AuthModule.forRoot()`:

```typescript
AuthModule.forRoot({
  emailProvider: new NodemailerEmailProvider({ ... }),
  smsProvider: new TwilioSMSProvider({ ... }),
})
```

</TabItem>
<TabItem value="express" label="Express">

## Getting Started

```typescript
import { NAuth, ExpressAdapter, AuthService } from '@nauth-toolkit/core';
```

## Documentation Structure

### Framework Integration

- **Bootstrap** - `NAuth.create()` with `ExpressAdapter`
- **Middleware** - `nauth.middleware.clientInfo`, `auth`, `csrf`, `tokenDelivery`
- **Helpers** - `nauth.helpers.requireAuth()`, `public()`, `getCurrentUser()`

### Core Services

- **[AuthService](/docs/api/core/services/auth-service)** - Login, signup, password management, sessions
- **[MFAService](/docs/api/core/services/mfa-service)** - Multi-factor authentication setup and verification
- **[SocialAuthService](/docs/api/core/services/social-auth-service)** - Google, Apple, Facebook OAuth
- **[All Services](/docs/api/core/services/overview)** - Complete service list

### Data Transfer Objects

- **[LoginDTO](/docs/api/core/dto/login-dto)** - User login request
- **[SignupDTO](/docs/api/core/dto/signup-dto)** - User registration request
- **[AuthResponseDTO](/docs/api/core/dto/auth-response-dto)** - Unified authentication response
- **[All DTOs](/docs/api/core/dto/overview)** - Complete DTO list

### Error Handling

- **[NAuthException](/docs/api/core/exceptions/nauth-exception)** - Structured exception class
- **[Error Handling Guide](/docs/concepts/error-handling)** - Best practices and patterns

## Bootstrap Example

```typescript
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource: dataSource,
  adapter: new ExpressAdapter(),
});

// Mount middleware (order matters)
app.use(nauth.middleware.clientInfo); // FIRST
app.use(nauth.middleware.csrf);
app.use(nauth.middleware.auth);
app.use(nauth.middleware.tokenDelivery);

// Routes
app.post('/auth/signup', nauth.helpers.public(), async (req, res, next) => {
  try {
    const result = await nauth.authService.signup(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
```

## Feature Packages

### MFA Providers

```bash npm2yarn
npm install @nauth-toolkit/mfa-totp
```

MFA providers auto-register when configured:

```typescript
const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS],
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

### Social Auth Providers

```bash npm2yarn
npm install @nauth-toolkit/social-google
```

Social providers auto-register when configured:

```typescript
const nauth = await NAuth.create({
  config: {
    social: {
      google: {
        enabled: true,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

### Email & SMS Providers

```bash npm2yarn
npm install @nauth-toolkit/email-nodemailer
```

Configure in `NAuth.create()`:

```typescript
const nauth = await NAuth.create({
  config: {
    emailProvider: new NodemailerEmailProvider({ ... }),
    smsProvider: new TwilioSMSProvider({ ... }),
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

## Getting Started

```typescript
import { NAuth, FastifyAdapter, AuthService } from '@nauth-toolkit/core';
```

## Documentation Structure

### Framework Integration

- **Bootstrap** - `NAuth.create()` with `FastifyAdapter`
- **Hooks** - `nauth.middleware.clientInfo`, `auth`, `csrf`, `tokenDelivery`
- **Helpers** - `nauth.helpers.requireAuth()`, `public()`, `getCurrentUser()`
- **Context** - `nauth.adapter.wrapRouteHandler()` for route handlers

### Core Services

- **[AuthService](/docs/api/core/services/auth-service)** - Login, signup, password management, sessions
- **[MFAService](/docs/api/core/services/mfa-service)** - Multi-factor authentication setup and verification
- **[SocialAuthService](/docs/api/core/services/social-auth-service)** - Google, Apple, Facebook OAuth
- **[All Services](/docs/api/core/services/overview)** - Complete service list

### Data Transfer Objects

- **[LoginDTO](/docs/api/core/dto/login-dto)** - User login request
- **[SignupDTO](/docs/api/core/dto/signup-dto)** - User registration request
- **[AuthResponseDTO](/docs/api/core/dto/auth-response-dto)** - Unified authentication response
- **[All DTOs](/docs/api/core/dto/overview)** - Complete DTO list

### Error Handling

- **[NAuthException](/docs/api/core/exceptions/nauth-exception)** - Structured exception class
- **[Error Handling Guide](/docs/concepts/error-handling)** - Best practices and patterns

## Bootstrap Example

```typescript
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource: dataSource,
  adapter: new FastifyAdapter(),
});

// Register hooks (order matters)
fastify.addHook('onRequest', nauth.middleware.clientInfo as any); // FIRST
fastify.addHook('onRequest', nauth.middleware.csrf as any);
fastify.addHook('onRequest', nauth.middleware.auth as any);
fastify.addHook('onSend', nauth.middleware.tokenDelivery as any);

// Routes - wrap handlers with nauth.adapter.wrapRouteHandler
fastify.post(
  '/auth/signup',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.signup(req.body as any);
  }),
);
```

:::note Fastify Context
Fastify hooks run independently, so AsyncLocalStorage context must be restored in route handlers.
Use `nauth.adapter.wrapRouteHandler()` to access `nauth.helpers.getCurrentUser()` and context-dependent services.
:::

## Feature Packages

### MFA Providers

```bash npm2yarn
npm install @nauth-toolkit/mfa-totp
```

MFA providers auto-register when configured:

```typescript
const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS],
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

### Social Auth Providers

```bash npm2yarn
npm install @nauth-toolkit/social-google
```

Social providers auto-register when configured:

```typescript
const nauth = await NAuth.create({
  config: {
    social: {
      google: {
        enabled: true,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

### Email & SMS Providers

```bash npm2yarn
npm install @nauth-toolkit/email-nodemailer
```

Configure in `NAuth.create()`:

```typescript
const nauth = await NAuth.create({
  config: {
    emailProvider: new NodemailerEmailProvider({ ... }),
    smsProvider: new TwilioSMSProvider({ ... }),
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Reading API Documentation

### Services

Service pages document methods with:

- TypeScript signatures (parameters and return types)
- Error codes with `NAuthException` details
- Framework-specific examples in tabs
- Links to related DTOs

### DTOs

DTO pages document request/response objects with:

- Properties table with validation rules
- JSON examples
- Links to services that use them

### Configuration

Configuration pages document settings with:

- Interface definitions
- Default values
- Validation rules

See [Configuration](/docs/concepts/configuration) for config options.

## API Stability

**Public APIs** (documented here) are stable and follow semantic versioning:

- Major versions for breaking changes
- Minor versions for new features
- Patch versions for bug fixes

**Internal APIs** (not documented) may change without notice.

## Quick Links

**Getting Started:**

- [Quick Start Guide](/docs/quick-start/nestjs)
- [Configuration Reference](/docs/concepts/configuration)
- [How It Works](/docs/concepts/how-it-works)

**Need Help?**

- npm package: https://www.npmjs.com/package/@nauth-toolkit/core
- Source: https://github.com/noorixorg/nauth-toolkit
