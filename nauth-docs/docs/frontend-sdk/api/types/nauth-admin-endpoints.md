---
title: NAuthAdminEndpoints
description: Admin endpoint paths configuration for the client SDK
keywords: [admin, endpoints, config, api]
image: /img/api-social-card.png
---

# NAuthAdminEndpoints

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Admin endpoint paths configuration for the client SDK. Allows overriding default admin endpoint paths to match custom backend routes.

```typescript
import { NAuthAdminEndpoints } from '@nauth-toolkit/client';
```

## Properties

| Property                | Type     | Description                                                      |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| `deleteUser`           | `string` | DELETE endpoint for user deletion (supports `:sub` path parameter) |
| `disableUser`           | `string` | POST endpoint for disabling a user (supports `:sub` path parameter) |
| `enableUser`            | `string` | POST endpoint for enabling a user (supports `:sub` path parameter) |
| `forcePasswordChange`   | `string` | POST endpoint for forcing password change (supports `:sub` path parameter) |
| `getAuditHistory`       | `string` | GET endpoint for audit history                                   |
| `getMfaStatus`          | `string` | GET endpoint for MFA status (supports `:sub` path parameter)     |
| `getMfaDevices`         | `string` | GET endpoint for MFA devices (supports `:sub` path parameter)    |
| `getUser`               | `string` | GET endpoint for retrieving a user (supports `:sub` path parameter) |
| `getUserSessions`       | `string` | GET endpoint for user sessions (supports `:sub` path parameter) |
| `getUserByEmail`        | `string` | GET endpoint resolving a user by email address                   |
| `updateUser`            | `string` | PUT endpoint for user attributes (supports `:sub` path parameter) |
| `updateVerifiedStatus`  | `string` | POST endpoint for email/phone verified flags (supports `:sub`)   |
| `revokeUserSession`     | `string` | DELETE endpoint for one session (supports `:sub` and `:sessionId`) |
| `trustedDevices`        | `string` | GET/DELETE endpoint for a user's trusted devices (supports `:sub`) |
| `trustedDevice`         | `string` | DELETE endpoint for one trusted device (supports `:sub`, `:deviceId`) |
| `getEventsByType`       | `string` | GET endpoint for audit events of one type                        |
| `getSuspiciousActivity` | `string` | GET endpoint for events flagged as suspicious                    |
| `getRiskAssessmentHistory` | `string` | GET endpoint for a user's risk assessment history             |
| `apiKeys`               | `string` | POST/GET endpoint for creating and listing a user's API keys     |
| `apiKey`                | `string` | PATCH/DELETE endpoint for one key (supports `:keyId`)            |
| `apiKeyRevoke`          | `string` | POST endpoint revoking one key (supports `:keyId`)               |
| `getUsers`              | `string` | GET endpoint for querying users                                  |
| `logoutAll`             | `string` | POST endpoint for logging out all sessions (supports `:sub` path parameter) |
| `removeMfaDeviceById`   | `string` | DELETE endpoint for removing single MFA device by ID         |
| `setPreferredMfaDevice` | `string` | POST endpoint for setting preferred MFA device               |
| `resetPasswordInitiate` | `string` | POST endpoint for initiating password reset                  |
| `setMfaExemption`       | `string` | POST endpoint for setting MFA exemption                      |
| `setPassword`           | `string` | POST endpoint for setting password                           |
| `signup`                | `string` | POST endpoint for user creation                              |
| `signupSocial`          | `string` | POST endpoint for social user import                         |

## Default Endpoints

| Endpoint                | Default Path                          |
| ----------------------- | ------------------------------------- |
| `deleteUser`            | `/users/:sub`                         |
| `disableUser`           | `/users/:sub/disable`                 |
| `enableUser`            | `/users/:sub/enable`                   |
| `forcePasswordChange`   | `/users/:sub/force-password-change`    |
| `getAuditHistory`       | `/audit/history`                      |
| `getMfaStatus`          | `/users/:sub/mfa/status`              |
| `getMfaDevices`         | `/users/:sub/mfa/devices`             |
| `getUser`               | `/users/:sub`                         |
| `getUserSessions`       | `/users/:sub/sessions`                |
| `getUserByEmail`        | `/users/by-email`                     |
| `updateUser`            | `/users/:sub`                         |
| `updateVerifiedStatus`  | `/users/:sub/verified-status`         |
| `revokeUserSession`     | `/users/:sub/sessions/:sessionId`     |
| `trustedDevices`        | `/users/:sub/trusted-devices`         |
| `trustedDevice`         | `/users/:sub/trusted-devices/:deviceId` |
| `getEventsByType`       | `/audit/events`                       |
| `getSuspiciousActivity` | `/audit/suspicious`                   |
| `getRiskAssessmentHistory` | `/audit/risk`                      |
| `apiKeys`               | `/api-keys`                           |
| `apiKey`                | `/api-keys/:keyId`                    |
| `apiKeyRevoke`          | `/api-keys/:keyId/revoke`             |
| `getUsers`              | `/users`                              |
| `logoutAll`             | `/users/:sub/logout-all`                      |
| `removeMfaDeviceById`   | `/mfa/devices/:deviceId`                      |
| `setPreferredMfaDevice` | `/users/:sub/mfa/devices/:deviceId/preferred` |
| `resetPasswordInitiate` | `/reset-password/initiate`                    |
| `setMfaExemption`       | `/mfa/exemption`                      |
| `setPassword`           | `/set-password`                       |
| `signup`                | `/signup`                             |
| `signupSocial`          | `/signup-social`                       |

## Example

**Override specific endpoints:**

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  admin: {
    pathPrefix: '/admin',
    endpoints: {
      signup: '/users/create',
      getUser: '/users/:sub/details',
      deleteUser: '/users/:sub/remove',
    },
  },
});
```

## Related Types

- [`NAuthClientConfig`](../nauth-client-config) - Main client configuration
- [`AdminOperations`](../admin-operations) - Admin operations service

## Used By

- [`NAuthClientConfig`](../nauth-client-config) - Used in `admin.endpoints` property
