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
| `AppleSocialAuthService` | Class | Default |
| `TokenVerifierService` | Class | Default |
| `AppleSocialAuthModule` | NestJS Module | `/nestjs` |

## Configuration

Configure Apple under `config.social.apple` (in `@nauth-toolkit/core` config).

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | No | Enable Apple Sign-In |
| `clientId` | `string` | Yes (if enabled) | Apple Services ID |
| `clientSecret` | `string` | Yes (if enabled for web) | Client secret JWT (web) |
| `callbackUrl` | `string` | Yes (if enabled) | Backend callback URL (`/auth/social/apple/callback`) |
| `scopes` | `string[]` | No | Default: `['name', 'email']` |
| `autoLink` | `boolean` | No | Auto-link to existing users by verified email |
| `allowSignup` | `boolean` | No | Allow creating new users on first login |

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
