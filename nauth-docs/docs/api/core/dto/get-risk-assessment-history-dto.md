---
title: GetRiskAssessmentHistoryDTO
description: Request DTO for getting risk assessment history for adaptive MFA analysis
sidebar_position: 24
keywords: [dto, request, audit, risk, assessment, mfa, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetRiskAssessmentHistoryDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting risk assessment history for adaptive MFA analysis. Returns events where risk assessment was performed (ADAPTIVE_MFA_RISK_ASSESSED, ADAPTIVE_MFA_TRIGGERED, ADAPTIVE_MFA_BYPASSED).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetRiskAssessmentHistoryDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetRiskAssessmentHistoryDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetRiskAssessmentHistoryDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                 |
| -------- | -------- | -------- | -------------------------------------------- |
| `userSub` | `string` | Yes      | User identifier (UUID v4). Trimmed and lowercased. |
| `limit`  | `number` | No       | Maximum number of records to return. Default: 100. Max: 500 |

## Example

```json
{
  "userSub": "550e8400-e29b-41d4-a716-446655440000",
  "limit": 50
}
```

## Used By

- [AuthAuditService.getRiskAssessmentHistory()](../services/auth-audit-service#getriskassessmenthistory)

