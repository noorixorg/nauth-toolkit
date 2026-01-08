---
title: IUser
description: User entity contract used across core services and database implementations
keywords: [user, entity, interface, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# IUser

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Entity contract for user records implemented by database packages.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { IUser } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { IUser } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { IUser } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `number` | Yes | Database ID |
| `sub` | `string` | Yes | Public user identifier |
| `email` | `string` | Yes | Email address |
| `username` | `string \| null` | Yes | Username |
| `phone` | `string \| null` | Yes | Phone (E.164) |
| `firstName` | `string \| null` | Yes | First name |
| `lastName` | `string \| null` | Yes | Last name |
| `isEmailVerified` | `boolean` | Yes | Email verified |
| `isPhoneVerified` | `boolean` | Yes | Phone verified |
| `isActive` | `boolean` | Yes | Active user |
| `isLocked` | `boolean` | Yes | Locked state |
| `mfaEnabled` | `boolean` | Yes | MFA enabled |
| `metadata` | `Record<string, unknown> \| null` | Yes | Custom user metadata |
| `createdAt` | `Date` | Yes | Created timestamp |
| `updatedAt` | `Date` | Yes | Updated timestamp |

## Related APIs

- [ISession](./session) - Sessions
- [AuthService](/docs/api/core/services/auth-service) - Service usage


