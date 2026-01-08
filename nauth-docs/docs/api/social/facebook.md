---
title: Facebook Provider
description: Facebook Login social authentication provider
keywords: [social, oauth, facebook, api]
image: /img/api-social-card.png
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
| `FacebookSocialAuthService` | Class | Default |
| `TokenVerifierService` | Class | Default |
| `FacebookSocialAuthModule` | NestJS Module | `/nestjs` |

## Configuration

Configure Facebook under `config.social.facebook` (in `@nauth-toolkit/core` config).

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | No | Enable Facebook OAuth |
| `clientId` | `string` | Yes (if enabled) | Facebook App ID |
| `clientSecret` | `string` | Yes (if enabled) | Facebook App Secret |
| `callbackUrl` | `string` | Yes (if enabled) | Backend callback URL (`/auth/social/facebook/callback`) |
| `scopes` | `string[]` | No | Default: `['email', 'public_profile']` |
| `autoLink` | `boolean` | No | Auto-link to existing users by verified email |
| `allowSignup` | `boolean` | No | Allow creating new users on first login |

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
| `id` | `string` | Facebook user ID |
| `email` | `string?` | Email (if permission granted) |
| `name` | `string` | Display name |
| `picture` | `string` | Profile picture URL |

## Related

- [SocialAuthService](/docs/api/core/services/social-auth-service)
- [Social Auth](/docs/api/social/overview)
