---
title: Passkey Provider
description: WebAuthn/FIDO2 passkey MFA provider
keywords: [mfa, passkey, webauthn, fido2, biometric, api]
image: /img/api-social-card.png
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Passkey Provider

**Package:** `@nauth-toolkit/mfa-passkey`
**Type:** MFA Provider

```bash npm2yarn
npm install @nauth-toolkit/mfa-passkey
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `PasskeyMFAProviderService` | Service | Default |
| `PasskeyMFAModule` | NestJS Module | `/nestjs` |

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `rpName` | `string` | Relying party display name |
| `rpId` | `string` | Relying party ID (domain) |
| `origin` | `string[]` | Allowed origins |
| `timeout` | `number` | Timeout in milliseconds |
| `userVerification` | `string` | `'preferred'` \| `'required'` \| `'discouraged'` |

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { PasskeyMFAModule } from '@nauth-toolkit/mfa-passkey/nestjs';

@Module({
  imports: [
    AuthModule.forRoot({
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.PASSKEY],
        passkey: {
          rpName: 'My App',
          rpId: 'myapp.com',
          origin: ['https://myapp.com'],
          timeout: 60000,
          userVerification: 'preferred',
        },
      },
    }),
    PasskeyMFAModule,
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
      allowedMethods: [MFAMethod.PASSKEY],
      passkey: {
        rpName: 'My App',
        rpId: 'myapp.com',
        origin: ['https://myapp.com'],
        timeout: 60000,
        userVerification: 'preferred',
      },
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
      allowedMethods: [MFAMethod.PASSKEY],
      passkey: {
        rpName: 'My App',
        rpId: 'myapp.com',
        origin: ['https://myapp.com'],
        timeout: 60000,
        userVerification: 'preferred',
      },
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Setup Flow

1. Call `mfaService.setupDevice(userId, 'passkey')`
2. Returns WebAuthn registration options
3. Browser creates credential
4. Submit attestation to complete setup

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [MFA](/docs/api/mfa/overview)
