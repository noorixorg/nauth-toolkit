---
title: RiskFactor
description: Risk factor identifiers used for risk scoring, adaptive MFA, and audit logging
keywords: [risk, factors, adaptive mfa, enum, api]
image: /img/api-social-card.png
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RiskFactor

**Package:** `@nauth-toolkit/core`
**Type:** Enum

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { RiskFactor } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { RiskFactor } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { RiskFactor } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Values

| Name | Value |
| --- | --- |
| `NEW_DEVICE` | `new_device` |
| `NEW_IP` | `new_ip` |
| `NEW_COUNTRY` | `new_country` |
| `IMPOSSIBLE_TRAVEL` | `impossible_travel` |
| `SUSPICIOUS_ACTIVITY` | `suspicious_activity` |
| `INCOMPLETE_LOCATION_DATA` | `incomplete_location_data` |
| `RECENT_PASSWORD_RESET` | `recent_password_reset` |
| `TOKEN_THEFT_ATTEMPT` | `token_theft_attempt` |
| `REFRESH_TOKEN_REUSE_DIFFERENT_SESSION` | `refresh_token_reuse_different_session` |
| `TOKEN_REUSE_ATTEMPT` | `token_reuse_attempt` |
| `TAMPERED_DEVICE_TOKEN` | `tampered_device_token` |
| `MFA_BYPASS_ATTEMPT` | `mfa_bypass_attempt` |

## Related

- [AuthAuditEventType](/docs/api/core/enums/auth-audit-event-type) - Audit events
- [MFAService](/docs/api/core/services/mfa-service) - MFA


