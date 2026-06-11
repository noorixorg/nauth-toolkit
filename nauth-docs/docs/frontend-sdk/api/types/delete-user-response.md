---
title: DeleteUserResponse
description: Response payload for user deletion with cascade cleanup information
keywords: [admin, delete, user, response, api]
image: /img/api-social-card.png
---

# DeleteUserResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for user deletion. Returns deletion confirmation with cascade cleanup information showing how many related records were deleted.

```typescript
import { DeleteUserResponse } from '@nauth-toolkit/client';
```

## Properties

| Property              | Type     | Description                                                      |
| --------------------- | -------- | ---------------------------------------------------------------- |
| `deletedRecords`      | `object` | Number of related records deleted                                |
| `deletedRecords.auditLogs` | `number` | Number of audit logs deleted                                    |
| `deletedRecords.challengeSessions` | `number` | Number of challenge sessions deleted                            |
| `deletedRecords.loginAttempts` | `number` | Number of login attempts deleted                                |
| `deletedRecords.mfaDevices` | `number` | Number of MFA devices deleted                                   |
| `deletedRecords.sessions` | `number` | Number of sessions deleted                                      |
| `deletedRecords.socialAccounts` | `number` | Number of social accounts deleted                               |
| `deletedRecords.trustedDevices` | `number` | Number of trusted devices deleted                               |
| `deletedRecords.verificationTokens` | `number` | Number of verification tokens deleted                           |
| `deletedUserId`       | `string` | Deleted user ID (sub)                                             |
| `success`             | `boolean` | Success indicator                                                |

## Example

```json
{
  "success": true,
  "deletedUserId": "a21b654c-2746-4168-acee-c175083a65cd",
  "deletedRecords": {
    "sessions": 5,
    "verificationTokens": 2,
    "mfaDevices": 1,
    "trustedDevices": 3,
    "socialAccounts": 1,
    "loginAttempts": 42,
    "challengeSessions": 8,
    "auditLogs": 150
  }
}
```

## Related Types

- [`AuthUser`](./auth-user) - User profile structure

## Used By

- [AdminOperations.deleteUser()](../admin-operations#deleteuser) - Returns [`DeleteUserResponse`](./delete-user-response)
