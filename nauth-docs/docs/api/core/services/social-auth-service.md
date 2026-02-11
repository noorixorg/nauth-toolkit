---
title: SocialAuthService
description: Social account management service for linking/unlinking accounts and password management for social-only users.
keywords: [social, auth, account, management, linking, service, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SocialAuthService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Service for managing social authentication accounts and their relationships. Provides account linking/unlinking, password management for social-only users, and account queries.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SocialAuthService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SocialAuthService } from '@nauth-toolkit/core';
// Access via nauth.socialAuthService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SocialAuthService } from '@nauth-toolkit/core';
// Access via nauth.socialAuthService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

Service for managing social authentication accounts and their relationships. This service provides account linking/unlinking, password management for social-only users, and querying linked accounts.

:::tip OAuth Login Flows
For OAuth authentication (login/signup), use `SocialRedirectHandler` or the frontend SDK's `loginWithSocial()` method. See the [Social Login Guide](/docs/features/social-login) for details.
:::

:::tip Optional Feature
Only available when social auth provider modules are imported (e.g., `GoogleSocialAuthModule`, `AppleSocialAuthModule`).
:::

:::note
Auto-injected by framework. No manual instantiation required.
:::

## Methods

### canSetPassword()

Check if user can set a password (social-only users can set passwords).

```typescript
async canSetPassword(dto: CanSetPasswordDTO): Promise<CanSetPasswordResponseDTO>
```

**Parameters**

- `dto` - [`CanSetPasswordDTO`](../dto/can-set-password-dto)

**Returns**

- [`CanSetPasswordResponseDTO`](../dto/can-set-password-response-dto)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { CanSetPasswordDTO } from '@nauth-toolkit/nestjs';

