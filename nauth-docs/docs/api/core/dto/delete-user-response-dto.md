---
title: DeleteUserResponseDTO
description: Administrative user deletion response with cascade counts
sidebar_position: 150
keywords: [dto, admin, delete, user, response]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DeleteUserResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for administrative user deletion with cascade deletion counts.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DeleteUserResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DeleteUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DeleteUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property                            | Type      | Description                                       |
| ----------------------------------- | --------- | ------------------------------------------------- |
| `success`                           | `boolean` | Deletion success flag (always `true` if returned) |
| `deletedUserId`                     | `string`  | Deleted user's UUID                               |
| `deletedRecords`                    | `object`  | Count of cascade-deleted records by table         |
| `deletedRecords.sessions`           | `number`  | Number of sessions deleted                        |
| `deletedRecords.verificationTokens` | `number`  | Number of verification tokens deleted             |
| `deletedRecords.mfaDevices`         | `number`  | Number of MFA devices deleted                     |
| `deletedRecords.trustedDevices`     | `number`  | Number of trusted devices deleted                 |
| `deletedRecords.socialAccounts`     | `number`  | Number of social accounts deleted                 |
| `deletedRecords.loginAttempts`      | `number`  | Number of login attempts deleted                  |
| `deletedRecords.challengeSessions`  | `number`  | Number of challenge sessions deleted              |
| `deletedRecords.auditLogs`          | `number`  | Number of audit logs deleted                      |

## Example

```json
{
  "success": true,
  "deletedUserId": "550e8400-e29b-41d4-a716-446655440000",
  "deletedRecords": {
    "sessions": 5,
    "verificationTokens": 2,
    "mfaDevices": 1,
    "trustedDevices": 3,
    "socialAccounts": 2,
    "loginAttempts": 10,
    "challengeSessions": 1,
    "auditLogs": 50
  }
}
```

## Used By

- [AuthService.deleteUser()](../services/auth-service#deleteuser)
