---
title: Console
description: Console email provider for development and testing
keywords: [email, console, development, testing, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Console Email Provider

**Package:** `@nauth-toolkit/email-console`
**Type:** Email Provider (Development)

Logs emails to console instead of sending. Development and testing only.

```bash npm2yarn
npm install @nauth-toolkit/email-console
```

:::warning
**Development only.** Never use in production.
:::

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

AuthModule.forRoot({
  emailProvider: new ConsoleEmailProvider(),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';

const nauth = await NAuth.create({
  config: {
    emailProvider: new ConsoleEmailProvider(),
  },
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';
import { FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({
  config: {
    emailProvider: new ConsoleEmailProvider(),
  },
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## Console Output

```
========================================
EMAIL: Verify your email
TO: user@example.com
----------------------------------------
Your verification code is: 123456
========================================
```

## Related

- [Email Overview](./overview)
- [Nodemailer](./nodemailer) - Production provider
