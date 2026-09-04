---
title: AdminGetMFAStatusDTO
description: Admin request DTO for retrieving comprehensive MFA status for a target user
keywords: [mfa, status, dto, request, admin, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminGetMFAStatusDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)
**Context:** Admin Only

Request DTO for retrieving comprehensive MFA status for a target user (admin operation).

:::warning[Admin Only]
This DTO requires the `sub` field to specify the target user. For user self-service MFA status, use [`MFAService.getMfaStatus()`](../services/mfa-service#getmfastatus) which takes no DTO and derives the user from authenticated context.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminGetMFAStatusDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminGetMFAStatusDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminGetMFAStatusDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                        |
| -------- | -------- | -------- | -------------------------------------------------- |
| `sub`    | `string` | Yes      | Target user sub (UUID v4). Trimmed and lowercased. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

## Used By

- [MFAService.adminGetMfaStatus()](../services/mfa-service#admingetmfastatus)

## Related DTOs

- [GetMFAStatusResponseDTO](./get-mfa-status-dto) - Response DTO

