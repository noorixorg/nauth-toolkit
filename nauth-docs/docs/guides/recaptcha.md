---
title: reCAPTCHA Bot Protection
description: Add Google reCAPTCHA v2/v3/Enterprise to protect login and signup endpoints from bots
keywords: [recaptcha, bot-protection, security, v2, v3, enterprise]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# reCAPTCHA Bot Protection

Protect login and signup endpoints from bots using Google reCAPTCHA. nauth-toolkit supports v2 (checkbox), v3 (score-based), and Enterprise.

## Overview

- **Backend**: Optional `@nauth-toolkit/recaptcha` package. Configure provider, `minimumScore`, and optional `actionScores` for v3/Enterprise.
- **Which routes enforce it**: with `enabled: true`, the shipped `signup` and `login` routes enforce automatically. Hand-written routes opt in with `@RequireRecaptcha()` (NestJS) or `nauth.helpers.requireRecaptcha()` (Express/Fastify).
- **Frontend**: Client sends `recaptchaToken` in login/signup requests. Angular SDK can auto-generate tokens for v3/Enterprise via `RecaptchaService` and `provideRecaptcha()`.

:::warning
`enabled: true` makes `signup` and `login` **reject requests without a valid token**. If you mount the shipped route bundles, ship the frontend token generation at the same time — otherwise sign-in and registration fail with `RECAPTCHA_REQUIRED`.
:::

## Backend Setup

### Installation

```bash npm2yarn
npm install @nauth-toolkit/recaptcha
```

### Configuration

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

@Module({
  imports: [
    AuthModule.forRoot({
      recaptcha: {
        enabled: true,
        provider: new RecaptchaEnterpriseProvider({
          projectId: process.env.RECAPTCHA_PROJECT_ID!,
          apiKey: process.env.RECAPTCHA_API_KEY!,
          siteKey: process.env.RECAPTCHA_SITE_KEY!,
        }),
        minimumScore: 0.5,
        actionScores: {       // Optional: per-action overrides
          login: 0.3,         // More permissive for returning users
          signup: 0.7,        // Stricter for new registrations
        },
      },
    }),
  ],
})
export class AppModule {}

// The shipped `routes` bundles already enforce on signup and login.
// For your own controllers, mark the endpoints that need protection:
import { RequireRecaptcha } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @Public()
  @RequireRecaptcha()  // Require reCAPTCHA for login
  @Post('login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }

  @Public()
  @RequireRecaptcha()  // Require reCAPTCHA for signup
  @Post('signup')
  async signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuth } from '@nauth-toolkit/core';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

const nauth = await NAuth.create(config, dataSource);
```

The `recaptcha` configuration is passed as part of the `config` object passed to `NAuth.create()`:

```typescript
recaptcha: {
  enabled: true,
  provider: new RecaptchaEnterpriseProvider({
    projectId: process.env.RECAPTCHA_PROJECT_ID!,
    apiKey: process.env.RECAPTCHA_API_KEY!,
    siteKey: process.env.RECAPTCHA_SITE_KEY!,
  }),
  minimumScore: 0.5,
  actionScores: {       // Optional: per-action overrides
    login: 0.3,
    signup: 0.7,
  },
},
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth } from '@nauth-toolkit/core';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

