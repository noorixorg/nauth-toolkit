---
title: "SMS MFA"
description: "Add SMS-based multi-factor authentication with phone verification codes"
sidebar_position: 2
keywords: [mfa, 2fa, sms, phone, verification, multi-factor, authentication]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SMS MFA

Add SMS-based multi-factor authentication. By the end of this guide you will have MFA working via text message. SMS MFA uses the **same backend routes** as [Email MFA](/docs/guides/mfa/email) — only the configuration and request/response payloads differ.

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/mfa/status` | GET | Protected | Check MFA enrollment status |
| `/auth/mfa/setup-data` | POST | Protected | Initiate SMS MFA setup (sends code) |
| `/auth/mfa/verify-setup` | POST | Protected | Confirm setup with SMS code |
| `/auth/mfa/devices` | GET | Protected | List enrolled MFA devices |
| `/auth/mfa/devices/:id/preferred` | POST | Protected | Set preferred MFA device |
| `/auth/mfa/devices/:id` | DELETE | Protected | Remove an MFA device |
| `/auth/respond-challenge` | POST | Public | Complete MFA challenge during login |
| `/auth/challenge/setup-data` | POST | Public | Get setup data during forced MFA setup |
| `/auth/challenge/resend` | POST | Public | Resend MFA verification code |

:::tip Sample apps
SMS MFA is configured in the [nauth example apps](https://github.com/noorixorg/nauth-toolkit) using `ConsoleSMSProvider` (logs to stdout). See the NestJS, Express, and Fastify examples.
:::

:::warning SMS Security
SMS is vulnerable to SIM swapping attacks. Consider offering SMS as a secondary option alongside TOTP or Passkey, which are more resistant to interception.
:::

## Prerequisites

- [Basic Auth Flows](/docs/guides/basic-auth) are working (signup, login, challenge endpoints)
- The user must have a verified phone number on their account

## Step 1: Install

```bash npm2yarn
npm install @nauth-toolkit/mfa-sms @nauth-toolkit/sms-console
```

For production, install one of the production SMS providers:

```bash npm2yarn
npm install @nauth-toolkit/mfa-sms @nauth-toolkit/sms-twilio
```

```bash npm2yarn
npm install @nauth-toolkit/mfa-sms @nauth-toolkit/sms-aws-sns
```

## Step 2: Configure

```typescript title="config/auth.config.ts"
import { MFAMethod } from '@nauth-toolkit/core';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

smsProvider: new ConsoleSMSProvider(),    // Logs SMS to console (dev only)

mfa: {
  enabled: true,
  enforcement: 'OPTIONAL',
  allowedMethods: [MFAMethod.SMS],

  rememberDevices: 'user_opt_in',
  rememberDeviceDays: 30,
  bypassMFAForTrustedDevices: true,
},
```

For production with Twilio:

```typescript title="config/auth.config.ts"
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

smsProvider: new TwilioSMSProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: process.env.TWILIO_FROM_NUMBER!,
}),
```

For production with AWS SNS:

```typescript title="config/auth.config.ts"
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

smsProvider: new AWSSMSProvider({
  region: 'us-east-1',
  originationNumber: process.env.AWS_SMS_ORIGINATION || '+12345678901',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}),
```

## Step 3: Add Backend Routes

:::note Already have MFA routes?
If you already set up routes for another MFA method (Email, TOTP, Passkey), the same routes handle SMS — just add `MFAMethod.SMS` to `allowedMethods` in your config and skip to [Step 4](#step-4-frontend--mfa-setup-security-settings).
:::

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

### Challenge helper route (public — used during login)

Add to your existing auth controller/routes from the [Basic Auth Flows](/docs/guides/basic-auth) guide:

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

### Initiate setup

```
POST /auth/mfa/setup-data
```

**Request body:**

```json
{
  "methodName": "sms"
}
```

**Response** — a 6-digit code is sent via text message:

```json
{
  "setupData": {
    "maskedPhone": "+1***5678"
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
  "methodName": "sms",
  "setupData": {
    "code": "123456"
  }
}
```

**Response:**

```json
{
  "deviceId": 43
}
```

MFA is now enabled. The next login triggers an `MFA_REQUIRED` challenge via SMS.

### Frontend setup example

```typescript title="React — SMS MFA setup (simplified)"
const handleSetupSms = async () => {
  const { setupData } = await fetch('/auth/mfa/setup-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'sms' }),
  }).then(r => r.json());

  setMaskedPhone(setupData.maskedPhone);
  setShowCodeInput(true);
};

const handleVerify = async (code: string) => {
  const { deviceId } = await fetch('/auth/mfa/verify-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'sms', setupData: { code } }),
  }).then(r => r.json());

  // MFA is enabled
};
```

## Step 5: Frontend — MFA Challenge (Login)

When a user with SMS MFA logs in, the login response contains an `MFA_REQUIRED` challenge. A code is sent to their phone automatically.

### Login response (MFA enabled user)

```
POST /auth/login
```

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "availableMethods": ["sms"],
    "preferredMethod": "sms",
    "destination": "+1***5678",
    "deliveryMedium": "SMS"
  }
}
```

### Complete the challenge

```
POST /auth/respond-challenge
```

**Request body:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_REQUIRED",
  "method": "sms",
  "code": "123456"
}
```

**Response** — tokens are issued (same structure as [Email MFA](/docs/guides/mfa/email#complete-the-challenge)).

### Frontend challenge example

```typescript title="React — SMS MFA challenge (simplified)"
const handleMfaChallenge = async (code: string) => {
  const response = await fetch('/auth/respond-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: pendingChallenge.session,
      type: 'MFA_REQUIRED',
      method: 'sms',
      code,
    }),
  }).then(r => r.json());

  if (response.accessToken) {
    // Login complete
  }
};
```

## Forced Setup (REQUIRED Enforcement)

When `enforcement: 'REQUIRED'`, users without MFA receive an `MFA_SETUP_REQUIRED` challenge after login.

### Login response (no MFA set up)

```json
{
  "challengeName": "MFA_SETUP_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "allowedMethods": ["sms"]
  }
}
```

### Get setup data during login

```
POST /auth/challenge/setup-data
```

**Request body:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "method": "sms"
}
```

**Possible responses:**

| Scenario | Response |
| --- | --- |
| Phone already verified | `{ "setupData": { "autoCompleted": true, "deviceId": 43 } }` |
| Phone not yet verified | `{ "setupData": { "maskedPhone": "+1***5678" } }` — code sent |

### Complete the challenge

**If auto-completed:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_SETUP_REQUIRED",
  "method": "sms",
  "setupData": { "deviceId": 43 }
}
```

**If code verification needed:**

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_SETUP_REQUIRED",
  "method": "sms",
  "setupData": { "code": "123456" }
}
```

Both are sent to `POST /auth/respond-challenge`. On success, tokens are issued.

:::note Phone number collection
If the user doesn't have a phone number on their account, the challenge system can collect it during a `VERIFY_PHONE` challenge. See [Basic Auth Flows > Other challenge types](/docs/guides/basic-auth#other-challenge-types-same-endpoint) for the phone number collection flow.
:::

## What's Next

- **[Email MFA](/docs/guides/mfa/email)** — Email verification codes (simplest to set up)
- **[TOTP MFA](/docs/guides/mfa/totp)** — Authenticator apps (Google Authenticator, Authy, 1Password)
- **[Passkey MFA](/docs/guides/mfa/passkey)** — Biometric authentication (Face ID, Touch ID, YubiKey)
- **[How MFA Works](/docs/guides/mfa/how-mfa-works)** — Adaptive MFA, error codes, device trust, enforcement modes
