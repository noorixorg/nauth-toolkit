---
title: Google Provider
description: Google OAuth 2.0 social authentication provider
keywords: [social, oauth, google, api]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Google Provider

**Package:** `@nauth-toolkit/social-google`
**Type:** Social Auth Provider

```bash npm2yarn
npm install @nauth-toolkit/social-google
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `GoogleSocialAuthProvider` | Class | Default |
| `GoogleSocialAuthModule` | NestJS Module | `/nestjs` |

## Constructor

```typescript
new GoogleSocialAuthProvider(options: GoogleSocialAuthOptions)
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | Yes | Google OAuth client ID |
| `clientSecret` | `string` | Yes | Google OAuth client secret |
| `redirectUri` | `string` | Yes | OAuth callback URL |
| `scopes` | `string[]` | No | OAuth scopes. Default: `['email', 'profile']` |

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';

@Module({
  imports: [AuthModule.forRoot(config), GoogleSocialAuthModule],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GoogleSocialAuthProvider } from '@nauth-toolkit/social-google';

const nauth = await NAuth.create({
  config: {
    socialProviders: [
      new GoogleSocialAuthProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: 'https://myapp.com/auth/google/callback',
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
import { GoogleSocialAuthProvider } from '@nauth-toolkit/social-google';

const nauth = await NAuth.create({
  config: {
    socialProviders: [
      new GoogleSocialAuthProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: 'https://myapp.com/auth/google/callback',
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
| `id` | `string` | Google user ID |
| `email` | `string` | Email address |
| `emailVerified` | `boolean` | Email verified by Google |
| `name` | `string` | Display name |
| `picture` | `string` | Profile picture URL |

## Related

- [SocialAuthService](/docs/api/core/services/social-auth-service)
- [Social Auth](/docs/api/social/overview)
