---
title: '@RequireRecaptcha()'
description: Method decorator that marks a NestJS route as requiring reCAPTCHA validation, even when not globally enabled.
keywords: [nestjs, decorator, recaptcha, security, bot-protection, api]
image: /img/api-social-card.png
---
# @RequireRecaptcha()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Method Decorator

```typescript
import { RequireRecaptcha } from '@nauth-toolkit/nestjs';
```

## Overview

`@RequireRecaptcha()` explicitly marks a route as requiring reCAPTCHA validation. It sets the `NAUTH_REQUIRE_RECAPTCHA` metadata key on the route handler, which is read by the reCAPTCHA middleware during request processing.

**Use cases:**
- Login and signup endpoints
- Password reset requests
- Account deletion
- Any public endpoint vulnerable to bot attacks

## Usage

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Public, RequireRecaptcha, AuthService, LoginDTO } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @RequireRecaptcha()
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('signup')
  @RequireRecaptcha()
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }
}
```

## How It Works

`@RequireRecaptcha()` sets metadata on the route using NestJS's `SetMetadata`:

```typescript
export const REQUIRE_RECAPTCHA_KEY = 'NAUTH_REQUIRE_RECAPTCHA';
export const RequireRecaptcha = () => SetMetadata(REQUIRE_RECAPTCHA_KEY, true);
```

The nauth-toolkit reCAPTCHA middleware reads this metadata and enforces reCAPTCHA validation for the request, regardless of the global configuration.

## reCAPTCHA Configuration

To use this decorator, reCAPTCHA must be configured in `NAuthConfig`:

```typescript
AuthModule.forRoot({
  recaptcha: {
    provider: new RecaptchaV3Provider({
      secretKey: process.env.RECAPTCHA_SECRET_KEY,
    }),
    // enforceGlobally: false — only enforce on @RequireRecaptcha() routes
  },
});
```

## Related

- [`@nauth-toolkit/recaptcha`](/docs/api/recaptcha/overview) - reCAPTCHA provider packages
- [`RecaptchaV3Provider`](/docs/api/recaptcha/providers/recaptcha-v3-provider) - v3 provider
- [`RecaptchaV2Provider`](/docs/api/recaptcha/providers/recaptcha-v2-provider) - v2 provider
- [`skipRecaptcha()` helper](/docs/api/express/overview#skiprecaptcha) - Express/Fastify helper to bypass reCAPTCHA
