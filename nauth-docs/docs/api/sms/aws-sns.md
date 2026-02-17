---
title: AWS SNS
description: AWS SNS and End User Messaging SMS provider for phone verification
keywords: [sms, aws, sns, phone, api, end user messaging, configuration set]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AWS SNS Provider

**Package:** `@nauth-toolkit/sms-aws-sns`
**Type:** SMS Provider

Sends SMS via AWS SNS (legacy) or AWS End User Messaging SMS. Use `apiMode` to choose; End User Messaging supports configuration sets for delivery events.

**Install (SNS mode only):**

```bash npm2yarn
npm install @nauth-toolkit/sms-aws-sns @aws-sdk/client-sns
```

**Install (End User Messaging SMS mode, with configuration sets):**

```bash npm2yarn
npm install @nauth-toolkit/sms-aws-sns @aws-sdk/client-sns @aws-sdk/client-pinpoint-sms-voice-v2
```

## Configuration

<Tabs groupId="api-mode">
<TabItem value="sns" label="SNS (legacy)" default>

```typescript
import { AWSSMSProvider, AWSSMSConfig } from '@nauth-toolkit/sms-aws-sns';

const config: AWSSMSConfig = {
  region: 'us-east-1',
  originationNumber: '+12345678901', // Or sender ID: 'MyApp'
  // apiMode defaults to 'sns'
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const smsProvider = new AWSSMSProvider(config);
```

</TabItem>
<TabItem value="end-user-messaging" label="End User Messaging SMS">

```typescript
import { AWSSMSProvider, AWSSMSConfig } from '@nauth-toolkit/sms-aws-sns';

const config: AWSSMSConfig = {
  region: 'ap-southeast-2',
  originationNumber: 'anyspaces', // Sender ID or pool ID
  apiMode: 'end-user-messaging-sms',
  configurationSetName: 'default', // Optional; for delivery events to SNS/CloudWatch
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const smsProvider = new AWSSMSProvider(config);
```

</TabItem>
</Tabs>

## AWSSMSConfig

| Property               | Type                                | Required | Description                                                                                 |
| ---------------------- | ----------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `region`               | `string`                            | Yes      | AWS region (e.g., `us-east-1`, `ap-southeast-2`)                                            |
| `originationNumber`    | `string`                            | Yes      | Phone number (`+1...`), sender ID, or pool/sender ARN                                       |
| `apiMode`              | `'sns' \| 'end-user-messaging-sms'` | No       | `sns` (default) or `end-user-messaging-sms`. Use End User Messaging for configuration sets. |
| `configurationSetName` | `string`                            | No       | Configuration set name. Only used when `apiMode: 'end-user-messaging-sms'`.                 |
| `accessKeyId`          | `string`                            | No       | AWS access key (auto-discovered if omitted)                                                 |
| `secretAccessKey`      | `string`                            | No       | AWS secret (required if accessKeyId provided)                                               |

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
AuthModule.forRoot({
  smsProvider: new AWSSMSProvider({
    region: 'us-east-1',
    originationNumber: '+12345678901',
    // apiMode: 'end-user-messaging-sms',
    // configurationSetName: 'default',
  }),
});
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

## API mode and configuration sets

- **`apiMode: 'sns'`** (default): Uses SNS Publish. No configuration set support. Backward compatible.
- **`apiMode: 'end-user-messaging-sms'`**: Uses AWS End User Messaging SMS. Set `configurationSetName` to attach a configuration set to each message.

**For configuration set events to be logged or delivered:**

1. Create the configuration set in AWS (End User Messaging SMS → Configuration sets), if it does not exist.
2. Add at least one **event destination** to that configuration set (e.g. SNS topic, CloudWatch, or Kinesis). Without an event destination, the set is attached to the message but no events are sent anywhere.
3. In AWS Console: open the configuration set → **Event destinations** → **Add destination** → choose SNS (or CloudWatch/Kinesis) and select or create the topic/stream.

The provider sends `ConfigurationSetName` on every `SendTextMessage` call when `configurationSetName` is set; events only appear where you configured them in the set.

### Protect configuration

If your configuration set (or origination) is associated with an AWS **protect configuration**, it can block certain destination countries or numbers. Errors such as `DESTINATION_COUNTRY_BLOCKED_BY_PROTECT_CONFIGURATION` mean the destination is not allowed by that protect configuration. Fix this in AWS: open End User Messaging SMS, edit the protect configuration to allow the destination country, or disassociate the protect configuration from the configuration set if you do not need it.

## Credential Discovery

AWS SDK auto-discovers credentials from:

1. IAM instance role (EC2, ECS, Lambda)
2. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
3. AWS credentials file (`~/.aws/credentials`)
4. AWS profile (`AWS_PROFILE` environment variable)

## IAM permissions

Grant the following according to the API mode you use.

### SNS mode (`apiMode: 'sns'` or default)

| Action        | Resource | Description               |
| ------------- | -------- | ------------------------- |
| `sns:Publish` | `*`      | Send SMS to phone numbers |

Example policy (SNS only):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "*"
    }
  ]
}
```

### End User Messaging SMS mode (`apiMode: 'end-user-messaging-sms'`)

| Action                      | Resource  | Description                     |
| --------------------------- | --------- | ------------------------------- |
| `sms-voice:SendTextMessage` | See below | Send SMS via End User Messaging |

`SendTextMessage` must be allowed on the origination identity (phone number, pool, or sender ID) you use. Use one of the following resource ARN patterns, or `*` for any origination identity in the account:

- Phone number: `arn:aws:sms-voice:region:accountId:phone-number/phoneNumberId`
- Pool: `arn:aws:sms-voice:region:accountId:pool/poolId`
- Sender ID: `arn:aws:sms-voice:region:accountId:sender-id/senderId/isoCountryCode`

Example policy (End User Messaging, least privilege with a specific sender ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sms-voice:SendTextMessage",
      "Resource": "arn:aws:sms-voice:ap-southeast-2:ACCOUNT_ID:sender-id/xxxx/xx"
    }
  ]
}
```

Example policy (End User Messaging, any origination identity in account):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sms-voice:SendTextMessage",
      "Resource": "*"
    }
  ]
}
```

### Using both modes

If you might use either mode (e.g. different environments), include both actions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "sms-voice:SendTextMessage",
      "Resource": "*"
    }
  ]
}
```

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
