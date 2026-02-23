---
title: "Email MFA"
description: "Add email-based multi-factor authentication with verification codes"
sidebar_position: 1
keywords: [mfa, 2fa, email, verification, multi-factor, authentication]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Email MFA

Add email-based multi-factor authentication. By the end of this guide you will have these endpoints working:

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/mfa/status` | GET | Protected | Check MFA enrollment status |
| `/auth/mfa/setup-data` | POST | Protected | Initiate Email MFA setup (sends code) |
| `/auth/mfa/verify-setup` | POST | Protected | Confirm setup with email code |
| `/auth/mfa/devices` | GET | Protected | List enrolled MFA devices |
| `/auth/mfa/devices/:id/preferred` | POST | Protected | Set preferred MFA device |
| `/auth/mfa/devices/:id` | DELETE | Protected | Remove an MFA device |
| `/auth/respond-challenge` | POST | Public | Complete MFA challenge during login |
| `/auth/challenge/setup-data` | POST | Public | Get setup data during forced MFA setup |
| `/auth/challenge/resend` | POST | Public | Resend MFA verification code |

Email MFA is the simplest method — it uses your existing email provider and requires no additional user setup (the email is already on file).

:::tip Sample apps
Email MFA is fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth) — see the NestJS, Express, and Fastify examples for MFA routes, and the Angular example for `mfa-setup.component.ts` and `otp-verify.component.ts`.
:::

## Prerequisites

- [Basic Auth Flows](/docs/guides/basic-auth) are working (signup, login, challenge endpoints)
- An email provider is configured (use `ConsoleEmailProvider` for development)

## Step 1: Install

```bash npm2yarn
npm install @nauth-toolkit/mfa-email
```

## Step 2: Configure

```typescript title="config/auth.config.ts"
import { MFAMethod } from '@nauth-toolkit/core';

mfa: {
  enabled: true,
  enforcement: 'OPTIONAL',            // OPTIONAL | REQUIRED | ADAPTIVE
  allowedMethods: [MFAMethod.EMAIL],

  rememberDevices: 'user_opt_in',
  rememberDeviceDays: 30,
  bypassMFAForTrustedDevices: true,
},
```

See [How MFA Works > Configuration](/docs/guides/mfa/how-mfa-works#configuration) for the full config reference including enforcement modes, device trust, and grace periods.

## Step 3: Add Backend Routes

### MFA management routes (protected — user must be logged in)

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/mfa.controller.ts"
import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { AuthGuard, MFAService } from '@nauth-toolkit/nestjs';

@UseGuards(AuthGuard)
@Controller('auth/mfa')
export class MfaController {
  constructor(
    @Optional() @Inject(MFAService)
    private readonly mfaService?: MFAService,
  ) {}

  @Get('status')
  async getStatus() {
    return await this.mfaService.getMfaStatus();
  }

  @Post('setup-data')
  @HttpCode(HttpStatus.OK)
  async setup(@Body() dto: any) {
    return await this.mfaService.setup(dto);
  }

  @Post('verify-setup')
  @HttpCode(HttpStatus.OK)
  async verifySetup(@Body() dto: any) {
    const provider = this.mfaService.getProvider(dto.methodName);
    const deviceId = await provider.verifySetup(dto.setupData);
    return { deviceId };
  }

  @Get('devices')
  async getDevices() {
    return await this.mfaService.getUserDevices({});
  }

  @Post('devices/:deviceId/preferred')
  @HttpCode(HttpStatus.OK)
  async setPreferred(@Param('deviceId') deviceId: string) {
    return await this.mfaService.setPreferredDevice({ deviceId } as any);
  }

  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.OK)
  async removeDevice(@Param('deviceId') deviceId: string) {
    return await this.mfaService.removeDevice({ deviceId } as any);
  }
}
```

Register the controller in your auth module.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/mfa.routes.ts"
import { Router, Request, Response, NextFunction } from 'express';

