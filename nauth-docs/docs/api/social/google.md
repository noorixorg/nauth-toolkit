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
| `GoogleSocialAuthService` | Class | Default |
| `TokenVerifierService` | Class | Default |
| `GoogleSocialAuthModule` | NestJS Module | `/nestjs` |

## Configuration

Configure Google under `config.social.google` (in `@nauth-toolkit/core` config).

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | No | Enable Google OAuth |
| `clientId` | `string \| string[]` | Yes (if enabled) | OAuth client ID (supports multi-platform IDs) |
| `clientSecret` | `string` | Yes (if enabled) | OAuth client secret |
| `callbackUrl` | `string` | Yes (if enabled) | Backend callback URL (`/auth/social/google/callback`) |
| `scopes` | `string[]` | No | Default: `['openid', 'email', 'profile']` |
| `autoLink` | `boolean` | No | Auto-link to existing users by verified email |
| `allowSignup` | `boolean` | No | Allow creating new users on first login |

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
| `id` | `string` | Google user ID |
| `email` | `string` | Email address |
| `emailVerified` | `boolean` | Email verified by Google |
| `name` | `string` | Display name |
| `picture` | `string` | Profile picture URL |

## Related

- [SocialAuthService](/docs/api/core/services/social-auth-service)
- [Social Auth](/docs/api/social/overview)
