---
title: GenerateBackupCodesResponseDTO
description: Response DTO carrying freshly generated MFA backup codes, returned in plaintext exactly once and stored only as hashes.
keywords: [mfa, backup codes, recovery, dto, response, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GenerateBackupCodesResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Single-use recovery codes issued for the current user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GenerateBackupCodesResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GenerateBackupCodesResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GenerateBackupCodesResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type       | Required | Description                                                                                          |
| -------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `codes`  | `string[]` | Yes      | Plaintext recovery codes. Returned once; only hashes are kept at rest, so codes cannot be re-read later. |

## Example

```json
{
  "codes": ["A1B2C3D4", "E5F6G7H8", "J9K0L1M2"]
}
```

:::warning
Generating codes replaces any set the user already held. Show these to the user immediately — they cannot be retrieved again.
:::

## Used By

- [MFAService.generateBackupCodes()](../services/mfa-service#generatebackupcodes)
