---
title: ISession
description: Session entity contract used for JWT session tracking and device metadata
keywords: [session, entity, interface, api]
image: /img/api-social-card.png
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

| Property | Type | Description |
| --- | --- | --- |
| `id` | `number` | Database ID |
| `userId` | `number` | User database ID |
| `accessTokenHash` | `string` | Hashed access token |
| `refreshTokenHash` | `string` | Hashed refresh token |
| `tokenFamily` | `string` | Token family for rotation tracking |
| `deviceId` | `string \| null` | Device identifier |
| `deviceName` | `string \| null` | Device name |
| `deviceType` | `string \| null` | Device type |
| `deviceFingerprint` | `string \| null` | Device fingerprint |
| `ipAddress` | `string \| null` | Client IP address |
| `ipCountry` | `string \| null` | Country derived from IP |
| `ipCity` | `string \| null` | City derived from IP |
| `ipIsp` | `string \| null` | ISP derived from IP |
| `userAgent` | `string \| null` | User agent string |
| `platform` | `string \| null` | Platform (e.g., `'iOS'`, `'Windows'`) |
| `browser` | `string \| null` | Browser name |
| `authMethod` | `string \| null` | Auth method (e.g., `'password'`, `'social'`) |
| `isTrustedDevice` | `boolean` | Whether session is on a trusted device |
| `expiresAt` | `Date` | Expiration timestamp |
| `lastActivityAt` | `Date \| null` | Last activity timestamp |
| `isRevoked` | `boolean` | Whether session has been revoked |
| `revokedAt` | `Date \| null` | Revocation timestamp |
| `revokeReason` | `string \| null` | Reason for revocation |
| `version` | `number` | Token version for rotation |
| `metadata` | `Record<string, unknown> \| null` | Custom session metadata |
| `createdAt` | `Date` | Session creation timestamp |

## Related APIs

- [IUser](./user) - Users
- [AuthService](/docs/api/core/services/auth-service) - Service usage


