---
title: RecaptchaV3Provider
description: Google reCAPTCHA v3 score-based provider for invisible bot protection
keywords: [recaptcha, v3, score, invisible, provider, bot-protection]
image: /img/api-social-card.png
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RecaptchaV3Provider

**Package:** `@nauth-toolkit/recaptcha`
**Type:** Provider Class

Score-based invisible reCAPTCHA provider without user interaction.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
</Tabs>

## Constructor

```typescript
new RecaptchaV3Provider(config: RecaptchaV3Config)
```

### RecaptchaV3Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `secretKey` | `string` | Yes | Secret key from Google reCAPTCHA admin console. |
| `timeout` | `number` | No | Request timeout in milliseconds. Default: `10000`. |

## Methods

### verify()

Verify reCAPTCHA v3 token with Google's API and return risk score.

```typescript
async verify(token: string, remoteIp?: string, action?: string): Promise<RecaptchaVerificationResult>
```

**Parameters**

- `token` - reCAPTCHA token from client
- `remoteIp` - Client IP address (optional, recommended)
- `action` - Action name (e.g., 'login', 'signup')

**Returns**

- `RecaptchaVerificationResult` - Verification result with success status and score (0.0-1.0)

## Example

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

@Module({
  imports: [
    NAuthModule.forRoot({
      recaptcha: {
        enabled: true,
        provider: new RecaptchaV3Provider({
          secretKey: process.env.RECAPTCHA_V3_SECRET_KEY!,
        }),
        minimumScore: 0.5, // Adjust based on your needs
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
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

const nauth = createNAuthInstance({
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV3Provider({
      secretKey: process.env.RECAPTCHA_V3_SECRET_KEY!,
    }),
    minimumScore: 0.5,
  },
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { createNAuthInstance } from '@nauth-toolkit/core';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

const nauth = createNAuthInstance({
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV3Provider({
      secretKey: process.env.RECAPTCHA_V3_SECRET_KEY!,
    }),
    minimumScore: 0.5,
  },
});
```

</TabItem>
</Tabs>

## Score-Based Validation

reCAPTCHA v3 returns a score between 0.0 and 1.0:

| Score Range | Interpretation | Recommended Action |
|-------------|---------------|-------------------|
| 0.9 - 1.0 | Very likely human | Allow |
| 0.7 - 0.9 | Likely human | Allow |
| 0.5 - 0.7 | Neutral | Allow with monitoring |
| 0.3 - 0.5 | Suspicious | Additional verification |
| 0.0 - 0.3 | Very likely bot | Block or challenge |

Configure `minimumScore` in [RecaptchaConfig](../../core/interfaces/recaptcha-config) based on your security vs UX trade-off:

- **0.3**: Permissive, fewer false positives
- **0.5**: Balanced (recommended)
- **0.7**: Strict, may block legitimate users

## When to Use

- Invisible protection without user friction
- Score-based decisions for flexibility
- Most web applications (recommended default)

## Setup

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Create a new site with reCAPTCHA v3
3. Add your domains (including `localhost` for development)
4. Copy the secret key for backend configuration
5. Copy the site key for frontend integration

## Related

- [RecaptchaConfig](../../core/interfaces/recaptcha-config) - Configuration interface
- [RecaptchaV2Provider](./recaptcha-v2-provider) - Checkbox alternative
- [RecaptchaEnterpriseProvider](./recaptcha-enterprise-provider) - Enterprise version
- [reCAPTCHA Guide](/docs/guides/recaptcha) - Complete implementation guide
