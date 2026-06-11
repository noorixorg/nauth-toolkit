---
title: TOTP Provider
description: Time-based One-Time Password MFA provider
keywords: [mfa, totp, authenticator, google-authenticator, api]
image: /img/api-social-card.png
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
| `TOTPService` | Service | Default |
| `TOTPMFAModule` | NestJS Module | `/nestjs` |

## Configuration

### `mfa.totp` options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `window` | `number` | `1` | Validation window (codes before/after) |
| `stepSeconds` | `number` | `30` | Code rotation interval |
| `digits` | `number` | `6` | Code length |
| `algorithm` | `'sha1' \| 'sha256' \| 'sha512'` | `'sha1'` | Hash algorithm |

### `mfa` top-level options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `issuer` | `string` | `'nauth-toolkit'` | Issuer name displayed in authenticator apps (e.g. Google Authenticator, Authy) |

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

### During Authentication Challenge (`MFA_SETUP_REQUIRED`)

1. Frontend calls `getSetupData(session, 'totp')` via SDK
2. Backend returns: `{ secret, qrCode, manualEntryKey, issuer, accountName }`
3. Frontend displays QR code to user
4. User scans QR code with authenticator app (Google Authenticator, Authy, etc.)
5. User enters 6-digit code from authenticator app
6. Frontend calls `respondToChallenge()` with both `secret` and `code` in `setupData`
7. Backend verifies code and creates MFA device

**Note:** The SDK validates that both `secret` and `code` are present before sending the request.

### For Authenticated Users (MFA Management)

1. Call `mfaService.setupDevice(userId, 'totp')`
2. Returns QR code data URL and secret
3. User scans QR in authenticator app
4. User submits code to verify setup via `mfaService.verifyMfaSetup()`

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [MFA](/docs/api/mfa/overview)
