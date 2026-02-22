---
title: "Admin Operations"
description: "Implement admin user management, password resets, session control, MFA management, and audit history"
sidebar_position: 4
keywords: [admin, user management, admin signup, admin password reset, admin mfa, sessions, audit, migration]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Admin Operations

Build a complete admin panel for user management. By the end of this guide you will have these endpoints working:

**User management:**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/admin/signup` | POST | Create a user with overrides (bypass verification, generate password) |
| `/auth/admin/signup-social` | POST | Import a social user (migration from Cognito, Auth0, etc.) |
| `/auth/admin/users` | GET | List users with filters and pagination |
| `/auth/admin/users/:sub` | GET | Get a single user by UUID |
| `/auth/admin/users/:sub` | DELETE | Delete a user (cascade cleanup) |
| `/auth/admin/users/:sub/disable` | POST | Lock a user account |
| `/auth/admin/users/:sub/enable` | POST | Unlock a user account |

**Password management:**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/admin/set-password` | POST | Set a user's password directly |
| `/auth/admin/reset-password/initiate` | POST | Send a password reset code via email or SMS |
| `/auth/admin/users/:sub/force-password-change` | POST | Force password change on next login |

**Session management:**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/admin/users/:sub/sessions` | GET | List all active sessions for a user |
| `/auth/admin/users/:sub/logout-all` | POST | Sign out a user from all devices |

**MFA management:**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/admin/users/:sub/mfa/status` | GET | Check a user's MFA enrollment |
| `/auth/admin/users/:sub/mfa/devices` | GET | List a user's MFA devices |
| `/auth/admin/mfa/devices/:deviceId` | DELETE | Remove an MFA device |
| `/auth/admin/users/:sub/mfa/devices/:deviceId/preferred` | POST | Set preferred MFA device |
| `/auth/admin/mfa/exemption` | POST | Grant or revoke MFA exemption |

**Audit:**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/admin/audit/history` | GET | Get authentication audit history for a user |

:::tip Sample apps
Admin routes are fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth) — see the Express and Fastify examples for admin routes, and the Angular example for `admin.component.ts`.
:::

:::warning Authorization is your responsibility
nauth-toolkit is an **authentication** framework — it does not handle authorization or permissions. All admin endpoints below use `requireAuth()` to verify the caller has a valid JWT, but **you must add your own authorization layer** on top (role checks, permission guards, RBAC, etc.) to ensure only admins can access these routes.
:::

## Prerequisites

- [Basic Auth Flows](/docs/guides/basic-auth) are working (signup, login, challenge endpoints)
- You have an authorization strategy for protecting admin routes (role-based, permission-based, etc.)

## Step 1: Add Backend Routes

The admin API uses two services from nauth-toolkit:
- **`adminAuthService`** — user CRUD, passwords, sessions
- **`mfaService`** — MFA status, devices, exemptions

Both are available on the `nauth` instance (Express/Fastify) or injectable via the NestJS module.

### User management routes

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/admin.controller.ts"
import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminAuthService, AuthGuard } from '@nauth-toolkit/nestjs';

// WARNING: AuthGuard only verifies the JWT is valid (authentication).
// You MUST add your own authorization guard to restrict access to admins.
// Example: @UseGuards(AuthGuard, YourAdminGuard)
@UseGuards(AuthGuard)
@Controller('auth/admin')
export class AdminController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: any) {
    return await this.adminAuthService.signup(dto);
  }

  @Post('signup-social')
  @HttpCode(HttpStatus.CREATED)
  async importSocialUser(@Body() dto: any) {
    return await this.adminAuthService.signupSocial(dto);
  }

  @Get('users')
  async listUsers(@Query() query: any) {
    return await this.adminAuthService.getUsers(query);
  }

  @Get('users/:sub')
  async getUser(@Param('sub') sub: string) {
    return await this.adminAuthService.getUserById({ sub });
  }

  @Delete('users/:sub')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('sub') sub: string) {
    return await this.adminAuthService.deleteUser({ sub });
  }

  @Post('users/:sub/disable')
  @HttpCode(HttpStatus.OK)
  async disableUser(@Param('sub') sub: string, @Body() body: any) {
    return await this.adminAuthService.disableUser({ sub, reason: body?.reason });
  }

  @Post('users/:sub/enable')
  @HttpCode(HttpStatus.OK)
  async enableUser(@Param('sub') sub: string) {
    return await this.adminAuthService.enableUser({ sub });
  }

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  async setPassword(@Body() dto: any) {
    return await this.adminAuthService.setPassword(dto);
  }

  @Post('reset-password/initiate')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: any) {
    return await this.adminAuthService.resetPassword(dto);
  }

  @Post('users/:sub/force-password-change')
  @HttpCode(HttpStatus.OK)
  async forcePasswordChange(@Param('sub') sub: string) {
    return await this.adminAuthService.setMustChangePassword({ sub });
  }

  @Get('users/:sub/sessions')
  async getUserSessions(@Param('sub') sub: string) {
    return await this.adminAuthService.getUserSessions({ sub });
  }

  @Post('users/:sub/logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Param('sub') sub: string, @Body() body: any) {
    return await this.adminAuthService.logoutAll({ sub, forgetDevices: body?.forgetDevices });
  }
}
```