export function createMfaRoutes(nauth, mfaService): Router {
  const router = Router();

  router.get('/status', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.getMfaStatus()); } catch (err) { next(err); }
  });

  router.post('/setup-data', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.setup(req.body)); } catch (err) { next(err); }
  });

  router.post('/verify-setup', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = mfaService.getProvider(req.body.methodName);
      const deviceId = await provider.verifySetup(req.body.setupData);
      res.json({ deviceId });
    } catch (err) { next(err); }
  });

  router.get('/devices', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.getUserDevices({})); } catch (err) { next(err); }
  });

  router.post('/devices/:deviceId/preferred', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.setPreferredDevice(req.params as any)); } catch (err) { next(err); }
  });

  router.delete('/devices/:deviceId', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mfaService.removeDevice(req.params as any)); } catch (err) { next(err); }
  });

  return router;
}

// Mount: app.use('/auth/mfa', createMfaRoutes(nauth, mfaService))
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/mfa.routes.ts"
import { FastifyInstance } from 'fastify';

export async function registerMfaRoutes(fastify: FastifyInstance, nauth, mfaService): Promise<void> {
  fastify.get('/auth/mfa/status', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await mfaService.getMfaStatus());
    }) as any
  );

  fastify.post('/auth/mfa/setup-data', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.setup(req.body as any));
    }) as any
  );

  fastify.post('/auth/mfa/verify-setup', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      const body = req.body as any;
      const provider = mfaService.getProvider(body.methodName);
      const deviceId = await provider.verifySetup(body.setupData);
      res.json({ deviceId });
    }) as any
  );

  fastify.get('/auth/mfa/devices', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (_req, res) => {
      res.json(await mfaService.getUserDevices({}));
    }) as any
  );

  fastify.post('/auth/mfa/devices/:deviceId/preferred', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.setPreferredDevice(req.params as any));
    }) as any
  );

  fastify.delete('/auth/mfa/devices/:deviceId', { preHandler: [nauth.helpers.requireAuth()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.json(await mfaService.removeDevice(req.params as any));
    }) as any
  );
}
```

</TabItem>
</Tabs>

### Challenge helper routes (public — used during login)

Add these to your existing auth controller/routes from the [Basic Auth Flows](/docs/guides/basic-auth) guide:

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/auth.controller.ts"
// Add to your existing AuthController:

@Public()
@Post('challenge/setup-data')
@HttpCode(HttpStatus.OK)
async getSetupData(@Body() dto: any) {
  if (!this.mfaService) throw new BadRequestException('MFA service is not available');
  return await this.mfaService.getSetupData(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/auth.routes.ts"
// Add to your existing auth routes:

router.post('/challenge/setup-data', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await mfaService.getSetupData(req.body)); } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/auth.routes.ts"
// Add to your existing auth routes:

fastify.post('/auth/challenge/setup-data', { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await mfaService.getSetupData(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

## Step 4: Frontend — MFA Setup (Security Settings)

When a logged-in user enables MFA from their security settings page:

### Check MFA status

```
GET /auth/mfa/status
```

**Response:**

```json
{
  "enabled": false,
  "required": false,
  "configuredMethods": [],
  "availableMethods": ["email"],
  "hasBackupCodes": false,
  "mfaExempt": false,
  "mfaExemptReason": null,
  "mfaExemptGrantedAt": null
}
```

### Initiate setup

```
POST /auth/mfa/setup-data
```

**Request body** ([`SetupMFADTO`](/docs/api/core/dto/setup-mfa-dto)):

```json
{
  "methodName": "email"
}
```

**Response** — a 6-digit code is sent to the user's email:

```json
{
  "setupData": {
    "maskedEmail": "j***@example.com"
  }
}
```

Show an input field for the user to enter the code they received.

### Verify setup

```
POST /auth/mfa/verify-setup
```

**Request body:**

```json
{
  "methodName": "email",
  "setupData": {
    "code": "123456"
  }
}
```

**Response:**

```json
{
  "deviceId": 42
}
```

MFA is now enabled. The next time this user logs in, they will receive an `MFA_REQUIRED` challenge.

### Frontend setup example

```typescript title="React — MFA setup page (simplified)"
const handleSetupEmail = async () => {
  // Step 1: Initiate setup — sends code to user's email
  const { setupData } = await fetch('/auth/mfa/setup-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'email' }),
  }).then(r => r.json());

  setMaskedEmail(setupData.maskedEmail);
  setShowCodeInput(true);
};