const dto: CanSetPasswordDTO = { userId: user.sub };
const result = await this.socialAuthService.canSetPassword(dto);
if (result.canSetPassword) {
  // Show password setup form
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { CanSetPasswordDTO } from '@nauth-toolkit/core';

const dto: CanSetPasswordDTO = { userId: user.sub };
const result = await nauth.socialAuthService.canSetPassword(dto);
if (result.canSetPassword) {
  // Show password setup form
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { CanSetPasswordDTO } from '@nauth-toolkit/core';

const dto: CanSetPasswordDTO = { userId: user.sub };
const result = await nauth.socialAuthService.canSetPassword(dto);
if (result.canSetPassword) {
  // Show password setup form
}
```

</TabItem>
</Tabs>

---

### getLinkedAccounts()

Get linked social accounts for a user.

```typescript
async getLinkedAccounts(dto: GetLinkedAccountsDTO): Promise<GetLinkedAccountsResponseDTO>
```

**Parameters**

- `dto` - [`GetLinkedAccountsDTO`](../dto/get-linked-accounts-dto)

**Returns**

- [`GetLinkedAccountsResponseDTO`](../dto/get-linked-accounts-response-dto)

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/nestjs';

@Get('social/linked')
async getLinked(@CurrentUser() user: IUser) {
  const dto: GetLinkedAccountsDTO = { userId: user.sub };
  const accounts = await this.socialAuthService.getLinkedAccounts(dto);
  return accounts.accounts;
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/core';

app.get('/auth/social/linked', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser(req);
  const dto: GetLinkedAccountsDTO = { userId: user!.sub };
  const accounts = await nauth.socialAuthService.getLinkedAccounts(dto);
  res.json(accounts.accounts);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetLinkedAccountsDTO } from '@nauth-toolkit/core';

fastify.get(
  '/auth/social/linked',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const user = nauth.helpers.getCurrentUser();
    const dto: GetLinkedAccountsDTO = { userId: user!.sub };
    const accounts = await nauth.socialAuthService.getLinkedAccounts(dto);
    return accounts.accounts;
  }),
);
```

</TabItem>
</Tabs>

---

### linkSocialAccount()

Link social account to existing authenticated user.

```typescript
async linkSocialAccount(dto: LinkSocialAccountDTO): Promise<LinkSocialAccountResponseDTO>
```

**Parameters**

- `dto` - [`LinkSocialAccountDTO`](../dto/link-social-account-dto)

**Returns**

- [`LinkSocialAccountResponseDTO`](../dto/link-social-account-response-dto)

**Errors**

| Code                    | When                    | Details               |
| ----------------------- | ----------------------- | --------------------- |
| `SOCIAL_ACCOUNT_LINKED` | Account already linked  | `{}`                  |
| `NOT_FOUND`             | User not found          | `{ userId?: string }` |
| `SOCIAL_CONFIG_MISSING` | Provider not configured | `{}`                  |
| `SOCIAL_TOKEN_INVALID`  | OAuth callback failed   | `{}`                  |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { LinkSocialAccountDTO } from '@nauth-toolkit/nestjs';

@Post('social/link')
async link(@CurrentUser() user: IUser, @Body() body: { provider: string; code: string; state: string }) {
  const dto: LinkSocialAccountDTO = {
    userId: user.sub,
    ...body,
  };
  return await this.socialAuthService.linkSocialAccount(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { LinkSocialAccountDTO } from '@nauth-toolkit/core';

app.post('/auth/social/link', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser(req);
  const dto: LinkSocialAccountDTO = {
    userId: user!.sub,
    ...req.body,
  };
  const result = await nauth.socialAuthService.linkSocialAccount(dto);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { LinkSocialAccountDTO } from '@nauth-toolkit/core';

fastify.post(
  '/auth/social/link',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const user = nauth.helpers.getCurrentUser();
    const dto: LinkSocialAccountDTO = {
      userId: user!.sub,
      ...req.body,
    };
    const result = await nauth.socialAuthService.linkSocialAccount(dto);
    return result;
  }),
);
```

</TabItem>
</Tabs>

---

### listAvailableProviders()

List available social auth providers.

```typescript
listAvailableProviders(): string[]
```

**Parameters**

None

**Returns**

- `string[]` - Array of provider names (e.g., ['google', 'apple', 'facebook'])

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const providers = this.socialAuthService.listAvailableProviders();
// ['google', 'apple']
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const providers = nauth.socialAuthService.listAvailableProviders();
// ['google', 'apple']
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const providers = nauth.socialAuthService.listAvailableProviders();
// ['google', 'apple']
```

</TabItem>
</Tabs>

---

### setPasswordForSocialUser()

Set password for social-only user.

```typescript
async setPasswordForSocialUser(dto: SetPasswordForSocialUserDTO): Promise<SetPasswordForSocialUserResponseDTO>
```

**Parameters**

- `dto` - [`SetPasswordForSocialUserDTO`](../dto/set-password-for-social-user-dto)

**Returns**

- [`SetPasswordForSocialUserResponseDTO`](../dto/set-password-for-social-user-response-dto)

**Errors**

| Code                | When                      | Details                 |
| ------------------- | ------------------------- | ----------------------- |
| `NOT_FOUND`         | User not found            | `{ userId?: string }`   |
| `VALIDATION_FAILED` | User already has password | `{ field: 'password' }` |
| `WEAK_PASSWORD`     | Password policy violation | `{ errors: string[] }`  |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SetPasswordForSocialUserDTO } from '@nauth-toolkit/nestjs';

const dto: SetPasswordForSocialUserDTO = {
  userId: user.sub,
  password: 'newpassword',
};
await this.socialAuthService.setPasswordForSocialUser(dto);
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SetPasswordForSocialUserDTO } from '@nauth-toolkit/core';

const dto: SetPasswordForSocialUserDTO = {
  userId: user.sub,
  password: 'newpassword',
};
await nauth.socialAuthService.setPasswordForSocialUser(dto);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SetPasswordForSocialUserDTO } from '@nauth-toolkit/core';

