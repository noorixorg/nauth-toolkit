# @nauth-toolkit/sms-aws-sns

AWS SNS SMS provider for nauth-toolkit.

## Features

- ✅ **Platform-Agnostic** - Pure TypeScript, zero framework dependencies
- ✅ **AWS SNS** - Reliable SMS delivery via AWS Simple Notification Service
- ✅ **Transactional** - All messages sent with highest priority
- ✅ **Simple** - Minimal configuration, lean implementation
- ✅ **Configuration Sets** - Optional CloudWatch metrics and event tracking

## Installation

```bash
yarn add @nauth-toolkit/sms-aws-sns
```

**Note:** `@aws-sdk/client-sns` is automatically installed as a dependency.

## Usage

### With IAM Role (Recommended)

```typescript
import { AWSSMSProvider, AWSSMSConfig } from '@nauth-toolkit/sms-aws-sns';
import { AuthModule } from '@nauth-toolkit/nestjs';

// Credentials auto-discovered from IAM role (EC2, ECS, Lambda)
const config: AWSSMSConfig = {
  region: 'us-east-1',
  originationNumber: '+12345678901',
};

@Module({
  imports: [
    AuthModule.forRoot({
      sms: {
        provider: new AWSSMSProvider(config),
      },
    }),
  ],
})
export class AppModule {}
```

### With Explicit Credentials

```typescript
// If not using IAM role, provide credentials explicitly
const config: AWSSMSConfig = {
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  originationNumber: '+12345678901',
};
```

### With Configuration Set

```typescript
const config: AWSSMSConfig = {
  region: 'us-east-1',
  originationNumber: '+12345678901',
  configurationSetName: 'my-sms-tracking', // Optional: for CloudWatch metrics
};
```

## Configuration

### Required

- `region`: AWS Region (e.g., `'us-east-1'`)
- `originationNumber`: Phone number (E.164) or sender ID

### Optional

- `accessKeyId`: AWS Access Key ID (auto-discovered if not provided)
- `secretAccessKey`: AWS Secret Access Key (required if accessKeyId provided)
- `configurationSetName`: AWS SNS configuration set name

### Credential Discovery

AWS SDK automatically discovers credentials from:
1. **IAM Instance Role** (EC2, ECS, Lambda) - Recommended
2. **Environment Variables** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
3. **AWS Credentials File** (`~/.aws/credentials`)
4. **AWS Profile** (`AWS_PROFILE` environment variable)

Only provide `accessKeyId` and `secretAccessKey` if none of the above are available.

### Origination Number

**US/Canada** - Must use phone number:
```typescript
originationNumber: '+12345678901' // E.164 format
```

**Other Regions** - Can use sender ID:
```typescript
originationNumber: 'MyApp' // Alphanumeric, max 11 chars
```

## AWS Setup

### 1. IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "*"
    }
  ]
}
```

### 2. Origination Number

**US/Canada:**
- Go to AWS Console → Amazon Pinpoint → Phone numbers
- Request a phone number (long code or toll-free)
- Use in `originationNumber`

**Other Regions:**
- Can use alphanumeric sender ID (no setup required in most countries)

### 3. Configuration Set (Optional)

Configure in AWS Console for:
- CloudWatch metrics
- Delivery status tracking
- Event destinations (Kinesis, SQS)
- Spend limits

Reference the configuration set name in your config:
```typescript
configurationSetName: 'my-sms-tracking'
```

## Platform-Agnostic Design

This package is **framework-agnostic** and works with:

- ✅ **NestJS** (via `@nauth-toolkit/nestjs`)
- 🚧 **Express** (adapter coming soon)
- 🚧 **Fastify** (adapter coming soon)

The `AWSSMSProvider` is a pure TypeScript class with no framework dependencies.

## Related Packages

- `@nauth-toolkit/core` - Core authentication services
- `@nauth-toolkit/sms-console` - Console SMS provider (dev only)
- `@nauth-toolkit/nestjs` - NestJS adapter (for NestJS apps)

## License

MIT

