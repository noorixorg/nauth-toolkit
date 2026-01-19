---
title: RecaptchaV2Provider
description: Google reCAPTCHA v2 checkbox provider for bot protection
keywords: [recaptcha, v2, checkbox, provider, bot-protection]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RecaptchaV2Provider

**Package:** `@nauth-toolkit/recaptcha`
**Type:** Provider Class

Checkbox-based reCAPTCHA provider requiring explicit user interaction.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
</Tabs>

## Constructor

```typescript
new RecaptchaV2Provider(config: RecaptchaV2Config)
```

### RecaptchaV2Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `secretKey` | `string` | Yes | Secret key from Google reCAPTCHA admin console. |
| `timeout` | `number` | No | Request timeout in milliseconds. Default: `10000`. |

## Methods

### verify()

Verify reCAPTCHA v2 token with Google's API.

```typescript
async verify(token: string, remoteIp?: string): Promise<RecaptchaVerificationResult>
```

**Parameters**

- `token` - reCAPTCHA token from client
- `remoteIp` - Client IP address (optional, recommended)

**Returns**

- `RecaptchaVerificationResult` - Verification result with success status

## Example

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthModule } from '@nauth-toolkit/nestjs';
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';

@Module({
  imports: [
    NAuthModule.forRoot({
      recaptcha: {
        enabled: true,
        provider: new RecaptchaV2Provider({
          secretKey: process.env.RECAPTCHA_V2_SECRET_KEY!,
        }),
        enforceFor: ['cookies'],
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
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';

const nauth = createNAuthInstance({
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV2Provider({
      secretKey: process.env.RECAPTCHA_V2_SECRET_KEY!,
    }),
    enforceFor: ['cookies'],
  },
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { createNAuthInstance } from '@nauth-toolkit/core';
import { RecaptchaV2Provider } from '@nauth-toolkit/recaptcha';

const nauth = createNAuthInstance({
  recaptcha: {
    enabled: true,
    provider: new RecaptchaV2Provider({
      secretKey: process.env.RECAPTCHA_V2_SECRET_KEY!,
    }),
    enforceFor: ['cookies'],
  },
});
```

</TabItem>
</Tabs>

## When to Use

- Acceptable user friction (checkbox interaction)
- Simple bot protection without scoring
- Lower setup complexity than v3/Enterprise

## Setup

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Create a new site with reCAPTCHA v2 checkbox
3. Add your domains (including `localhost` for development)
4. Copy the secret key for backend configuration
5. Copy the site key for frontend integration

## Related

- [RecaptchaConfig](../../core/interfaces/recaptcha-config) - Configuration interface
- [RecaptchaV3Provider](./recaptcha-v3-provider) - Score-based alternative
- [reCAPTCHA Guide](/docs/guides/recaptcha) - Complete implementation guide
