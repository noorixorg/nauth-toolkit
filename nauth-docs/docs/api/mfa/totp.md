---
title: TOTP Provider
description: Time-based One-Time Password MFA provider
keywords: [mfa, totp, authenticator, google-authenticator, api]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TOTP Provider

**Package:** `@nauth-toolkit/mfa-totp`
**Type:** MFA Provider

```bash npm2yarn
npm install @nauth-toolkit/mfa-totp
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `TOTPMFAProviderService` | Service | Default |
| `TOTPMFAModule` | NestJS Module | `/nestjs` |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `window` | `number` | `1` | Validation window (codes before/after) |
| `stepSeconds` | `number` | `30` | Code rotation interval |
| `digits` | `number` | `6` | Code length |
| `algorithm` | `string` | `'sha1'` | Hash algorithm |

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { TOTPMFAModule } from '@nauth-toolkit/mfa-totp/nestjs';

@Module({
  imports: [
    AuthModule.forRoot({
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.TOTP],
        totp: { window: 1, stepSeconds: 30, digits: 6 },
      },
    }),
    TOTPMFAModule,
  ],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.TOTP],
      totp: { window: 1, stepSeconds: 30, digits: 6 },
    },
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.TOTP],
      totp: { window: 1, stepSeconds: 30, digits: 6 },
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Setup Flow

1. Call `mfaService.setupDevice(userId, 'totp')`
2. Returns QR code data URL and secret
3. User scans QR in authenticator app
4. User submits code to verify setup

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [MFA](/docs/api/mfa/overview)
