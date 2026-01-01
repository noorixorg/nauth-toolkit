---
title: AdaptiveMFAUser
description: User information interface for adaptive MFA risk event payloads. Contains minimal user data for risk assessment.
keywords: [interface, user, mfa, adaptive, risk, api]
image: /img/api-social-card.png
sidebar_position: 7
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdaptiveMFAUser

**Package:** `@nauth-toolkit/core`
**Type:** Interface

User information interface used in adaptive MFA risk event payloads. Contains minimal user data needed for risk assessment and decision making.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdaptiveMFAUser } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdaptiveMFAUser } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdaptiveMFAUser } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type     | Required | Description                          |
| ------------- | -------- | -------- | ------------------------------------ |
| `sub`         | `string` | Yes      | User identifier (UUID v4).           |
| `email`       | `string` | Yes      | User's email address.                |
| `username`    | `string` | No       | User's username.                     |
| `phoneNumber` | `string` | No       | User's phone number in E.164 format. |

## Used By

- [AdaptiveMFARiskEventPayload](./nauth-config#adaptivemfariskeventpayload) - User property type

## Related APIs

- [IUser](./user) - Full user entity interface
- [NAuthConfig](./nauth-config) - Configuration interface
