---
title: Apple Provider
description: Sign in with Apple social authentication provider
keywords: [social, oauth, apple, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Apple Provider

**Package:** `@nauth-toolkit/social-apple`
**Type:** Social Auth Provider

```bash npm2yarn
npm install @nauth-toolkit/social-apple
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `AppleSocialAuthService` | Class | Default |
| `TokenVerifierService` | Class | Default |
| `AppleSocialAuthModule` | NestJS Module | `/nestjs` |

## Configuration

Configure Apple under `config.social.apple` (in `@nauth-toolkit/core` config).

Apple requires a JWT client secret for web OAuth, which is automatically generated and refreshed by the toolkit from your Apple Developer credentials. The JWT is stored in the database and refreshed when it has less than 30 days until expiration.

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | No | Enable Apple Sign-In |
| `clientId` | `string` | Yes (if enabled) | Apple Services ID (e.g., 'com.myapp.services') |
| `teamId` | `string` | Yes (if enabled for web) | Apple Developer Team ID (required for web OAuth) |
| `keyId` | `string` | Yes (if enabled for web) | Apple Key ID (kid) from your .p8 key (required for web OAuth) |
| `privateKeyPem` | `string` | Yes (if enabled for web) | Contents of your .p8 private key file in PEM format (required for web OAuth) |
| `callbackUrl` | `string` | Yes (if enabled) | Backend callback URL (`/auth/social/apple/callback`) |
| `scopes` | `string[]` | No | Default: `['name', 'email']` |
| `autoLink` | `boolean` | No | Auto-link to existing users by verified email |
| `allowSignup` | `boolean` | No | Allow creating new users on first login |
| `oauthParams` | `Record<string, string>` | No | Additional OAuth parameters to include in authorization URL. These act as defaults and can be overridden on a per-request basis. |

### OAuth Parameters

The `oauthParams` option allows you to customize the Apple OAuth authorization flow. These parameters are appended to Apple's authorization URL and can be overridden on a per-request basis from the frontend.

**Common Parameters:**
- `nonce`: For ID token validation and replay attack prevention
- Any other Apple-supported OAuth parameters

**Example:**

```typescript
social: {
  apple: {
    enabled: true,
    clientId: 'com.myapp.services',
    teamId: 'ABC123DEF4',
    keyId: 'XYZ789ABC0',
    privateKeyPem: process.env.APPLE_PRIVATE_KEY_PEM,
    callbackUrl: 'https://api.myapp.com/auth/social/apple/callback',
    scopes: ['name', 'email'],
    oauthParams: {
      nonce: 'default-nonce-value',  // For ID token validation
    },
  },
}
```

See [Social Login Guide](/docs/guides/social/how-social-login-works) for usage examples.

**Note:** For native iOS apps, `teamId`, `keyId`, and `privateKeyPem` are not required as native apps do not use the web OAuth flow.

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AppleSocialAuthModule } from '@nauth-toolkit/social-apple/nestjs';

@Module({
  imports: [AuthModule.forRoot(config), AppleSocialAuthModule],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const nauth = await NAuth.create({
  config,
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const nauth = await NAuth.create({
  config,
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Profile Data

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Apple user ID |
| `email` | `string` | Email (may be private relay) |
| `emailVerified` | `boolean` | Always `true` from Apple |
| `name` | `string?` | Only on first auth |

## Related

- [SocialAuthService](/docs/api/core/services/social-auth-service)
- [Social Auth](/docs/api/social/overview)
