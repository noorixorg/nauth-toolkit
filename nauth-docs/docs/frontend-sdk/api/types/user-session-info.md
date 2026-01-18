---
title: UserSessionInfo
description: User session information with device and location details
keywords: [admin, session, user, api]
image: /img/api-social-card.png
---

# UserSessionInfo

**Package:** `@nauth-toolkit/client`
**Type:** Response

User session information returned from session listing endpoints. Contains device details, location information, and authentication metadata.

```typescript
import { UserSessionInfo } from '@nauth-toolkit/client';
```

## Properties

| Property          | Type      | Description                                                      |
| ----------------- | --------- | ---------------------------------------------------------------- |
| `authMethod`      | `string \| null` | Authentication method used for this session (e.g., `'password'`, `'social'`, `'admin'`, `'admin-social'`) |
| `authProvider`    | `string \| null` | OAuth provider name (only present for social logins, e.g., `'google'`, `'facebook'`, `'github'`, `'apple'`) |
| `browser`          | `string \| null` | Browser name                                                      |
| `createdAt`       | `Date \| string` | Session creation timestamp                                       |
| `deviceId`        | `string \| null` | Device ID                                                         |
| `deviceName`      | `string \| null` | Device name                                                        |
| `deviceType`      | `string \| null` | Device type                                                        |
| `expiresAt`       | `Date \| string` | Session expiration timestamp                                      |
| `ipAddress`       | `string \| null` | IP address                                                        |
| `ipCity`          | `string \| null` | IP city location                                                 |
| `ipCountry`     | `string \| null` | IP country location                                               |
| `isCurrent`       | `boolean` | Whether this is the current session                              |
| `isRemembered`    | `boolean` | Whether session is remembered                                     |
| `lastActivityAt`  | `Date \| string` | Last activity timestamp                                          |
| `platform`        | `string \| null` | Platform name                                                      |
| `sessionId`       | `string`  | Session ID                                                         |

## Example

```json
{
  "sessionId": "sess_abc123",
  "deviceId": "dev_xyz789",
  "deviceName": "Chrome on Mac",
  "deviceType": "desktop",
  "platform": "macOS",
  "browser": "Chrome",
  "ipAddress": "192.168.1.1",
  "ipCountry": "US",
  "ipCity": "San Francisco",
  "lastActivityAt": "2024-01-15T12:30:00.000Z",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "expiresAt": "2024-01-16T10:00:00.000Z",
  "isRemembered": true,
  "isCurrent": true,
  "authMethod": "password",
  "authProvider": null
}
```

**Social login session:**

```json
{
  "sessionId": "sess_def456",
  "deviceId": null,
  "deviceName": "Mobile Safari",
  "deviceType": "mobile",
  "platform": "iOS",
  "browser": "Safari",
  "ipAddress": "10.0.0.1",
  "ipCountry": "CA",
  "ipCity": "Toronto",
  "lastActivityAt": "2024-01-15T11:00:00.000Z",
  "createdAt": "2024-01-15T09:00:00.000Z",
  "expiresAt": "2024-01-16T09:00:00.000Z",
  "isRemembered": false,
  "isCurrent": false,
  "authMethod": "social",
  "authProvider": "google"
}
```

## Related Types

- [`GetUserSessionsResponse`](./get-user-sessions-response) - Response containing array of [`UserSessionInfo`](./user-session-info)

## Used By

- [AdminOperations.getUserSessions()](../admin-operations#getsessions) - Returns [`GetUserSessionsResponse`](./get-user-sessions-response) containing [`UserSessionInfo`](./user-session-info) array
