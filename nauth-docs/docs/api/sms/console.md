---
title: Console
description: Console SMS provider for development and testing
keywords: [sms, console, development, testing, api]
image: /img/api-social-card.png
sidebar_position: 2
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
  sms: {
    provider: new ConsoleSMSProvider(),
  },
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

const nauth = await NAuth.create({
  config: {
    sms: {
      provider: new ConsoleSMSProvider(),
    },
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
    sms: {
      provider: new ConsoleSMSProvider(),
    },
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

## Related

- [SMS Overview](./overview)
- [AWS SNS](./aws-sns) - Production provider
