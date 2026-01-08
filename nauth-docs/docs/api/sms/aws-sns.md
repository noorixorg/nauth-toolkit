---
title: AWS SNS
description: AWS SNS SMS provider for phone verification
keywords: [sms, aws, sns, phone, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AWS SNS Provider

**Package:** `@nauth-toolkit/sms-aws-sns`
**Type:** SMS Provider

AWS Simple Notification Service provider for sending SMS messages.

```bash npm2yarn
npm install @nauth-toolkit/sms-aws-sns @aws-sdk/client-sns
```

## Configuration

```typescript
import { AWSSMSProvider, AWSSMSConfig } from '@nauth-toolkit/sms-aws-sns';

const config: AWSSMSConfig = {
  region: 'us-east-1',
  originationNumber: '+12345678901', // Or sender ID: 'MyApp'
  // Credentials optional - auto-discovered from IAM role/env
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  configurationSetName: 'my-sms-config', // Optional
};

const smsProvider = new AWSSMSProvider(config);
```

## AWSSMSConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `region` | `string` | Yes | AWS region (e.g., `us-east-1`) |
| `originationNumber` | `string` | Yes | Phone number (`+1...`) or sender ID |
| `accessKeyId` | `string` | No | AWS access key (auto-discovered if omitted) |
| `secretAccessKey` | `string` | No | AWS secret (required if accessKeyId provided) |
| `configurationSetName` | `string` | No | SNS configuration set name |

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
AuthModule.forRoot({
  smsProvider: new AWSSMSProvider({
    region: 'us-east-1',
    originationNumber: '+12345678901',
  }),
})
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const nauth = await NAuth.create({
  config: {
    smsProvider: new AWSSMSProvider({
      region: 'us-east-1',
      originationNumber: '+12345678901',
    }),
  },
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const nauth = await NAuth.create({
  config: {
    smsProvider: new AWSSMSProvider({
      region: 'us-east-1',
      originationNumber: '+12345678901',
    }),
  },
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## Credential Discovery

AWS SDK auto-discovers credentials from:
1. IAM instance role (EC2, ECS, Lambda)
2. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
3. AWS credentials file (`~/.aws/credentials`)
4. AWS profile (`AWS_PROFILE` environment variable)

## Origination Number

- **US/Canada:** Phone number required (`+12345678901`)
- **Other regions:** Alphanumeric sender ID supported (`MyApp`)

## Templates

Customize SMS message content with templates:

```typescript
AuthModule.forRoot({
  smsProvider: new AWSSMSProvider(config),
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
        supportPhone: '+1-800-123-4567',
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
- [Console SMS](./console) - Development provider