Register the controller in your auth module.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/admin.routes.ts"
import { Router, Request, Response, NextFunction } from 'express';

export function createAdminRoutes(nauth, adminAuthService): Router {
  const router = Router();

  // WARNING: nauth.helpers.requireAuth() only verifies the JWT is valid (authentication).
  // You MUST add your own authorization middleware to restrict access to admins.

  router.post('/signup', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await adminAuthService.signup(req.body)); } catch (err) { next(err); }
  });

  router.post('/signup-social', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await adminAuthService.signupSocial(req.body)); } catch (err) { next(err); }
  });

  router.get('/users', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.getUsers(req.query)); } catch (err) { next(err); }
  });

  router.get('/users/:sub', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.getUserById(req.params as any)); } catch (err) { next(err); }
  });

  router.delete('/users/:sub', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.deleteUser(req.params as any)); } catch (err) { next(err); }
  });

  router.post('/users/:sub/disable', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.disableUser({ ...req.params, reason: req.body?.reason } as any)); } catch (err) { next(err); }
  });

  router.post('/users/:sub/enable', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.enableUser(req.params as any)); } catch (err) { next(err); }
  });

  router.post('/set-password', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.setPassword(req.body)); } catch (err) { next(err); }
  });

  router.post('/reset-password/initiate', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.resetPassword(req.body)); } catch (err) { next(err); }
  });

  router.post('/users/:sub/force-password-change', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.setMustChangePassword(req.params as any)); } catch (err) { next(err); }
  });

  router.get('/users/:sub/sessions', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.getUserSessions(req.params as any)); } catch (err) { next(err); }
  });

  router.post('/users/:sub/logout-all', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await adminAuthService.logoutAll({ sub: req.params.sub, forgetDevices: req.body?.forgetDevices })); } catch (err) { next(err); }
  });

  return router;
}

// Mount: app.use('/auth/admin', createAdminRoutes(nauth, nauth.adminAuthService))
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/admin.routes.ts"
import { FastifyInstance } from 'fastify';