const nauth = await NAuth.create(config, dataSource);
```

The `recaptcha` configuration is passed as part of the `config` object passed to `NAuth.create()`:

```typescript
recaptcha: {
  enabled: true,
  provider: new RecaptchaEnterpriseProvider({
    projectId: process.env.RECAPTCHA_PROJECT_ID!,
    apiKey: process.env.RECAPTCHA_API_KEY!,
    siteKey: process.env.RECAPTCHA_SITE_KEY!,
  }),
  minimumScore: 0.5,
  actionScores: {       // Optional: per-action overrides
    login: 0.3,
    signup: 0.7,
  },
},
```

</TabItem>
</Tabs>

See [RecaptchaConfig](/docs/api/core/interfaces/recaptcha-config) for all options. For v2 or v3, use [RecaptchaV2Provider](/docs/api/recaptcha/providers/recaptcha-v2-provider) or [RecaptchaV3Provider](/docs/api/recaptcha/providers/recaptcha-v3-provider).

### Startup Validation

By default, nauth validates your reCAPTCHA credentials at startup by sending a probe request to Google's API. This catches misconfigured API keys, wrong project IDs, or disabled APIs before a real user hits the endpoint.

```typescript
recaptcha: {
  enabled: true,
  provider: new RecaptchaEnterpriseProvider({ /* ... */ }),
  validateOnStartup: 'warn',   // Default: log warning if credentials are invalid
  // validateOnStartup: 'error',  // Halt startup on invalid credentials
  // validateOnStartup: false,    // Skip validation entirely
},
```

| Mode | Behavior |
|------|----------|
| `'warn'` (default) | Logs a warning with actionable hint, continues startup |
| `'error'` | Throws `NAuthException` and halts startup |
| `false` | Skips validation entirely |

:::tip
Use `'error'` in production to fail fast on misconfigured credentials. Use `'warn'` during development when iterating on reCAPTCHA setup.
:::

## Frontend Setup

### Angular (v3/Enterprise)

1. Add `recaptcha` to [NAuthClientConfig](/docs/frontend-sdk/api/nauth-client-config) and use `provideRecaptcha()`:

```typescript
import { provideRecaptcha } from '@nauth-toolkit/client-angular/standalone';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: NAUTH_CLIENT_CONFIG, useValue: { baseUrl: '...', tokenDelivery: 'cookies', recaptcha: { enabled: true, version: 'enterprise', siteKey: '...' } } },
    provideRecaptcha({ enabled: true, version: 'enterprise', siteKey: '...' }),
    // ...
  ],
};
```

2. `AuthService.login()` and `signup()` automatically obtain and send the token. No changes needed in login/signup components.

### Vanilla / React / Vue

1. Load the reCAPTCHA script: for Enterprise `https://www.google.com/recaptcha/enterprise.js?render=YOUR_SITE_KEY`, for v3 `https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY`.
2. Before calling `client.login()` or `client.signup()`, run `grecaptcha.enterprise.execute(siteKey, { action: 'login' })` (or `grecaptcha.execute` for v3) and pass the result as `recaptchaToken` in the request or as the third argument to `login(identifier, password, recaptchaToken)`.

## Google Cloud Setup (Enterprise)

1. Enable **reCAPTCHA Enterprise API** in Google Cloud Console.
2. Create a **Score-based** site key in [reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha). Add domains (e.g. `localhost`, your production domain).
3. Create an **API key** in APIs & Services > Credentials. Restrict it to **reCAPTCHA Enterprise API**. For server-to-server calls, do not use HTTP referrer restrictions (use None or IP).
4. Set env: `RECAPTCHA_PROJECT_ID`, `RECAPTCHA_API_KEY`, `RECAPTCHA_SITE_KEY`.

## Security

- Keep API keys and secret keys server-side only. Only the site key is public.
- The shipped `signup` and `login` routes enforce automatically once `enabled` is true. Only `AuthService.signup()` and `AuthService.login()` validate a token, so marking any other route has no effect until that route calls one of them.
- Use the `@RequireRecaptcha()` decorator on your own public endpoints vulnerable to bot attacks.
- Set `minimumScore` based on your risk tolerance (0.5 is a common default). Use `actionScores` for per-action thresholds.
- Score checks only apply when the provider returns a score (v3/Enterprise score-based keys). Enterprise checkbox keys skip score validation automatically.

## Related

- [RecaptchaConfig](/docs/api/core/interfaces/recaptcha-config)
- [reCAPTCHA Overview](/docs/api/recaptcha/overview)
- [NAuthClientConfig](/docs/frontend-sdk/api/nauth-client-config) (`recaptcha` property)
- [Configuration](/docs/frontend-sdk/concepts/configuration) (reCAPTCHA section)
