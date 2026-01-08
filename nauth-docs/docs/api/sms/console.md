---
title: Console
description: Console SMS provider for development and testing
keywords: [sms, console, development, testing, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Console SMS Provider

**Package:** `@nauth-toolkit/sms-console`
**Type:** SMS Provider (Development)

Logs SMS messages to console instead of sending real SMS.

```bash npm2yarn
npm install @nauth-toolkit/sms-console
```

:::warning
**Development only.** Never use in production - exposes verification codes in logs.
:::

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

AuthModule.forRoot({
  smsProvider: new ConsoleSMSProvider(),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

const nauth = await NAuth.create({
  config: {
    smsProvider: new ConsoleSMSProvider(),
  },
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

const nauth = await NAuth.create({
  config: {
    smsProvider: new ConsoleSMSProvider(),
  },
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## Console Output

```
============================================================
SMS MESSAGE
============================================================
To: +1234567890
Message: Your verification code is: 123456
============================================================
```

## Test Storage

For E2E testing, store codes in a test database:

```typescript
const provider = new ConsoleSMSProvider();
provider.setStorageCallback(async (phone, code) => {
  await testDatabase.storeCode(phone, code);
});
```

## Templates

Customize SMS message content with templates:

```typescript
AuthModule.forRoot({
  smsProvider: new ConsoleSMSProvider(),
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
      },
      customTemplates: {
        verification: {
          content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

See [SMS Templates](/docs/features/sms-templates) for complete documentation.

## Related

- [SMS Overview](./overview)
- [SMS Templates Configuration](./templates)
- [AWS SNS](./aws-sns) - Production provider
