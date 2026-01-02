---
title: GetUserSessionsResponseDTO
description: Response DTO containing array of active user sessions with device info, location, and authentication method details.
keywords: [dto, sessions, response, user, device, location, api]
image: /img/api-social-card.png
sidebar_position: 470
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserSessionsResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response data transfer object containing all active sessions for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserSessionsResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserSessionsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserSessionsResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property   | Type                  | Required | Description                                                                                                                              |
| ---------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions` | `UserSessionInfo[]`   | Yes      | Array of active sessions. Each session includes device info, location, auth method, and timestamps. Current session marked with `isCurrent: true`. |

## UserSessionInfo Properties

| Property         | Type      | Required | Description                                                                                                                              |
| ---------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId`      | `string`  | Yes      | Unique session identifier.                                                                                                               |
| `deviceId`       | `string`  | No       | Device identifier. Null if not available.                                                                                               |
| `deviceName`     | `string`  | No       | Device name (e.g., "iPhone 13", "Chrome on Windows"). Null if not available.                                                             |
| `deviceType`     | `string` | No       | Device type (e.g., "mobile", "desktop", "tablet"). Null if not available.                                                                |
| `platform`       | `string`  | No       | Platform (e.g., "iOS", "Android", "Windows", "macOS"). Null if not available.                                                          |
| `browser`        | `string`  | No       | Browser name (e.g., "Chrome", "Safari", "Firefox"). Null if not available.                                                               |
| `ipAddress`      | `string`  | No       | IP address of the session. Null if not available.                                                                                        |
| `ipCountry`      | `string`  | No       | Country derived from IP address. Null if not available.                                                                                 |
| `ipCity`         | `string`  | No       | City derived from IP address. Null if not available.                                                                                    |
| `lastActivityAt` | `Date`    | Yes      | Timestamp of last activity for this session.                                                                                             |
| `createdAt`      | `Date`    | Yes      | Timestamp when session was created.                                                                                                      |
| `expiresAt`      | `Date`    | Yes      | Timestamp when session expires.                                                                                                           |
| `isRemembered`   | `boolean` | Yes      | Whether session is remembered (trusted device).                                                                                           |
| `isCurrent`      | `boolean` | Yes      | Whether this is the current session (session making the request).                                                                        |
| `authMethod`     | `string`  | No       | Authentication method used. Examples: `'password'`, `'social'`, `'admin'`, `'admin-social'`. Null if not available.                      |
| `authProvider`   | `string`  | No       | OAuth provider name (only for social logins). Examples: `'google'`, `'facebook'`, `'apple'`. Null if not a social login or not available. |

## Example

```json
{
  "sessions": [
    {
      "sessionId": "123",
      "deviceId": "device-uuid-123",
      "deviceName": "iPhone 13",
      "deviceType": "mobile",
      "platform": "iOS",
      "browser": "Safari",
      "ipAddress": "192.168.1.1",
      "ipCountry": "US",
      "ipCity": "San Francisco",
      "lastActivityAt": "2025-01-15T10:30:00.000Z",
      "createdAt": "2025-01-10T08:00:00.000Z",
      "expiresAt": "2025-01-17T08:00:00.000Z",
      "isRemembered": true,
      "isCurrent": true,
      "authMethod": "password",
      "authProvider": null
    },
    {
      "sessionId": "456",
      "deviceName": "Chrome on Windows",
      "deviceType": "desktop",
      "platform": "Windows",
      "browser": "Chrome",
      "ipAddress": "192.168.1.2",
      "ipCountry": "US",
      "ipCity": "New York",
      "lastActivityAt": "2025-01-14T15:20:00.000Z",
      "createdAt": "2025-01-12T09:00:00.000Z",
      "expiresAt": "2025-01-19T09:00:00.000Z",
      "isRemembered": false,
      "isCurrent": false,
      "authMethod": "social",
      "authProvider": "google"
    }
  ]
}
```

## Used By

- [AuthService.getUserSessions()](../services/auth-service#getusersessions)

