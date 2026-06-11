---
title: MFA
description: Multi-factor authentication providers for TOTP, SMS, Email, and Passkeys
keywords: [mfa, totp, sms, email, passkey, api]
image: /img/api-social-card.png
sidebar_position: 1
sidebar_label: Overview
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

## IMFAProviderService Interface

```typescript
interface IMFAProviderService {
  /** Unique method name for this provider (e.g., 'totp', 'sms', 'passkey') */
  readonly methodName: string;

  /** Check if this method is allowed by configuration */
  isMethodAllowed(): boolean;

  /** Initiate MFA setup. Returns provider-specific setup data. */
  setup(setupData?: unknown): Promise<unknown>;

  /** Verify setup and create MFA device. Returns device ID. */
  verifySetup(verificationData: unknown, deviceName?: string): Promise<number>;

  /** Verify MFA code/credential during authentication */
  verify(code: unknown, deviceId?: number): Promise<boolean>;

  /** Send challenge (SMS code, passkey options). Optional — not needed for TOTP. */
  sendChallenge?(challengeSessionId?: number): Promise<unknown>;

  /** Generate single-use backup recovery codes. Optional. */
  generateBackupCodes?(): Promise<string[]>;
}
```

## Providers

- [TOTP](/docs/api/mfa/totp)
- [SMS](/docs/api/mfa/sms)
- [Email](/docs/api/mfa/email)
- [Passkey](/docs/api/mfa/passkey)
