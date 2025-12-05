---
title: Facebook Provider
description: Facebook Login social authentication provider
keywords: [social, oauth, facebook, api]
image: /img/api-social-card.png
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Facebook Provider

**Package:** `@nauth-toolkit/social-facebook`
**Type:** Social Auth Provider

```bash npm2yarn
npm install @nauth-toolkit/social-facebook
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `FacebookSocialAuthProvider` | Class | Default |
| `FacebookSocialAuthModule` | NestJS Module | `/nestjs` |

## Constructor

```typescript
new FacebookSocialAuthProvider(options: FacebookSocialAuthOptions)
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | Yes | Facebook App ID |
| `clientSecret` | `string` | Yes | Facebook App Secret |
| `redirectUri` | `string` | Yes | OAuth callback URL |
| `scopes` | `string[]` | No | OAuth scopes. Default: `['email', 'public_profile']` |

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { FacebookSocialAuthModule } from '@nauth-toolkit/social-facebook/nestjs';

@Module({
  imports: [AuthModule.forRoot(config), FacebookSocialAuthModule],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { FacebookSocialAuthProvider } from '@nauth-toolkit/social-facebook';

const nauth = await NAuth.create({
  config: {
    socialProviders: [
      new FacebookSocialAuthProvider({
        clientId: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        redirectUri: 'https://myapp.com/auth/facebook/callback',
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
import { FacebookSocialAuthProvider } from '@nauth-toolkit/social-facebook';

const nauth = await NAuth.create({
  config: {
    socialProviders: [
      new FacebookSocialAuthProvider({
        clientId: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        redirectUri: 'https://myapp.com/auth/facebook/callback',
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
| `id` | `string` | Facebook user ID |
| `email` | `string?` | Email (if permission granted) |
| `name` | `string` | Display name |
| `picture` | `string` | Profile picture URL |

## Related

- [SocialAuthService](/docs/api/core/services/social-auth-service)
- [Social Auth](/docs/api/social/overview)
