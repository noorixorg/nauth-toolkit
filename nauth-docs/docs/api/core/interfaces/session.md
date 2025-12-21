---
title: ISession
description: Session entity contract used for JWT session tracking and device metadata
keywords: [session, entity, interface, api]
image: /img/api-social-card.png
sidebar_position: 6
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ISession

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Entity contract for session records implemented by database packages.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ISession } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ISession } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ISession } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `number` | Yes | Database ID |
| `userId` | `number` | Yes | User database ID |
| `ipAddress` | `string \| null` | Yes | Client IP |
| `userAgent` | `string \| null` | Yes | User agent |
| `deviceId` | `string \| null` | Yes | Device ID |
| `deviceName` | `string \| null` | Yes | Device name |
| `deviceType` | `string \| null` | Yes | Device type |
| `authMethod` | `string \| null` | Yes | Auth method (password/social/etc.) |
| `isRemembered` | `boolean` | Yes | Remembered session |
| `isTrustedDevice` | `boolean` | Yes | Trusted device flag |
| `expiresAt` | `Date` | Yes | Expiration timestamp |
| `metadata` | `Record<string, unknown> \| null` | Yes | Custom session metadata |

## Related APIs

- [IUser](./user) - Users
- [AuthService](/docs/api/core/services/auth-service) - Service usage


