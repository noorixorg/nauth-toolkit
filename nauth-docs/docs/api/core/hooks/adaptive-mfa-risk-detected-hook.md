---
title: IAdaptiveMFARiskDetectedHook
description: Hook interface for adaptive MFA risk evaluation events
keywords: [hooks, mfa, adaptive, risk, security, interface]
image: /img/api-social-card.png
---
# IAdaptiveMFARiskDetectedHook

Hook interface for executing actions when adaptive MFA detects risk.

## Overview

The `IAdaptiveMFARiskDetectedHook` interface enables reactions to adaptive MFA risk evaluations. Only triggered when `notifyUser: true` in risk level configuration.

The hook is **non-blocking** - errors are logged but do not affect authentication flow.

## Interface

```typescript
interface IAdaptiveMFARiskDetectedHook {
  execute(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void>;
}
```

## Metadata

### AdaptiveMFARiskDetectedMetadata

```typescript
interface AdaptiveMFARiskDetectedMetadata {
  user: IUser;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  action: 'allow' | 'require_mfa' | 'block_signin';
  authMethod: string;
  clientInfo: ClientInfo;
  timestamp: Date;
}
```

| Property      | Type                                          | Description                       |
| ------------- | --------------------------------------------- | --------------------------------- |
| `user`        | `IUser`                                       | User being authenticated          |
| `riskScore`   | `number`                                      | Risk score (0-100)                |
| `riskLevel`   | `'low' \| 'medium' \| 'high'`                 | Risk classification               |
| `riskFactors` | `RiskFactor[]`                                | Detected risk factors             |
| `action`      | `'allow' \| 'require_mfa' \| 'block_signin'`  | Action taken based on risk        |
| `authMethod`  | `string`                                      | Authentication method used        |
| `clientInfo`  | `ClientInfo`                                  | IP, user agent, location          |
| `timestamp`   | `Date`                                        | Event timestamp                   |

## When Hook Fires

- Adaptive MFA evaluates login and detects risk factors
- Risk level configuration has `notifyUser: true`

## Example

```typescript
import { IAdaptiveMFARiskDetectedHook, AdaptiveMFARiskDetectedMetadata } from '@nauth-toolkit/core';

export class RiskAlertHook implements IAdaptiveMFARiskDetectedHook {
  async execute(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void> {
    if (metadata.riskLevel === 'high') {
      await this.emailService.sendRiskAlertEmail({
        to: metadata.user.email,
        riskScore: metadata.riskScore,
        riskFactors: metadata.riskFactors,
        action: metadata.action,
      });
    }
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@AdaptiveMFARiskDetectedHook()](/docs/api/nestjs/decorators/adaptive-mfa-risk-detected-hook) - NestJS decorator
- [RiskFactor](../enums/risk-factor) - Risk factor enum
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

