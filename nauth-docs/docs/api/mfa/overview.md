---
title: MFA
description: Multi-factor authentication providers for TOTP, SMS, Email, and Passkeys
keywords: [mfa, totp, sms, email, passkey, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MFA

**Type:** MFA Provider Packages

## Available Providers

| Package | Method | Installation |
|---------|--------|--------------|
| `@nauth-toolkit/mfa-totp` | TOTP (Authenticator apps) | `yarn add @nauth-toolkit/mfa-totp` |
| `@nauth-toolkit/mfa-sms` | SMS codes | `yarn add @nauth-toolkit/mfa-sms` |
| `@nauth-toolkit/mfa-email` | Email codes | `yarn add @nauth-toolkit/mfa-email` |
| `@nauth-toolkit/mfa-passkey` | WebAuthn/FIDO2 | `yarn add @nauth-toolkit/mfa-passkey` |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable MFA |
| `enforcement` | `string` | `'OPTIONAL'` | `'OPTIONAL'` \| `'REQUIRED'` \| `'ADAPTIVE'` |
| `allowedMethods` | `MFAMethod[]` | All | Allowed methods |
| `issuer` | `string` | App name | TOTP issuer name |

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
        enforcement: 'OPTIONAL',
        allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS],
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
      enforcement: 'OPTIONAL',
      allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS],
      issuer: 'My App',
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
      enforcement: 'OPTIONAL',
      allowedMethods: [MFAMethod.TOTP, MFAMethod.SMS],
      issuer: 'My App',
    },
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## MFAMethod Enum

```typescript
enum MFAMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  PASSKEY = 'passkey',
  BACKUP = 'backup',
}
```

## IMFAProvider Interface

```typescript
interface IMFAProvider {
  readonly method: MFAMethod;
  generateSetupData(userId: string): Promise<SetupData>;
  verifyCode(userId: string, code: string): Promise<boolean>;
  cleanup(userId: string): Promise<void>;
}
```

## Providers

- [TOTP](/docs/api/mfa/totp)
- [SMS](/docs/api/mfa/sms)
- [Email](/docs/api/mfa/email)
- [Passkey](/docs/api/mfa/passkey)
