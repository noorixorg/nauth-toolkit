---
title: '@AdaptiveMFARiskDetectedHook()'
description: Decorator for automatic adaptive MFA risk detected hook registration in NestJS
keywords: [decorator, hooks, lifecycle, mfa, adaptive, risk, security]
image: /img/api-social-card.png
---
# @AdaptiveMFARiskDetectedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as an adaptive MFA risk detected hook. Executes when adaptive MFA detects risk factors. Non-blocking - errors are logged but don't affect authentication.

:::warning[Not in Main Barrel Export]
`AdaptiveMFARiskDetectedHook` is not exported from the `@nauth-toolkit/nestjs` main entry point. Register this hook manually using [`HookRegistryService`](/docs/api/core/services/hook-registry-service) instead of the decorator pattern.
:::

## Overview

The `@AdaptiveMFARiskDetectedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect authentication

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  AdaptiveMFARiskDetectedHook,
  IAdaptiveMFARiskDetectedHook,
  AdaptiveMFARiskDetectedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@AdaptiveMFARiskDetectedHook()
export class RiskAlertHook implements IAdaptiveMFARiskDetectedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void> {
    if (metadata.riskLevel === 'high') {
      await this.emailService.sendRiskAlertEmail({
        to: metadata.user.email,
        riskScore: metadata.riskScore,
        riskFactors: metadata.riskFactors,
      });
    }
  }
}
```

### With Priority

```typescript
@Injectable()
@AdaptiveMFARiskDetectedHook({ priority: 1 })
export class RiskEmailHook implements IAdaptiveMFARiskDetectedHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { RiskAlertHook } from './hooks/risk-alert.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([RiskAlertHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IAdaptiveMFARiskDetectedHook](/docs/api/core/hooks/adaptive-mfa-risk-detected-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