export async function registerAdminRoutes(fastify: FastifyInstance, nauth, adminAuthService): Promise<void> {

  // WARNING: nauth.helpers.requireAuth() only verifies the JWT is valid (authentication).
  // You MUST add your own authorization hook to restrict access to admins.

  fastify.post('/auth/admin/signup', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await adminAuthService.signup(req.body as any));
    }) as any
  );

  fastify.post('/auth/admin/signup-social', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await adminAuthService.signupSocial(req.body as any));
    }) as any
  );

  fastify.get('/auth/admin/users', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.getUsers(req.query as any));
    }) as any
  );

  fastify.get('/auth/admin/users/:sub', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.getUserById(req.params as any));
    }) as any
  );

  fastify.delete('/auth/admin/users/:sub', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.deleteUser(req.params as any));
    }) as any
  );

  fastify.post('/auth/admin/users/:sub/disable', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.disableUser({ ...req.params, reason: (req.body as any)?.reason } as any));
    }) as any
  );

  fastify.post('/auth/admin/users/:sub/enable', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.enableUser(req.params as any));
    }) as any
  );

  fastify.post('/auth/admin/set-password', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.setPassword(req.body as any));
    }) as any
  );

  fastify.post('/auth/admin/reset-password/initiate', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.resetPassword(req.body as any));
    }) as any
  );

  fastify.post('/auth/admin/users/:sub/force-password-change', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.setMustChangePassword(req.params as any));
    }) as any
  );

  fastify.get('/auth/admin/users/:sub/sessions', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.getUserSessions(req.params as any));
    }) as any
  );

  fastify.post('/auth/admin/users/:sub/logout-all', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await adminAuthService.logoutAll({ sub: req.params.sub, forgetDevices: (req.body as any)?.forgetDevices } as any));
    }) as any
  );
}
```

</TabItem>
</Tabs>

### Admin MFA routes

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/admin-mfa.controller.ts"
import {
  Controller, Get, Post, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus, Inject,
} from '@nestjs/common';
import { AuthGuard, MFAService } from '@nauth-toolkit/nestjs';

// WARNING: Add your own authorization guard alongside AuthGuard.
@UseGuards(AuthGuard)
@Controller('auth/admin')
export class AdminMfaController {
  constructor(
    @Inject(MFAService)
    private readonly mfaService: MFAService,
  ) {}

  @Get('users/:sub/mfa/status')
  async getMfaStatus(@Param('sub') sub: string) {
    return await this.mfaService.adminGetMfaStatus({ sub });
  }

  @Get('users/:sub/mfa/devices')
  async getMfaDevices(@Param('sub') sub: string) {
    return await this.mfaService.adminGetUserDevices({ sub });
  }

  @Delete('mfa/devices/:deviceId')
  @HttpCode(HttpStatus.OK)
  async removeDevice(@Param('deviceId') deviceId: string) {
    return await this.mfaService.adminRemoveDevice({ deviceId: Number(deviceId) });
  }

  @Post('users/:sub/mfa/devices/:deviceId/preferred')
  @HttpCode(HttpStatus.OK)
  async setPreferredDevice(@Param('sub') sub: string, @Param('deviceId') deviceId: string) {
    return await this.mfaService.adminSetPreferredDevice({ sub, deviceId: Number(deviceId) });
  }

  @Post('mfa/exemption')
  @HttpCode(HttpStatus.OK)
  async setMfaExemption(@Body() dto: any) {
    return await this.mfaService.setMFAExemption(dto);
  }
}
```

Register the controller in your auth module.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/admin-mfa.routes.ts"
import { Router, Request, Response, NextFunction } from 'express';

export function createAdminMfaRoutes(nauth, mfaService): Router {
  const router = Router();

  // WARNING: Add your own authorization middleware alongside requireAuth().

  router.get('/users/:sub/mfa/status', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.adminGetMfaStatus(req.params as any)); } catch (err) { next(err); }
  });

  router.get('/users/:sub/mfa/devices', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.adminGetUserDevices(req.params as any)); } catch (err) { next(err); }
  });

  router.delete('/mfa/devices/:deviceId', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.adminRemoveDevice(req.params as any)); } catch (err) { next(err); }
  });

  router.post('/users/:sub/mfa/devices/:deviceId/preferred', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.adminSetPreferredDevice(req.params as any)); } catch (err) { next(err); }
  });

  router.post('/mfa/exemption', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body };
      if (!dto.grantedBy) dto.grantedBy = nauth.helpers.getCurrentUser()?.sub ?? null;
      res.json(await mfaService.setMFAExemption(dto));
    } catch (err) { next(err); }
  });

  return router;
}

// Mount: app.use('/auth/admin', createAdminMfaRoutes(nauth, mfaService))
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/admin-mfa.routes.ts"
import { FastifyInstance } from 'fastify';

export async function registerAdminMfaRoutes(fastify: FastifyInstance, nauth, mfaService): Promise<void> {

  // WARNING: Add your own authorization hook alongside requireAuth().

  fastify.get('/auth/admin/users/:sub/mfa/status', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminGetMfaStatus(req.params as any));
    }) as any
  );

  fastify.get('/auth/admin/users/:sub/mfa/devices', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminGetUserDevices(req.params as any));
    }) as any
  );

  fastify.delete('/auth/admin/mfa/devices/:deviceId', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminRemoveDevice(req.params as any));
    }) as any
  );

  fastify.post('/auth/admin/users/:sub/mfa/devices/:deviceId/preferred', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.adminSetPreferredDevice(req.params as any));
    }) as any
  );

  fastify.post('/auth/admin/mfa/exemption', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const dto = { ...(req.body as object), grantedBy: (req.body as any).grantedBy ?? nauth.helpers.getCurrentUser()?.sub ?? null };
      res.json(await mfaService.setMFAExemption(dto as any));
    }) as any
  );
}
```

</TabItem>
</Tabs>

### Admin audit route

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/admin.controller.ts"
// Add to your AdminController:

@Get('audit/history')
async getAuditHistory(@Query() query: any) {
  return await this.auditService.getUserAuthHistory(query);
}
```

