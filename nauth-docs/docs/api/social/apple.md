---
title: Apple Provider
description: Sign in with Apple social authentication provider
keywords: [social, oauth, apple, api]
image: /img/api-social-card.png
sidebar_position: 2
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
| `AppleSocialAuthProvider` | Class | Default |
| `AppleSocialAuthModule` | NestJS Module | `/nestjs` |

## Constructor

```typescript
new AppleSocialAuthProvider(options: AppleSocialAuthOptions)
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | Yes | Apple Services ID |
| `teamId` | `string` | Yes | Apple Developer Team ID |
| `keyId` | `string` | Yes | Sign in with Apple key ID |
| `privateKey` | `string` | Yes | Private key (PEM format) |
| `redirectUri` | `string` | Yes | OAuth callback URL |

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
import { AppleSocialAuthProvider } from '@nauth-toolkit/social-apple';

const nauth = await NAuth.create({
  config: {
    socialProviders: [
      new AppleSocialAuthProvider({
        clientId: process.env.APPLE_CLIENT_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        keyId: process.env.APPLE_KEY_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
        redirectUri: 'https://myapp.com/auth/apple/callback',
      }),
    ],
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AppleSocialAuthProvider } from '@nauth-toolkit/social-apple';

const nauth = await NAuth.create({
  config: {
    socialProviders: [
      new AppleSocialAuthProvider({
        clientId: process.env.APPLE_CLIENT_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        keyId: process.env.APPLE_KEY_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
        redirectUri: 'https://myapp.com/auth/apple/callback',
      }),
    ],
  },
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
