---
title: reCAPTCHA Package
description: Google reCAPTCHA v2/v3/Enterprise provider package for bot protection
keywords: [recaptcha, bot-protection, security, v2, v3, enterprise, provider]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# reCAPTCHA Package

**Package:** `@nauth-toolkit/recaptcha`  
**Type:** Provider Package

Google reCAPTCHA bot protection with support for v2 (checkbox), v3 (score-based), and Enterprise.

## Installation

````bash npm2yarn
npm install @nauth-toolkit/recaptcha
```
````

## Quick Start

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

## Providers

- [RecaptchaV2Provider](./providers/recaptcha-v2-provider) - Checkbox-based verification
- [RecaptchaV3Provider](./providers/recaptcha-v3-provider) - Score-based, invisible
- [RecaptchaEnterpriseProvider](./providers/recaptcha-enterprise-provider) - Advanced Enterprise features

## Version Comparison

| Feature | v2 | v3 | Enterprise |
|---------|----|----|-----------|
| User Interaction | Yes (checkbox) | No | No |
| Score-based | No | Yes | Yes |
| Custom Rules | No | No | Yes |
| Analytics | Basic | Basic | Advanced |
| SLA | No | No | Yes |
| Setup Complexity | Low | Medium | High |

## When to Use

- **v2**: Simple protection, acceptable user friction
- **v3**: Invisible protection, score-based decisions
- **Enterprise**: High-traffic, advanced security, compliance needs

## Related

- [RecaptchaConfig Interface](../core/interfaces/recaptcha-config) - Configuration options
- [reCAPTCHA Guide](/docs/guides/recaptcha) - Complete implementation guide
