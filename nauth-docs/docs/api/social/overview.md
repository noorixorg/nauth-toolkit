---
title: Social Auth
description: OAuth providers for Google, Apple, and Facebook authentication
keywords: [social, oauth, google, apple, facebook, api]
image: /img/api-social-card.png
sidebar_position: 0
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Social Auth

**Type:** OAuth Provider Packages

## Available Providers

| Package | Provider | Installation |
|---------|----------|--------------|
| `@nauth-toolkit/social-google` | Google OAuth 2.0 | `yarn add @nauth-toolkit/social-google` |
| `@nauth-toolkit/social-apple` | Sign in with Apple | `yarn add @nauth-toolkit/social-apple` |
| `@nauth-toolkit/social-facebook` | Facebook Login | `yarn add @nauth-toolkit/social-facebook` |

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

## ISocialAuthProvider Interface

```typescript
interface ISocialAuthProvider {
  readonly name: string;
  getAuthUrl(state: string): Promise<string>;
  handleCallback(code: string): Promise<SocialUserProfile>;
  refreshToken?(refreshToken: string): Promise<TokenResponse>;
}
```

## Providers

- [Google](/docs/api/social/google)
- [Apple](/docs/api/social/apple)
- [Facebook](/docs/api/social/facebook)
