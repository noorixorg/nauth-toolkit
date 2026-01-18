---
title: GetUserSessionsResponse
description: Response payload containing user sessions array
keywords: [admin, sessions, user, response, api]
image: /img/api-social-card.png
---

# GetUserSessionsResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload containing user sessions. Returns an array of session information for a specific user.

```typescript
import { GetUserSessionsResponse } from '@nauth-toolkit/client';
```

## Properties

| Property  | Type                      | Description                                                      |
| --------- | ------------------------- | ---------------------------------------------------------------- |
| `sessions`| [`UserSessionInfo`](./user-session-info)[] | Array of user sessions                                          |

## Example

```json
{
  "sessions": [
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
    },
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
  ]
}
```

## Related Types

- [`UserSessionInfo`](./user-session-info) - Individual session information structure

## Used By

- [AdminOperations.getUserSessions()](../admin-operations#getsessions) - Returns [`GetUserSessionsResponse`](./get-user-sessions-response)
