---
title: "TOTP MFA"
description: "Add authenticator app MFA with TOTP — Google Authenticator, Authy, 1Password"
sidebar_position: 3
keywords: [mfa, 2fa, totp, authenticator, google authenticator, authy, qr code, otp]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TOTP MFA

Add time-based one-time password (TOTP) authentication. By the end of this guide, users will scan a QR code with their authenticator app and enter 6-digit codes during login. TOTP is the most popular MFA method — it works offline, has no delivery costs, and is supported by all major authenticator apps.

**Supported apps:** Google Authenticator, Microsoft Authenticator, Authy, 1Password, Duo Mobile, Bitwarden

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/mfa/status` | GET | Protected | Check MFA enrollment status |
| `/auth/mfa/setup-data` | POST | Protected | Generate QR code and secret |
| `/auth/mfa/verify-setup` | POST | Protected | Confirm setup with test code from authenticator |
| `/auth/mfa/devices` | GET | Protected | List enrolled MFA devices |
| `/auth/mfa/devices/:id/preferred` | POST | Protected | Set preferred MFA device |
| `/auth/mfa/devices/:id` | DELETE | Protected | Remove an MFA device |
| `/auth/respond-challenge` | POST | Public | Complete TOTP challenge during login |
| `/auth/challenge/setup-data` | POST | Public | Get setup data during forced MFA setup |

:::tip Sample apps
TOTP MFA is fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth) — see the NestJS, Express, and Fastify examples for MFA routes, and the Angular example for `mfa-setup.component.ts`.
:::

## Prerequisites

- [Basic Auth Flows](/docs/guides/basic-auth) are working (signup, login, challenge endpoints)
- TOTP has no external dependency — it uses a shared secret and time-based algorithm

## Step 1: Install

```bash npm2yarn
npm install @nauth-toolkit/mfa-totp
```

## Step 2: Configure

```typescript title="config/auth.config.ts"
import { MFAMethod } from '@nauth-toolkit/core';

mfa: {
  enabled: true,
  enforcement: 'OPTIONAL',
  allowedMethods: [MFAMethod.TOTP],
  issuer: 'YourAppName',                // Shown in authenticator apps

  totp: {
    window: 1,                           // Allow ±1 time step (30s tolerance)
    stepSeconds: 30,                     // Code changes every 30 seconds
    digits: 6,                           // 6-digit codes
    algorithm: 'sha1',                   // 'sha1' | 'sha256' | 'sha512'
  },

  rememberDevices: 'user_opt_in',
  rememberDeviceDays: 30,
  bypassMFAForTrustedDevices: true,
},
```

The `issuer` appears in the authenticator app as the account label (e.g., "YourAppName: user@example.com").

## Step 3: Add Backend Routes

:::note Already have MFA routes?
If you already set up routes for another MFA method (Email, SMS, Passkey), the same routes handle TOTP — just add `MFAMethod.TOTP` to `allowedMethods` in your config and skip to [Step 4](#step-4-frontend--mfa-setup-security-settings).
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
    @Inject(MFAService)
    private readonly mfaService: MFAService,
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

TOTP setup is different from email/SMS — instead of receiving a code, the user scans a QR code and enters a test code to confirm.

### Generate QR code

```
POST /auth/mfa/setup-data
```

**Request body:**

```json
{
  "methodName": "totp"
}
```

**Response** — includes a QR code (base64 PNG) and a manual entry key:

```json
{
  "setupData": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "manualEntryKey": "JBSW Y3DP EHPK 3PXP",
    "issuer": "YourAppName",
    "accountName": "user@example.com"
  }
}
```

Display the QR code for the user to scan with their authenticator app. Show `manualEntryKey` as a fallback for users who can't scan.

:::note QR code format
The QR code encodes a standard `otpauth://` URI:
```
otpauth://totp/YourAppName:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=YourAppName&algorithm=SHA1&digits=6&period=30
```
:::

### Verify with test code

After scanning, the user enters the current 6-digit code from their authenticator app.