const handleVerify = async (code: string) => {
  // Step 2: Verify with code from email
  const { deviceId } = await fetch('/auth/mfa/verify-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'email', setupData: { code } }),
  }).then(r => r.json());

  // MFA is enabled — show success
};
```

## Step 5: Frontend — MFA Challenge (Login)

When a user with Email MFA logs in, the login response contains an `MFA_REQUIRED` challenge instead of tokens. A code is sent to their email automatically.

### Login response (MFA enabled user)

```
POST /auth/login
```

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "availableMethods": ["email"],
    "preferredMethod": "email",
    "destination": "j***@example.com",
    "deliveryMedium": "EMAIL"
  }
}
```

Show a code input screen. The user checks their email and enters the 6-digit code.

### Complete the challenge

```
POST /auth/respond-challenge
```

**Request body** ([`RespondChallengeDTO`](/docs/api/core/dto/respond-challenge-dto)):

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_REQUIRED",
  "method": "email",
  "code": "123456"
}
```

**Response** — tokens are issued:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "accessTokenExpiresAt": 1700000000,
  "refreshTokenExpiresAt": 1700600000,
  "user": {
    "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true
  }
}
```

### Resend the code

```
POST /auth/challenge/resend
```

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

Rate limited — same limits as email verification.

### Frontend challenge example

```typescript title="React — MFA challenge page (simplified)"
// After login returns MFA_REQUIRED:
const handleMfaChallenge = async (code: string) => {
  const response = await fetch('/auth/respond-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: pendingChallenge.session,
      type: 'MFA_REQUIRED',
      method: 'email',
      code,
    }),
  }).then(r => r.json());

  if (response.accessToken) {
    // Login complete — navigate to dashboard
  }
};
```

## Forced Setup (REQUIRED Enforcement)

When `enforcement: 'REQUIRED'`, users who haven't set up MFA receive an `MFA_SETUP_REQUIRED` challenge after login.

### Login response (no MFA set up)

```json
{
  "challengeName": "MFA_SETUP_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "allowedMethods": ["email"]
  }
}
```

### Get setup data during login

```
POST /auth/challenge/setup-data
```

**Request body** ([`GetSetupDataDTO`](/docs/api/core/dto/get-setup-data-dto)):

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "method": "email"
}
```

**Possible responses:**

| Scenario | Response |
| --- | --- |
| Email already verified | `{ "setupData": { "autoCompleted": true, "deviceId": 42 } }` |
| Email not yet verified | `{ "setupData": { "maskedEmail": "j***@example.com" } }` — code sent |

:::tip Auto-completion
If the user already verified their email during signup, the setup auto-completes — no additional code is needed. The frontend can proceed directly to the respond-challenge step with the `deviceId`.
:::

### Complete the challenge

**If auto-completed:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_SETUP_REQUIRED",
  "method": "email",
  "setupData": { "deviceId": 42 }
}
```

**If code verification needed:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_SETUP_REQUIRED",
  "method": "email",
  "setupData": { "code": "123456" }
}
```

Both are sent to `POST /auth/respond-challenge`. On success, tokens are issued.

## What's Next

- **[SMS MFA](/docs/guides/mfa/sms)** — SMS verification codes (requires SMS provider)
- **[TOTP MFA](/docs/guides/mfa/totp)** — Authenticator apps (Google Authenticator, Authy, 1Password)
- **[Passkey MFA](/docs/guides/mfa/passkey)** — Biometric authentication (Face ID, Touch ID, YubiKey)
- **[How MFA Works](/docs/guides/mfa/how-mfa-works)** — Adaptive MFA, error codes, device trust, enforcement modes
