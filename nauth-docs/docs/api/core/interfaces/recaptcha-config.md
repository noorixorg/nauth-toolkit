---
title: RecaptchaConfig
description: Configuration interface for Google reCAPTCHA v2/v3/Enterprise bot protection
keywords: [recaptcha, config, interface, bot-protection, security]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RecaptchaConfig

**Package:** `@nauth-toolkit/core`
**Type:** Interface (Configuration)

Configuration interface for Google reCAPTCHA bot protection.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthModuleConfig } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthConfig } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuthConfig } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable reCAPTCHA validation. When true, routes marked with `@RequireRecaptcha()` will enforce validation. |
| `minimumScore` | `number` | No | Minimum acceptable score for v3/Enterprise (0.0-1.0). Higher is stricter. Default: `0.5`. Only applies to v3/Enterprise. |
| `provider` | `RecaptchaProvider` | Yes | Provider implementation: `RecaptchaV2Provider`, `RecaptchaV3Provider`, or `RecaptchaEnterpriseProvider`. |

## Examples

### v3 (Recommended)

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
        minimumScore: 0.5,
      },
    }),
  ],
})
export class AppModule {}

// In your controller, mark protected endpoints:
@Controller('auth')
export class AuthController {
  @Public()
  @RequireRecaptcha()
  @Post('login')
  async login(@Body() dto: LoginDTO) {
    return this.authService.login(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuth } from '@nauth-toolkit/core';
import { ExpressAdapter } from '@nauth-toolkit/express';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

const nauth = await NAuth.create({
  config: {
    recaptcha: {
      enabled: true,
      provider: new RecaptchaV3Provider({
        secretKey: process.env.RECAPTCHA_V3_SECRET_KEY!,
      }),
      minimumScore: 0.5,
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth } from '@nauth-toolkit/core';
import { FastifyAdapter } from '@nauth-toolkit/fastify';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';

const nauth = await NAuth.create({
  config: {
    recaptcha: {
      enabled: true,
      provider: new RecaptchaV3Provider({
        secretKey: process.env.RECAPTCHA_V3_SECRET_KEY!,
      }),
      minimumScore: 0.5,
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

### Enterprise

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
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
        minimumScore: 0.7, // Stricter for enterprise
      },
    }),
  ],
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuth } from '@nauth-toolkit/core';
import { ExpressAdapter } from '@nauth-toolkit/express';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

const nauth = await NAuth.create({
  config: {
    recaptcha: {
      enabled: true,
      provider: new RecaptchaEnterpriseProvider({
        projectId: process.env.RECAPTCHA_PROJECT_ID!,
        apiKey: process.env.RECAPTCHA_API_KEY!,
        siteKey: process.env.RECAPTCHA_SITE_KEY!,
      }),
      minimumScore: 0.7,
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth } from '@nauth-toolkit/core';
import { FastifyAdapter } from '@nauth-toolkit/fastify';
import { RecaptchaEnterpriseProvider } from '@nauth-toolkit/recaptcha';

const nauth = await NAuth.create({
  config: {
    recaptcha: {
      enabled: true,
      provider: new RecaptchaEnterpriseProvider({
        projectId: process.env.RECAPTCHA_PROJECT_ID!,
        apiKey: process.env.RECAPTCHA_API_KEY!,
        siteKey: process.env.RECAPTCHA_SITE_KEY!,
      }),
      minimumScore: 0.7,
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Related

- [RecaptchaV2Provider](../../recaptcha/providers/recaptcha-v2-provider) - Checkbox-based
- [RecaptchaV3Provider](../../recaptcha/providers/recaptcha-v3-provider) - Score-based
- [RecaptchaEnterpriseProvider](../../recaptcha/providers/recaptcha-enterprise-provider) - Enterprise features
- [reCAPTCHA Guide](/docs/guides/recaptcha) - Complete implementation guide