```
POST /auth/mfa/verify-setup
```

**Request body:**

```json
{
  "methodName": "totp",
  "setupData": {
    "code": "123456"
  }
}
```

**Response:**

```json
{
  "deviceId": 44
}
```

TOTP MFA is now enabled. The next login triggers an `MFA_REQUIRED` challenge.

### Frontend setup example

```typescript title="React — TOTP setup page (simplified)"
const [setupData, setSetupData] = useState(null);
const [code, setCode] = useState('');

const handleSetupTotp = async () => {
  // Step 1: Get QR code
  const { setupData } = await fetch('/auth/mfa/setup-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'totp' }),
  }).then(r => r.json());

  setSetupData(setupData);
};

const handleVerify = async () => {
  // Step 2: Verify with code from authenticator app
  const { deviceId } = await fetch('/auth/mfa/verify-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'totp', setupData: { code } }),
  }).then(r => r.json());

  // TOTP MFA is enabled
};

// Render:
{setupData && (
  <>
    <h2>Scan this QR code with your authenticator app</h2>
    <img src={setupData.qrCode} alt="TOTP QR Code" />
    <p>Or enter this key manually: <code>{setupData.manualEntryKey}</code></p>
    <input
      type="text"
      inputMode="numeric"
      placeholder="Enter 6-digit code"
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
    <button onClick={handleVerify} disabled={code.length < 6}>Verify & Enable</button>
  </>
)}
```

## Step 5: Frontend — MFA Challenge (Login)

When a user with TOTP MFA logs in, no code is sent — the user generates it from their authenticator app.

### Login response (MFA enabled user)

```
POST /auth/login
```

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "eyJhbGciOiJIUzI1NiJ9...",
  "challengeParameters": {
    "availableMethods": ["totp"],
    "preferredMethod": "totp"
  }
}
```

Note: No `destination` or `deliveryMedium` — TOTP codes are generated locally. Hide the "Resend code" button in your UI when the method is `totp`.

### Complete the challenge

```
POST /auth/respond-challenge
```

**Request body:**

```json
{
  "session": "eyJhbGciOiJIUzI1NiJ9...",
  "type": "MFA_REQUIRED",
  "method": "totp",
  "code": "123456"
}
```

**Response** — tokens are issued (same structure as [Email MFA](/docs/guides/mfa/email#complete-the-challenge)).

### Frontend challenge example

```typescript title="React — TOTP challenge page (simplified)"
const mfaMethod = challenge.challengeParameters.preferredMethod;
const isTotp = mfaMethod === 'totp';

// Heading:
isTotp
  ? 'Enter the 6-digit code from your authenticator app.'
  : `We sent a 6-digit code to ${challenge.challengeParameters.destination}.`;

// Hide resend button for TOTP:
{!isTotp && (
  <button onClick={handleResend}>Resend code</button>
)}

const handleSubmit = async (code: string) => {
  const response = await fetch('/auth/respond-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: challenge.session,
      type: 'MFA_REQUIRED',
      method: mfaMethod,
      code,
    }),
  }).then(r => r.json());

  if (response.accessToken) {
    // Login complete
  }
};
```

## Troubleshooting

### Codes not working

**Clock skew:** TOTP codes are time-based. If the user's device clock is out of sync, codes will be rejected. Ensure devices use automatic time synchronization. The `window: 1` setting tolerates ±30 seconds of drift.

**Wrong secret:** If the user scanned the QR code twice or has an old entry, codes will fail. Remove the old entry in the authenticator app and re-scan a freshly generated QR code.

## What's Next

- **[Passkey MFA](/docs/guides/mfa/passkey)** — Biometric authentication (Face ID, Touch ID, YubiKey)
- **[Email MFA](/docs/guides/mfa/email)** — Email verification codes (simplest to set up)
- **[SMS MFA](/docs/guides/mfa/sms)** — SMS verification codes
- **[How MFA Works](/docs/guides/mfa/how-mfa-works)** — Adaptive MFA, error codes, device trust, enforcement modes
