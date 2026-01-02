---
title: GetIpAddressResponseDTO
description: Response DTO for IP address. Returns just the client IP address from the current request context.
keywords: [ip, address, client, response, dto, api]
image: /img/api-social-card.png
sidebar_position: 290
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetIpAddressResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for IP address from the current request context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetIpAddressResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetIpAddressResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetIpAddressResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property    | Type     | Description                                                      |
| ----------- | -------- | ---------------------------------------------------------------- |
| `ipAddress` | `string` | Client IP address. Extracted from X-Forwarded-For, CF-Connecting-IP, etc. Returns 'unknown' if called outside request context. |

## Example

```json
{
  "ipAddress": "192.168.1.100"
}
```

## Used By

- [ClientInfoService.getIpAddress()](../services/client-info-service#getipaddress)

