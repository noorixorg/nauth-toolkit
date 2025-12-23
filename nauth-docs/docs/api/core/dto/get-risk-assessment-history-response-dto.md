---
title: GetRiskAssessmentHistoryResponseDTO
description: Response DTO for risk assessment history audit events
sidebar_position: 25
keywords: [dto, response, audit, risk, mfa, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetRiskAssessmentHistoryResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO containing risk assessment history for adaptive MFA analysis.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetRiskAssessmentHistoryResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetRiskAssessmentHistoryResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetRiskAssessmentHistoryResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type           | Required | Description                              |
| -------- | -------------- | -------- | ---------------------------------------- |
| `data`   | `IAuthAudit[]` | Yes      | Array of risk assessment audit events    |

## Example

```json
{
  "data": [
    {
      "id": 1,
      "userId": 123,
      "eventType": "ADAPTIVE_MFA_RISK_ASSESSED",
      "eventStatus": "INFO",
      "riskFactor": 0.75,
      "adaptiveMfaTriggered": true,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

## Used By

- [AuthAuditService.getRiskAssessmentHistory()](../services/auth-audit-service#getriskassessmenthistory)

