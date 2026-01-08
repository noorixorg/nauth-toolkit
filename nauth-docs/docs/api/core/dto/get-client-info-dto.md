---
title: GetClientInfoResponseDTO
description: Response DTO for client information. Returns IP address, user agent, device info, and optional geolocation data from request context.
keywords: [client, info, ip, user-agent, device, response, dto, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetClientInfoResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object for client information extracted from the current request context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetClientInfoResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetClientInfoResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetClientInfoResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property     | Type                                | Required | Description                                                      |
| ------------ | ----------------------------------- | -------- | ---------------------------------------------------------------- |
| `ipAddress`  | `string`                            | Yes      | Client IP address. Extracted from X-Forwarded-For, CF-Connecting-IP, etc. Returns 'unknown' if called outside request context. |
| `userAgent`  | `string`                            | Yes      | User agent string from the request. Returns 'unknown' if called outside request context. |
| `deviceToken`| `string?`                           | No       | Device token for trusted device feature. Extracted from cookie (nauth_device_id) or header (X-Device-Token). |
| `deviceName` | `string?`                           | No       | Optional device name (if provided by client).                     |
| `deviceType` | `'mobile' \| 'desktop' \| 'tablet'?` | No       | Optional device type (if provided by client).                     |
| `ipCountry`  | `string?`                           | No       | Optional IP country (from geolocation, if available).             |
| `ipCity`     | `string?`                           | No       | Optional IP city (from geolocation, if available).                 |
| `platform`   | `string?`                           | No       | Platform extracted from user agent (e.g., "iOS", "Android", "Windows", "macOS"). |
| `browser`    | `string?`                           | No       | Browser extracted from user agent (e.g., "Chrome", "Safari", "Firefox"). |
| `sessionId`  | `number?`                           | No       | Current session ID (if available from authenticated request). Extracted from JWT token payload after authentication. |

## Example

```json
{
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "deviceToken": "device-token-123",
  "deviceName": "My Laptop",
  "deviceType": "desktop",
  "ipCountry": "US",
  "ipCity": "New York",
  "platform": "Windows 10",
  "browser": "Chrome",
  "sessionId": 123
}
```

## Used By

- [ClientInfoService.get()](../services/client-info-service#get)