Inject `AuthAuditService` (or access it via the nauth instance) in the constructor.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/admin.routes.ts"
// Add to your admin routes:

router.get('/audit/history', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await nauth.auditService!.getUserAuthHistory(req.query as any)); } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/admin.routes.ts"
// Add to your admin routes:

fastify.get('/auth/admin/audit/history', { preHandler: [nauth.helpers.requireAuth()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.auditService!.getUserAuthHistory(req.query as any));
  }) as any
);
```

</TabItem>
</Tabs>

## Step 2: User Management

### Create a user

```
POST /auth/admin/signup
```

**Request body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "isEmailVerified": true,
  "mustChangePassword": false
}
```

**Response:**

```json
{
  "user": {
    "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "isActive": true,
    "isLocked": false,
    "mfaEnabled": false,
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Create with auto-generated password

```json
{
  "email": "john@example.com",
  "generatePassword": true,
  "isEmailVerified": true,
  "mustChangePassword": true
}
```

**Response** — includes the one-time generated password:

```json
{
  "user": { "sub": "...", "email": "john@example.com" },
  "generatedPassword": "Kx9#mP2$vN7@qR4!"
}
```

The generated password is returned **once** and never stored in plain text. Deliver it securely to the user.

When `mustChangePassword: true`, the user's next login returns a `FORCE_CHANGE_PASSWORD` challenge — they must set a new password before receiving tokens. See [Basic Auth Flows > Other challenge types](/docs/guides/basic-auth#other-challenge-types-same-endpoint) for challenge handling.

#### All request fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `email` | string | Yes | — | User email address |
| `password` | string | Conditional | — | Required unless `generatePassword: true` |
| `username` | string | No | — | Unique username (3-50 chars) |
| `firstName` | string | No | — | First name |
| `lastName` | string | No | — | Last name |
| `phone` | string | No | — | Phone in E.164 format (`+14155552671`) |
| `metadata` | object | No | — | Custom fields |
| `isEmailVerified` | boolean | No | `false` | Skip email verification |
| `isPhoneVerified` | boolean | No | `false` | Skip phone verification |
| `mustChangePassword` | boolean | No | `false` | Force password change on next login |
| `generatePassword` | boolean | No | `false` | Auto-generate a secure password |

### Import a social user

Use this to migrate users from Cognito, Auth0, Firebase, or any OAuth provider.

```
POST /auth/admin/signup-social
```

**Request body:**

```json
{
  "email": "jane@example.com",
  "provider": "google",
  "providerId": "google_12345",
  "providerEmail": "jane@gmail.com",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response:**

```json
{
  "user": {
    "sub": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "isEmailVerified": true,
    "hasSocialAuth": true,
    "socialProviders": ["google"]
  },
  "socialAccount": {
    "provider": "google",
    "providerId": "google_12345",
    "providerEmail": "jane@gmail.com"
  }
}
```

For hybrid accounts (social + password), include the `password` field. The user can then log in with either method.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | User email (auto-verified for social imports) |
| `provider` | string | Yes | `'google'` \| `'apple'` \| `'facebook'` |
| `providerId` | string | Yes | Provider's unique user ID |
| `providerEmail` | string | No | Email from the provider (may differ from user email) |
| `password` | string | No | For hybrid social + password accounts |
| `socialMetadata` | object | No | Raw OAuth profile data (stored for audit) |
| `firstName`, `lastName`, `username`, `phone`, `metadata` | — | No | Same as admin signup |
| `isPhoneVerified` | boolean | No | Skip phone verification |
| `mustChangePassword` | boolean | No | Only relevant if `password` is provided |

### List users

```
GET /auth/admin/users?page=1&limit=20&isEmailVerified=true&sortBy=createdAt&sortOrder=DESC
```

**Response:**

```json
{
  "users": [
    {
      "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isEmailVerified": true,
      "isPhoneVerified": false,
      "isActive": true,
      "isLocked": false,
      "mfaEnabled": true,
      "hasSocialAuth": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-02-01T14:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

#### Filter parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `page` | number | Page number (1-indexed, default: 1) |
| `limit` | number | Records per page (default: 10, max: 100) |
| `email` | string | Partial match on email |
| `phone` | string | Partial match on phone |
| `isEmailVerified` | boolean | Filter by email verification status |
| `isPhoneVerified` | boolean | Filter by phone verification status |
| `hasSocialAuth` | boolean | Filter by social auth presence |
| `isLocked` | boolean | Filter by account lock status |
| `mfaEnabled` | boolean | Filter by MFA enrollment |
| `createdAt[operator]` | string | Date comparison: `gt`, `gte`, `lt`, `lte`, `eq` |
| `createdAt[value]` | string | ISO 8601 date |
| `updatedAt[operator]` | string | Same operators as `createdAt` |
| `updatedAt[value]` | string | ISO 8601 date |
| `sortBy` | string | `'email'` \| `'createdAt'` \| `'updatedAt'` \| `'username'` \| `'phone'` |
| `sortOrder` | string | `'ASC'` \| `'DESC'` (default: `'DESC'`) |

### Get a single user

```
GET /auth/admin/users/:sub
```

Returns the same user object as listed above.

### Delete a user

```
DELETE /auth/admin/users/:sub
```

**Response** — cascade cleanup counts:

```json
{
  "success": true,
  "deletedUserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "deletedRecords": {
    "sessions": 3,
    "verificationTokens": 1,
    "mfaDevices": 2,
    "trustedDevices": 1,
    "socialAccounts": 1,
    "loginAttempts": 12,
    "challengeSessions": 0,
    "auditLogs": 47
  }
}
```

### Disable a user

Locks the account and revokes all active sessions immediately.

```
POST /auth/admin/users/:sub/disable
```

**Request body (optional):**

```json
{
  "reason": "Account compromised"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "sub": "a1b2c3d4-...",
    "isLocked": true,
    "isActive": false
  },
  "revokedSessions": 3
}
```

### Enable a user

```
POST /auth/admin/users/:sub/enable
```

**Response:**

```json
{
  "success": true,
  "user": {
    "sub": "a1b2c3d4-...",
    "isLocked": false,
    "isActive": true
  }
}
```

## Step 3: Password Management

### Set password directly

Sets a new password without requiring the old one. Optionally revokes all sessions.

```
POST /auth/admin/set-password
```

**Request body:**

```json
{
  "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "newPassword": "NewSecurePass123!",
  "mustChangePassword": true,
  "revokeSessions": true
}
```

**Response:**

```json
{
  "success": true,
  "mustChangePassword": true,
  "sessionsRevoked": 3
}
```

### Initiate password reset

Sends a reset code via email or SMS. The user completes the reset via the standard `/auth/forgot-password/confirm` endpoint.

```
POST /auth/admin/reset-password/initiate
```

**Request body:**

```json
{
  "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "deliveryMethod": "email",
  "baseUrl": "https://myapp.com/reset-password",
  "revokeSessions": true,
  "reason": "User requested via support ticket"
}
```

**Response:**

```json
{
  "success": true,
  "destination": "j***@example.com",
  "deliveryMedium": "email",
  "expiresIn": 3600,
  "sessionsRevoked": 3
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sub` | string | — | User UUID (required) |
| `deliveryMethod` | string | `'email'` | `'email'` or `'sms'` |
| `baseUrl` | string | — | Base URL for building the reset link (optional) |
| `codeExpiresIn` | number | `3600` | Code expiry in seconds (300–86400) |
| `revokeSessions` | boolean | `false` | Revoke all sessions immediately |
| `reason` | string | — | Audit trail reason (max 500 chars) |

### Force password change

Flags the user to change their password on the next login. The next login returns a `FORCE_CHANGE_PASSWORD` challenge.

```
POST /auth/admin/users/:sub/force-password-change
```

**Response:**

```json
{
  "success": true
}
```

## Step 4: Session Management

### Get user sessions

```
GET /auth/admin/users/:sub/sessions
```

**Response:**

```json
{
  "sessions": [
    {
      "sessionId": "sess_abc123",
      "deviceId": "dev_xyz789",
      "deviceName": "Chrome on MacOS",
      "deviceType": "desktop",
      "platform": "macOS",
      "browser": "Chrome 120",
      "ipAddress": "203.0.113.42",
      "ipCountry": "US",
      "ipCity": "San Francisco",
      "lastActivityAt": "2025-02-15T10:30:00.000Z",
      "createdAt": "2025-02-01T08:00:00.000Z",
      "expiresAt": "2025-03-01T08:00:00.000Z",
      "isTrustedDevice": true,
      "isCurrent": false,
      "authMethod": "password",
      "authProvider": null
    }
  ]
}
```

### Logout all sessions

Signs the user out from all devices. Optionally revokes trusted device status.

```
POST /auth/admin/users/:sub/logout-all
```

**Request body (optional):**

```json
{
  "forgetDevices": true
}
```

**Response:**

```json
{
  "revokedCount": 5
}
```

## Step 5: Admin MFA Management

### Get MFA status

```
GET /auth/admin/users/:sub/mfa/status
```

**Response:**

```json
{
  "enabled": true,
  "required": false,
  "configuredMethods": ["totp", "passkey"],
  "availableMethods": ["email", "sms", "totp", "passkey"],
  "preferredMethod": "totp"
}
```

### List MFA devices

```
GET /auth/admin/users/:sub/mfa/devices
```

**Response:**

```json
{
  "devices": [
    {
      "id": 1,
      "type": "totp",
      "name": "Google Authenticator",
      "isPreferred": true,
      "isActive": true,
      "createdAt": "2025-01-10T12:00:00.000Z"
    },
    {
      "id": 2,
      "type": "passkey",
      "name": "MacBook Pro Touch ID",
      "isPreferred": false,
      "isActive": true,
      "createdAt": "2025-01-15T09:00:00.000Z"
    }
  ]
}
```

### Remove an MFA device

```
DELETE /auth/admin/mfa/devices/:deviceId
```

**Response:**

```json
{
  "removedDeviceId": 2,
  "message": "Device removed successfully"
}
```

### Set preferred MFA device

```
POST /auth/admin/users/:sub/mfa/devices/:deviceId/preferred
```

**Response:**

```json
{
  "message": "Preferred device updated"
}
```

### Grant or revoke MFA exemption

Exempt a user from MFA requirements (e.g., service accounts).

```
POST /auth/admin/mfa/exemption
```

**Request body:**

```json
{
  "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "exempt": true,
  "reason": "Service account — no human login",
  "grantedBy": "admin-user-uuid"
}
```

**Response:**

```json
{
  "message": "MFA exemption granted"
}
```

## Step 6: Frontend SDK

The frontend SDK provides `client.admin.*` methods that call the admin endpoints above. This works with any frontend framework.

### Configure

Enable admin operations by adding the `admin` block to your client config:

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const auth = new NAuthClient({
  baseUrl: 'https://api.example.com',
  authPathPrefix: '/auth',
  tokenDelivery: 'cookies',
  admin: {
    pathPrefix: '/admin',    // Matches your backend route prefix
  },
});
```

The SDK builds admin URLs as: `baseUrl` + `authPathPrefix` + `admin.pathPrefix` + endpoint path. With the config above, `getUsers()` calls `https://api.example.com/auth/admin/users`.

#### Configuration options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `pathPrefix` | string | `'/admin'` | Prefix prepended to all admin endpoint paths |
| `endpoints` | object | — | Override individual endpoint paths (see below) |
| `headers` | object | — | Additional headers sent with every admin request |

#### Default endpoint paths

All paths are relative to `authPathPrefix` + `admin.pathPrefix`:

| Key | Default Path | Method |
| --- | --- | --- |
| `signup` | `/signup` | POST |
| `signupSocial` | `/signup-social` | POST |
| `getUsers` | `/users` | GET |
| `getUser` | `/users/:sub` | GET |
| `deleteUser` | `/users/:sub` | DELETE |
| `disableUser` | `/users/:sub/disable` | POST |
| `enableUser` | `/users/:sub/enable` | POST |
| `forcePasswordChange` | `/users/:sub/force-password-change` | POST |
| `setPassword` | `/set-password` | POST |
| `resetPasswordInitiate` | `/reset-password/initiate` | POST |
| `getUserSessions` | `/users/:sub/sessions` | GET |
| `logoutAll` | `/users/:sub/logout-all` | POST |
| `getMfaStatus` | `/users/:sub/mfa/status` | GET |
| `getMfaDevices` | `/users/:sub/mfa/devices` | GET |
| `removeMfaDeviceById` | `/mfa/devices/:deviceId` | DELETE |
| `setPreferredMfaDevice` | `/users/:sub/mfa/devices/:deviceId/preferred` | POST |
| `setMfaExemption` | `/mfa/exemption` | POST |
| `getAuditHistory` | `/audit/history` | GET |

Override individual paths if your backend uses different URLs:

```typescript
admin: {
  pathPrefix: '/admin',
  endpoints: {
    getUsers: '/users/list',        // Override just this one
  },
},
```

### User management

```typescript
// Create a user
const { user, generatedPassword } = await auth.admin.createUser({
  email: 'john@example.com',
  generatePassword: true,
  isEmailVerified: true,
  mustChangePassword: true,
});

// Import a social user
const { user, socialAccount } = await auth.admin.importSocialUser({
  email: 'jane@example.com',
  provider: 'google',
  providerId: 'google_12345',
  providerEmail: 'jane@gmail.com',
});

// List users with filters
const { users, pagination } = await auth.admin.getUsers({
  page: 1,
  limit: 20,
  isEmailVerified: true,
  mfaEnabled: false,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
});

// Date range filter
const { users } = await auth.admin.getUsers({
  createdAt: { operator: 'gte', value: new Date('2025-01-01') },
});

// Get a single user
const user = await auth.admin.getUser('a1b2c3d4-...');

// Delete a user
const { deletedRecords } = await auth.admin.deleteUser('a1b2c3d4-...');

// Disable / enable
const { revokedSessions } = await auth.admin.disableUser('a1b2c3d4-...', 'Suspicious activity');
await auth.admin.enableUser('a1b2c3d4-...');
```

### Password management

```typescript
// Set password directly
await auth.admin.setPassword('john@example.com', 'NewSecurePass123!');

// Initiate password reset (sends email/SMS)
const { destination } = await auth.admin.initiatePasswordReset({
  sub: 'a1b2c3d4-...',
  deliveryMethod: 'email',
  baseUrl: 'https://myapp.com/reset-password',
  revokeSessions: true,
});

// Force password change on next login
await auth.admin.forcePasswordChange('a1b2c3d4-...');
```

### Session management

```typescript
// Get all sessions
const { sessions } = await auth.admin.getUserSessions('a1b2c3d4-...');

// Logout all sessions + revoke trusted devices
const { revokedCount } = await auth.admin.logoutAllSessions('a1b2c3d4-...', true);
```

### MFA management

```typescript
// Check MFA status
const status = await auth.admin.getMfaStatus('a1b2c3d4-...');
console.log(status.enabled, status.configuredMethods);

// List MFA devices
const { devices } = await auth.admin.getMfaDevices('a1b2c3d4-...');

// Remove a device
await auth.admin.removeMfaDeviceById(123);

// Set preferred device
await auth.admin.setPreferredMfaDevice('a1b2c3d4-...', 123);

// Grant MFA exemption
await auth.admin.setMfaExemption('a1b2c3d4-...', true, 'Service account');

// Revoke MFA exemption
await auth.admin.setMfaExemption('a1b2c3d4-...', false);
```

### Audit history

```typescript
const history = await auth.admin.getAuditHistory({
  sub: 'a1b2c3d4-...',
  page: 1,
  limit: 50,
  eventType: 'LOGIN_SUCCESS',
});
```

## Error Codes

Common errors returned by admin endpoints:

| Error Code | Description | Resolution |
| --- | --- | --- |
| `NOT_FOUND` | User not found | Check the `sub` UUID |
| `EMAIL_EXISTS` | Email already registered | Use a different email |
| `USERNAME_EXISTS` | Username already taken | Use a different username |
| `PHONE_EXISTS` | Phone already registered | Use a different phone number |
| `WEAK_PASSWORD` | Password doesn't meet policy | Use a stronger password |
| `SOCIAL_ACCOUNT_EXISTS` | Provider + providerId already linked | This social account is already imported |
| `VALIDATION_FAILED` | Invalid request format | Check required fields and formats |

## What's Next

- **[Basic Auth Flows](/docs/guides/basic-auth)** — Core authentication (signup, login, challenges)
- **[MFA](/docs/guides/mfa/how-mfa-works)** — Multi-factor authentication setup
- **[Audit Logs](/docs/guides/audit-logs)** — Query user activity history and display login events
- **[Lifecycle Hooks](/docs/guides/lifecycle-hooks)** — Hook into auth events for custom logic (e.g., send welcome email after admin signup)
- **[Challenge System](/docs/concepts/challenge-system)** — How `FORCE_CHANGE_PASSWORD` and other challenges work
