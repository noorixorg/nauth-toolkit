---
title: MFAMethod
description: MFA method identifiers and related types used across nauth-toolkit
keywords: [mfa, methods, enum, types, api]
image: /img/api-social-card.png
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MFAMethod

**Package:** `@nauth-toolkit/core`
**Type:** Enum (+ related types)

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { MFAMethod, MFADeviceMethod, MFAVerificationMethod, MFADeviceMethods } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { MFAMethod, MFADeviceMethod, MFAVerificationMethod, MFADeviceMethods } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { MFAMethod, MFADeviceMethod, MFAVerificationMethod, MFADeviceMethods } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## MFAMethod values

| Name | Value |
| --- | --- |
| `TOTP` | `totp` |
| `SMS` | `sms` |
| `EMAIL` | `email` |
| `PASSKEY` | `passkey` |
| `BACKUP` | `backup` |

## Related types

| Type | Definition |
| --- | --- |
| `MFADeviceMethod` | `MFAMethod.TOTP \| MFAMethod.SMS \| MFAMethod.EMAIL \| MFAMethod.PASSKEY` |
| `MFAVerificationMethod` | `MFADeviceMethod \| MFAMethod.BACKUP` |
| `MFADeviceMethods` | `readonly MFADeviceMethod[]` |

## Related

- [MFAService](/docs/api/core/services/mfa-service) - MFA API
- [MFA Overview](/docs/api/mfa/overview) - MFA modules


