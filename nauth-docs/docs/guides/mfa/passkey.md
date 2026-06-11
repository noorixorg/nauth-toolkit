---
title: "Passkey MFA"
description: "Add WebAuthn passkey authentication with biometrics and security keys"
sidebar_position: 4
keywords: [mfa, 2fa, passkey, webauthn, fido2, biometric, face id, touch id, yubikey]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Passkey MFA

Add passkey-based multi-factor authentication using WebAuthn. By the end of this guide, users will authenticate with biometrics (Face ID, Touch ID, Windows Hello) or hardware security keys (YubiKey). Passkeys are the most secure MFA method — phishing-resistant, public key cryptography, no shared secrets.

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/mfa/status` | GET | Protected | Check MFA enrollment status |
| `/auth/mfa/setup-data` | POST | Protected | Generate WebAuthn registration options |
| `/auth/mfa/verify-setup` | POST | Protected | Complete registration with credential |
| `/auth/mfa/devices` | GET | Protected | List enrolled MFA devices |
| `/auth/mfa/devices/:id/preferred` | POST | Protected | Set preferred MFA device |
| `/auth/mfa/devices/:id` | DELETE | Protected | Remove an MFA device |
| `/auth/respond-challenge` | POST | Public | Complete passkey challenge during login |
| `/auth/challenge/challenge-data` | POST | Public | Get WebAuthn assertion options during login |
| `/auth/challenge/setup-data` | POST | Public | Get setup data during forced MFA setup |

:::tip Sample apps
Passkey MFA is fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth-toolkit) — see the NestJS, Express, and Fastify examples for MFA routes, and the Angular example for `passkey-setup.component.ts`.
:::

## Prerequisites

- [Basic Auth Flows](/docs/guides/basic-auth) are working (signup, login, challenge endpoints)
- HTTPS in production (WebAuthn requires a secure context)
- A configured Relying Party (RP) domain

## Step 1: Install

```bash npm2yarn
npm install @nauth-toolkit/mfa-passkey
```

## Step 2: Configure

```typescript title="config/auth.config.ts"
import { MFAMethod } from '@nauth-toolkit/core';

mfa: {
  enabled: true,
  enforcement: 'OPTIONAL',
  allowedMethods: [MFAMethod.PASSKEY],

  passkey: {
    rpName: 'Your App Name',                   // Shown in browser prompt
    rpId: 'yourdomain.com',                    // Must match the origin domain
    origin: ['https://yourdomain.com'],        // Allowed origins
    timeout: 60000,                            // 60 seconds for user interaction
    userVerification: 'preferred',             // 'required' | 'preferred' | 'discouraged'
    authenticatorAttachment: 'platform',       // 'platform' (built-in) | 'cross-platform' (external keys)
  },

  rememberDevices: 'user_opt_in',
  rememberDeviceDays: 30,
  bypassMFAForTrustedDevices: true,
},
```

**Key settings:**

| Setting | Options | Description |
| --- | --- | --- |
| `rpId` | Domain string | Must match your site's domain. Use `localhost` for development. |
| `origin` | URL array | Allowed origins including protocol. Must match `rpId`. |
| `userVerification` | `required` / `preferred` / `discouraged` | Whether biometric/PIN is required. `preferred` lets the device decide. |
| `authenticatorAttachment` | `platform` / `cross-platform` | `platform` = built-in (Face ID, Touch ID). `cross-platform` = external (YubiKey, phone via QR). |

For local development:

```typescript title="config/auth.config.ts"
passkey: {
  rpName: 'NAuth Dev',
  rpId: 'localhost',
  origin: ['http://localhost:5173', 'http://localhost:4200'],
  timeout: 60000,
  userVerification: 'preferred',
  authenticatorAttachment: 'platform',
},
```

## Step 3: Add Backend Routes

:::note Already have MFA routes?
If you already set up routes for another MFA method (Email, SMS, TOTP), the same routes handle Passkey — just add `MFAMethod.PASSKEY` to `allowedMethods` in your config and add the `challenge/challenge-data` route shown in the [challenge helper routes](#challenge-helper-routes-public--used-during-login) section below.
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

### Challenge helper routes (public — used during login)

Add to your existing auth controller/routes from the [Basic Auth Flows](/docs/guides/basic-auth) guide. Passkey needs **two** challenge helper routes:

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

// Passkey-specific: get WebAuthn assertion options during login
@Public()
@Post('challenge/challenge-data')
@HttpCode(HttpStatus.OK)
async getChallengeData(@Body() dto: any) {
  if (!this.mfaService) throw new BadRequestException('MFA service is not available');
  return await this.mfaService.getChallengeData(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/auth.routes.ts"
// Add to your existing auth routes:

router.post('/challenge/setup-data', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await mfaService.getSetupData(req.body)); } catch (err) { next(err); }
});

// Passkey-specific: get WebAuthn assertion options during login
router.post('/challenge/challenge-data', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await mfaService.getChallengeData(req.body)); } catch (err) { next(err); }
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

// Passkey-specific: get WebAuthn assertion options during login
fastify.post('/auth/challenge/challenge-data', { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await mfaService.getChallengeData(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

## Step 4: Frontend — Passkey Registration (Security Settings)

Passkey setup uses the [Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API). The backend generates registration options, the browser creates a credential, and the backend verifies it.

### Get registration options

```
POST /auth/mfa/setup-data
```

**Request body:**

```json
{
  "methodName": "passkey"
}
```

**Response** — WebAuthn `PublicKeyCredentialCreationOptions`:

```json
{
  "setupData": {
    "challenge": "dGhpcyBpcyBhIGNoYWxsZW5nZQ...",
    "rp": { "name": "Your App Name", "id": "yourdomain.com" },
    "user": {
      "id": "dXNlci1zdWItaWQ...",
      "name": "user@example.com",
      "displayName": "John Doe"
    },
    "pubKeyCredParams": [
      { "alg": -7, "type": "public-key" },
      { "alg": -257, "type": "public-key" }
    ],
    "timeout": 60000,
    "authenticatorSelection": {
      "authenticatorAttachment": "platform",
      "userVerification": "preferred"
    },
    "attestation": "none"
  }
}
```

### Create credential in browser

Call the WebAuthn browser API with the options from the backend:

```typescript
const credential = await navigator.credentials.create({
  publicKey: setupData,
});
```

The browser shows a native prompt (Face ID, Touch ID, Windows Hello, or security key).

### Verify registration

```
POST /auth/mfa/verify-setup
```

**Request body** — send the full credential object:

```json
{
  "methodName": "passkey",
  "setupData": {
    "id": "credential-id-base64url",
    "rawId": "raw-id-base64url",
    "type": "public-key",
    "response": {
      "clientDataJSON": "base64url-encoded",
      "attestationObject": "base64url-encoded"
    }
  }
}
```

**Response:**

```json
{
  "deviceId": 45
}
```

Users can enroll **multiple passkeys** (e.g., laptop Touch ID + phone Face ID + YubiKey).

### Frontend registration example

```typescript title="React — Passkey setup (simplified)"
const handleSetupPasskey = async () => {
  // Step 1: Get registration options from backend
  const { setupData: options } = await fetch('/auth/mfa/setup-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodName: 'passkey' }),
  }).then(r => r.json());

  // Step 2: Create credential (shows biometric prompt)
  const credential = await navigator.credentials.create({ publicKey: options });

  // Step 3: Send credential to backend for verification
  const { deviceId } = await fetch('/auth/mfa/verify-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      methodName: 'passkey',
      setupData: credential,
    }),
  }).then(r => r.json());

  // Passkey registered
};
```

## Step 5: Frontend — Passkey Challenge (Login)

Passkey login works differently from code-based methods. The frontend needs to get WebAuthn assertion options before the user can authenticate.

### Login response (MFA enabled user)

```
POST /auth/login
```

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "availableMethods": ["passkey"],
    "preferredMethod": "passkey"
  }
}
```