const dto: SetPasswordForSocialUserDTO = {
  userId: user.sub,
  password: 'newpassword',
};
await nauth.socialAuthService.setPasswordForSocialUser(dto);
```

</TabItem>
</Tabs>

### unlinkSocialAccount()

Unlink social account from user.

```typescript
async unlinkSocialAccount(dto: UnlinkSocialAccountDTO): Promise<UnlinkSocialAccountResponseDTO>
```

**Parameters**

- `dto` - [`UnlinkSocialAccountDTO`](../dto/unlink-social-account-dto)

**Returns**

- [`UnlinkSocialAccountResponseDTO`](../dto/unlink-social-account-response-dto)

**Errors**

| Code                       | When               | Details               |
| -------------------------- | ------------------ | --------------------- |
| `NOT_FOUND`                | User not found     | `{ userId?: string }` |
| `SOCIAL_ACCOUNT_NOT_FOUND` | Account not linked | `{}`                  |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UnlinkSocialAccountDTO } from '@nauth-toolkit/nestjs';

@Post('social/unlink')
async unlink(@CurrentUser() user: IUser, @Body() body: { provider: string }) {
  const dto: UnlinkSocialAccountDTO = {
    userId: user.sub,
    provider: body.provider,
  };
  await this.socialAuthService.unlinkSocialAccount(dto);
  return { success: true };
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UnlinkSocialAccountDTO } from '@nauth-toolkit/core';

app.post('/auth/social/unlink', nauth.helpers.requireAuth(), async (req, res) => {
  const user = nauth.helpers.getCurrentUser(req);
  const dto: UnlinkSocialAccountDTO = {
    userId: user!.sub,
    provider: req.body.provider,
  };
  await nauth.socialAuthService.unlinkSocialAccount(dto);
  res.json({ success: true });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UnlinkSocialAccountDTO } from '@nauth-toolkit/core';

fastify.post(
  '/auth/social/unlink',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const user = nauth.helpers.getCurrentUser();
    const dto: UnlinkSocialAccountDTO = {
      userId: user!.sub,
      provider: req.body.provider,
    };
    await nauth.socialAuthService.unlinkSocialAccount(dto);
    return { success: true };
  }),
);
```

</TabItem>
</Tabs>

---

## Error Handling

All methods throw [`NAuthException`](../exceptions/nauth-exception) on failure. Handle errors appropriately for your framework.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
try {
  await this.socialAuthService.linkSocialAccount(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    console.log(error.code);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
try {
  await nauth.socialAuthService.linkSocialAccount(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    res.status(error.statusCode).json(error.toJSON());
  }
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
try {
  await nauth.socialAuthService.linkSocialAccount(dto);
} catch (error) {
  if (error instanceof NAuthException) {
    reply.status(error.statusCode).send(error.toJSON());
  }
}
```

</TabItem>
</Tabs>

See [Error Handling Guide](/docs/concepts/error-handling).

---

## Redirect-first OAuth (SocialRedirectHandler)

For backend-first OAuth flows (redirect to provider, then callback), use `SocialRedirectHandler` (injected alongside this service). The handler is framework-neutral: it reads delivery and deviceToken from ContextStorage and applies cookies via `HTTP_RESPONSE` in cookies mode. Consumer controllers pass only provider and DTOs.

- `start(provider, dto)` - Returns `Promise<StartSocialRedirectResponseDTO>`. Use with NestJS `@Redirect()`.
- `callback(provider, dto)` - Returns `Promise<SocialRedirectCallbackResponseDTO>`. Cookies are applied to the response from ContextStorage when delivery is cookies.
- `exchange(exchangeToken)` - Returns `Promise<AuthResponseDTO>` for JSON/hybrid or challenge flows.

See the [Social Login Guide](/docs/features/social-login) for full implementation and DTOs (`StartSocialRedirectQueryDTO`, `SocialCallbackQueryDTO`, `SocialCallbackFormDTO`, `StartSocialRedirectResponseDTO`, `SocialRedirectCallbackResponseDTO`).

---

## Related APIs

- [AuthService](./auth-service) - Core authentication service
- [NAuthException](../exceptions/nauth-exception) - Error handling
- [Social Login Guide](/docs/features/social-login) - Implementation guide
