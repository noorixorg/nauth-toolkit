---
title: Core Services
description: 'Service index: AuthService (login, signup, passwords, sessions), AdminAuthService, MFAService, SocialAuthService, AuthAuditService, EmailVerificationService, PhoneVerificationService, ClientInfoService, CsrfService, GeoLocationService, HookRegistryService'
sidebar_position: 1
sidebar_label: Overview
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Core Services

Platform-agnostic services that power nauth-toolkit. These services work with any Node.js framework.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthService } from '@nauth-toolkit/core';
// Access via nauth.authService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthService } from '@nauth-toolkit/core';
// Access via nauth.authService after NAuth.create()
```

</TabItem>
</Tabs>

## Authentication Core

| Service                       | Description                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| [AuthService](./auth-service) | Main authentication orchestration - signup, login, password management |

## Audit & Logging

| Service                                  | Description                                                |
| ---------------------------------------- | ---------------------------------------------------------- |
| [AuthAuditService](./auth-audit-service) | Audit trail logging for authentication and security events |

## Client Information & Security

| Service                                    | Description                                         |
| ------------------------------------------ | --------------------------------------------------- |
| [ClientInfoService](./client-info-service) | Extract IP address, user-agent, and session context |
| [CsrfService](./csrf-service) | CSRF token generation and validation |
| [GeoLocationService](./geo-location-service) | IP geolocation using MaxMind GeoIP2 (optional, requires configuration) |

## Multi-Factor Authentication

| Service                     | Description                             |
| --------------------------- | --------------------------------------- |
| [MFAService](./mfa-service) | MFA provider registry and orchestration |

## Social Authentication

| Service                                    | Description                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| [SocialAuthService](./social-auth-service) | Complete API for OAuth authentication, account linking, and management |

## Verification Services

| Service                                                  | Description                                           |
| -------------------------------------------------------- | ----------------------------------------------------- |
| [EmailVerificationService](./email-verification-service) | Email verification code generation and validation     |
| [PhoneVerificationService](./phone-verification-service) | Phone/SMS verification code generation and validation |

## Usage Pattern

All services are injected and configured automatically by the framework adapter:

<Tabs groupId="platform">
  <TabItem value="nestjs" label="NestJS" default>

```typescript
import { Injectable } from '@nestjs/common';
import { AuthService } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private readonly authService: AuthService) {}

  async example() {
    const result = await this.authService.signup({
      email: 'user@example.com',
      password: 'SecurePassword123!',
    });
  }
}
```

  </TabItem>
  <TabItem value="express" label="Express">

```typescript
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new ExpressAdapter(),
});

// Access services from nauth instance
const result = await nauth.authService.signup({
  email: 'user@example.com',
  password: 'SecurePassword123!',
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: authConfig,
  dataSource,
  adapter: new FastifyAdapter(),
});

// Access services from nauth instance (wrap handlers with nauth.adapter.wrapRouteHandler)
fastify.post(
  '/signup',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => {
    return nauth.authService.signup(req.body);
  }),
);
```

  </TabItem>
</Tabs>

## Related Documentation

- [Configuration](/docs/concepts/configuration) - Configure services
- [DTOs](/docs/api/core/dto/overview) - Data transfer objects
- [Challenge System](/docs/concepts/challenge-system) - Understanding challenge flows
