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

## Enable a provider

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Module({
  imports: [
    GoogleSocialAuthModule, // provider module
    AuthModule.forRoot(config), // core module
  ],
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

## Configuration keys

Providers are configured under `config.social`:

- `config.social.google`
- `config.social.apple`
- `config.social.facebook`

## Providers

- [Google](/docs/api/social/google)
- [Apple](/docs/api/social/apple)
- [Facebook](/docs/api/social/facebook)
