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

- **Backend**: Optional `@nauth-toolkit/recaptcha` package. Configure provider, `enforceFor` (e.g. `['cookies']` for web only), and `minimumScore` for v3/Enterprise.
- **Frontend**: Client sends `recaptchaToken` in login/signup requests. Angular SDK can auto-generate tokens for v3/Enterprise via `RecaptchaService` and `provideRecaptcha()`.

## Backend Setup

### Installation

```bash npm2yarn
npm install @nauth-toolkit/recaptcha
```

### Configuration

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

@Module({
  imports: [
    NAuthModule.forRoot({
      recaptcha: {
        enabled: true,
        provider: new RecaptchaEnterpriseProvider({
          projectId: process.env.RECAPTCHA_PROJECT_ID!,
          apiKey: process.env.RECAPTCHA_API_KEY!,
          siteKey: process.env.RECAPTCHA_SITE_KEY!,
        }),
        enforceFor: ['cookies'],
        minimumScore: 0.5,
        skipInDevelopment: false,
      },
    }),
  ],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { createNAuthInstance } from '@nauth-toolkit/core';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

const nauth = createNAuthInstance({
  recaptcha: {
    enabled: true,
    provider: new RecaptchaEnterpriseProvider({
      projectId: process.env.RECAPTCHA_PROJECT_ID!,
      apiKey: process.env.RECAPTCHA_API_KEY!,
      siteKey: process.env.RECAPTCHA_SITE_KEY!,
    }),
    enforceFor: ['cookies'],
    minimumScore: 0.5,
  },
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { createNAuthInstance } from '@nauth-toolkit/core';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

const nauth = createNAuthInstance({
  recaptcha: {
    enabled: true,
    provider: new RecaptchaEnterpriseProvider({
      projectId: process.env.RECAPTCHA_PROJECT_ID!,
      apiKey: process.env.RECAPTCHA_API_KEY!,
      siteKey: process.env.RECAPTCHA_SITE_KEY!,
    }),
    enforceFor: ['cookies'],
    minimumScore: 0.5,
  },
});
```

</TabItem>
</Tabs>

See [RecaptchaConfig](/docs/api/core/interfaces/recaptcha-config) for all options. For v2 or v3, use [RecaptchaV2Provider](/docs/api/recaptcha/providers/recaptcha-v2-provider) or [RecaptchaV3Provider](/docs/api/recaptcha/providers/recaptcha-v3-provider).

## Frontend Setup

### Angular (v3/Enterprise)

1. Add `recaptcha` to [NAuthClientConfig](/docs/frontend-sdk/api/nauth-client-config) and use `provideRecaptcha()`:

```typescript
import { provideRecaptcha } from '@nauth-toolkit/client-angular/standalone';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: NAUTH_CLIENT_CONFIG, useValue: { baseUrl: '...', tokenDelivery: 'cookies', recaptcha: { enabled: true, version: 'enterprise', siteKey: '...', action: 'login' } } },
    provideRecaptcha({ enabled: true, version: 'enterprise', siteKey: '...', action: 'login' }),
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
- Use `enforceFor: ['cookies']` to exempt mobile/JSON clients if they use device attestation or lower bot risk.
- Set `minimumScore` based on your risk tolerance (0.5 is a common default).

## Related

- [RecaptchaConfig](/docs/api/core/interfaces/recaptcha-config)
- [reCAPTCHA Overview](/docs/api/recaptcha/overview)
- [NAuthClientConfig](/docs/frontend-sdk/api/nauth-client-config) (`recaptcha` property)
- [Configuration](/docs/frontend-sdk/configuration) (reCAPTCHA section)
