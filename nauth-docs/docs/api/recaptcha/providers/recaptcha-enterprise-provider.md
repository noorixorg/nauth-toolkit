---
title: RecaptchaEnterpriseProvider
description: Google reCAPTCHA Enterprise provider with advanced features and analytics
keywords: [recaptcha, enterprise, provider, bot-protection, security]
image: /img/api-social-card.png
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RecaptchaEnterpriseProvider

**Package:** `@nauth-toolkit/recaptcha`
**Type:** Provider Class

Enterprise-grade reCAPTCHA provider with advanced fraud detection and analytics.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';
```

</TabItem>
</Tabs>

## Constructor

```typescript
new RecaptchaEnterpriseProvider(config: RecaptchaEnterpriseConfig)
```

### RecaptchaEnterpriseConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `apiKey` | `string` | Yes | API key from Google Cloud Console with reCAPTCHA Enterprise API enabled. |
| `apiEndpoint` | `string` | No | Custom API endpoint for regional deployments. Default: `https://recaptchaenterprise.googleapis.com/v1`. |
| `projectId` | `string` | Yes | Google Cloud project ID. |
| `siteKey` | `string` | Yes | Site key from reCAPTCHA Enterprise console. |
| `timeout` | `number` | No | Request timeout in milliseconds. Default: `10000`. |

## Methods

### verify()

Verify reCAPTCHA Enterprise token with Google's API.

```typescript
async verify(token: string, remoteIp?: string, action?: string): Promise<RecaptchaVerificationResult>
```

**Parameters**

- `token` - reCAPTCHA token from client
- `remoteIp` - Client IP address (optional, recommended)
- `action` - Action name (e.g., 'login', 'signup')

**Returns**

- `RecaptchaVerificationResult` - Verification result with score and risk analysis

## Example

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
        minimumScore: 0.7, // Stricter for enterprise
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
    minimumScore: 0.7,
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
    minimumScore: 0.7,
  },
});
```

</TabItem>
</Tabs>

## Enterprise Features

- **Advanced fraud detection** - Machine learning-based bot detection
- **Custom rules** - Define custom security policies
- **Detailed analytics** - Real-time dashboards and reporting
- **SLA guarantees** - 99.9% uptime commitment
- **Priority support** - Dedicated support team

## Setup

### 1. Enable API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to APIs & Services → Library
4. Search for "reCAPTCHA Enterprise API"
5. Click Enable

### 2. Create Site Key

1. Go to [reCAPTCHA Enterprise Console](https://console.cloud.google.com/security/recaptcha)
2. Click Create Key
3. Select "Score-based" type
4. Add your domains (including `localhost` for development)
5. Copy the site key

### 3. Create API Key

1. Go to APIs & Services → Credentials
2. Click Create Credentials → API Key
3. Edit the key to restrict it:
   - API restrictions: Select "reCAPTCHA Enterprise API"
   - Application restrictions: Set to "None" for server-to-server calls
4. Copy the API key

### 4. Configure Backend

```bash
RECAPTCHA_PROJECT_ID=your-project-id
RECAPTCHA_API_KEY=AIzaSy...your-api-key
RECAPTCHA_SITE_KEY=6Le...your-site-key
```

## When to Use

- High-traffic production applications
- Advanced security requirements
- Compliance and auditing needs
- SLA guarantees required

## Related

- [RecaptchaConfig](../../core/interfaces/recaptcha-config) - Configuration interface
- [RecaptchaV3Provider](./recaptcha-v3-provider) - Standard v3 alternative
- [reCAPTCHA Guide](/docs/guides/recaptcha) - Complete implementation guide
