---
title: AdaptiveMFARiskEventPayload
description: Risk event payload interface for adaptive MFA. Contains user context, risk signals, decision, and client metadata for audit/logging and hooks.
keywords: [interface, mfa, adaptive, risk, payload, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdaptiveMFARiskEventPayload

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Risk event payload used by adaptive MFA to describe the user, risk score, decision, and client context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdaptiveMFARiskEventPayload } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdaptiveMFARiskEventPayload } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdaptiveMFARiskEventPayload } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                                         | Required | Description |
| ------------- | -------------------------------------------- | -------- | ----------- |
| `action`      | `'allow' \| 'require_mfa' \| 'block_signin'` | Yes      | Action selected by risk evaluation. |
| `authMethod`  | `string`                                     | Yes      | Authentication method (e.g., `password`, `google`). |
| `clientInfo`  | `object`                                     | Yes      | Client context (IP, device, location, user agent). |
| `metadata`    | `Record<string, unknown>`                    | No       | Additional metadata. |
| `riskFactors` | `string[]`                                   | Yes      | Risk factor identifiers. |
| `riskLevel`   | `'low' \| 'medium' \| 'high'`                | Yes      | Risk level classification. |
| `riskScore`   | `number`                                     | Yes      | Risk score (0-100). |
| `timestamp`   | `Date`                                       | Yes      | Timestamp of the risk event. |
| `user`        | [`AdaptiveMFAUser`](./adaptive-mfa-user)     | Yes      | User being authenticated. |

## Used By

- [AdaptiveMFAUser](./adaptive-mfa-user) - `user` property type
- [NAuthConfig](./nauth-config) - Referenced by adaptive MFA configuration and hooks