### Get challenge data

When the preferred method is `passkey`, call `challenge-data` to get WebAuthn assertion options:

```
POST /auth/challenge/challenge-data
```

**Request body** ([`GetChallengeDataDTO`](/docs/api/core/dto/get-challenge-data-dto)):

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "method": "passkey"
}
```

**Response** — WebAuthn assertion options:

```json
{
  "challengeData": {
    "challenge": "cmFuZG9tLWNoYWxsZW5nZQ...",
    "timeout": 60000,
    "rpId": "yourdomain.com",
    "allowCredentials": [
      {
        "id": "credential-id-base64url",
        "type": "public-key",
        "transports": ["internal"]
      }
    ],
    "userVerification": "preferred"
  }
}
```

### Authenticate with browser

```typescript
const assertion = await navigator.credentials.get({
  publicKey: challengeData,
});
```

The browser shows the biometric/security key prompt.

### Complete the challenge

```
POST /auth/respond-challenge
```

**Request body** — send the assertion result as the `credential` field:

```json
{
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "type": "MFA_REQUIRED",
  "method": "passkey",
  "credential": {
    "id": "credential-id-base64url",
    "rawId": "raw-id-base64url",
    "type": "public-key",
    "response": {
      "clientDataJSON": "base64url-encoded",
      "authenticatorData": "base64url-encoded",
      "signature": "base64url-encoded"
    }
  }
}
```

**Response** — tokens are issued (same structure as [Email MFA](/docs/guides/mfa/email#complete-the-challenge)).

### Frontend challenge example

```typescript title="React — Passkey challenge (simplified)"
const handlePasskeyChallenge = async (session: string) => {
  // Step 1: Get assertion options
  const { challengeData } = await fetch('/auth/challenge/challenge-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, method: 'passkey' }),
  }).then(r => r.json());

  // Step 2: Authenticate (shows biometric prompt)
  const assertion = await navigator.credentials.get({ publicKey: challengeData });

  // Step 3: Complete challenge
  const response = await fetch('/auth/respond-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      type: 'MFA_REQUIRED',
      method: 'passkey',
      credential: assertion,
    }),
  }).then(r => r.json());

  if (response.accessToken) {
    // Login complete
  }
};
```

:::note Cross-device authentication
Users can authenticate on a desktop using a passkey stored on their phone via QR code scanning. This is handled automatically by the browser's WebAuthn implementation — no additional backend configuration is needed.
:::

## Security Advantages

Passkeys provide the highest security level of all MFA methods:

- **Phishing-resistant** — cryptographically bound to the RP domain; cannot be tricked by lookalike sites
- **No shared secrets** — uses public key cryptography; the private key never leaves the device
- **Replay-proof** — each authentication uses a unique challenge
- **Platform-integrated** — biometric prompts are handled by the OS

## What's Next

- **[Email MFA](/docs/guides/mfa/email)** — Email verification codes (simplest to set up)
- **[TOTP MFA](/docs/guides/mfa/totp)** — Authenticator app codes (offline, no delivery cost)
- **[How MFA Works](/docs/guides/mfa/how-mfa-works)** — Adaptive MFA, error codes, device trust, enforcement modes
