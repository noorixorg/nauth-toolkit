---
title: Email MFA Provider
description: Email-based MFA provider
keywords: [mfa, email, verification, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Email MFA Provider

**Package:** `@nauth-toolkit/mfa-email`
**Type:** MFA Provider

```bash npm2yarn
npm install @nauth-toolkit/mfa-email
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `EmailMFAProviderService` | Service | Default |
| `EmailMFAModule` | NestJS Module | `/nestjs` |

## Requirements

Requires an email provider configured:

- `@nauth-toolkit/email-nodemailer`

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { EmailMFAModule } from '@nauth-toolkit/mfa-email/nestjs';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

@Module({
  imports: [
    AuthModule.forRoot({
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.EMAIL],
      },
      emailProvider: new NodemailerEmailProvider({ ... }),
    }),
    EmailMFAModule,
  ],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.EMAIL],
    },
    emailProvider: new NodemailerEmailProvider({
      transport: { host: 'smtp.example.com', port: 587, auth: { user, pass } },
    }),
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';

const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.EMAIL],
    },
    emailProvider: new NodemailerEmailProvider({
      transport: { host: 'smtp.example.com', port: 587, auth: { user, pass } },
    }),
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Setup Flow

1. User must have verified email
2. Call `mfaService.setupDevice(userId, 'email')`
3. Code sent to email
4. User submits code to verify

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [Email](/docs/api/email/overview)
- [MFA](/docs/api/mfa/overview)
