---
title: getCurrentUser()
description: Get authenticated user from context
keywords: [fastify, helper, user, context, api]
image: /img/api-social-card.png
sidebar_position: 4
---

# getCurrentUser()

**Type:** Function
**Access:** `nauth.helpers.getCurrentUser()`

Returns authenticated user from AsyncLocalStorage context.

## Signature

```typescript
getCurrentUser(): IUser | undefined
```

## Returns

- `IUser` - Authenticated user object
- `undefined` - No authenticated user

## Usage

```typescript
fastify.get('/profile', {
  preHandler: nauth.helpers.requireAuth(),
  handler: nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    return { user };
  }),
});
```

## IUser Properties

| Property | Type | Description |
|----------|------|-------------|
| `sub` | `string` | User ID |
| `email` | `string` | Email address |
| `emailVerified` | `boolean` | Email verified |
| `username` | `string?` | Username |
| `phone` | `string?` | Phone number |
| `phoneVerified` | `boolean` | Phone verified |
| `mfaEnabled` | `boolean` | MFA enabled |

## Related

- [requireAuth()](/docs/api/fastify/helpers/require-auth)

