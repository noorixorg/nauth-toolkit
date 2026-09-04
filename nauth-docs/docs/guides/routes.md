---
title: Authentication Routes
description: Complete guide to implementing authentication endpoints with DTOs, validation, and multi-step flows
sidebar_position: 4
keywords: [routes, endpoints, authentication, dto, validation, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Authentication Routes

The toolkit ships every auth endpoint as a mountable bundle. Mount it and you write no
controllers; exclude a key and write only the route you want to change.

The rest of this page documents each endpoint's request and response shape, and shows the
hand-written form for when you need to override one.

| | |
| --- | --- |
| Full route table | [Shipped Routes](/docs/api/core/routes/overview) |
| Framework integration | [NestJS](/docs/api/nestjs/overview) · [Express](/docs/api/express/overview) · [Fastify](/docs/api/fastify/overview) |

:::tip[Sample apps]
`examples/starter-nestjs`, `examples/starter-express` and `examples/starter-fastify` all mount
the shipped routes. `examples/demo-nestjs` hand-writes its controllers, as a reference for
overriding.
:::

## Mounting the shipped routes

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/config/auth.config.ts"
export const authConfig: NAuthModuleConfig = {
  routes: [{ prefix: 'auth' }],
};
```

`AuthModule.forRoot()` builds the controllers. No `controllers` array needed.

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/index.ts"
const authRouter = express.Router();
registerNAuthExpressRoutes(authRouter, nauth);
app.use('/auth', authRouter);
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/index.ts"
await fastify.register(
  async (scope) => registerNAuthFastifyRoutes(scope, nauth),
  { prefix: '/auth' },
);
```

</TabItem>
</Tabs>

## Choosing which routes to mount

### By group

`groups` selects bundles. The `admin` and `apiKeysAdmin` groups are never mounted by default.
[Route Groups](/docs/api/core/routes/groups) lists every route in each one.

```typescript
{ prefix: 'auth', groups: ['core', 'profile'] }
```

### By key

`exclude` drops individual routes. It serves two different purposes.

**Override** — replace a route with your own:

```typescript
{ prefix: 'auth', exclude: ['login'] }
```

Then declare just that route (see the sections below for the hand-written form).

**Suppress** — never expose a capability at all:

```typescript
{ prefix: 'admin', groups: ['admin'], exclude: ['adminSetPassword', 'adminDeleteUser'] }
```

:::warning[`exclude` removes the endpoint, not the capability]
`AdminAuthService.setPassword` is still a public method, still callable from a controller you
write, a script, or a background job. If the intent is *"nobody may do this, however they reach
it"*, deny the action in your authorization provider as well:

```typescript
if (action === 'admin.user.setPassword') {
  return { allow: false, reason: 'Password changes go through the email reset flow' };
}
```

The service then refuses regardless of caller. See [Authorization](/docs/concepts/authorization).
:::

An unknown key in `exclude` throws at mount time, so a typo cannot silently re-expose a route you
meant to suppress.

### Web and mobile from one backend

Mount the same routes twice, differing only in transport. Requires
`tokenDelivery.method: 'hybrid'` — the toolkit refuses at startup otherwise.

```typescript
routes: [
  { prefix: 'auth', delivery: 'cookies' },
  { prefix: 'mobile/auth', delivery: 'json', groups: ['core', 'social'] },
]
```

See [Token Management](/docs/concepts/token-management) for what each mode changes.

## Writing your own

Everything below shows the request and response shape of each endpoint, and the hand-written
form. You need this only for routes you `exclude`.

All endpoints use [DTOs](/docs/api/core/dto/overview) for request validation and return
structured responses. The [Challenge System](/docs/concepts/challenge-system) handles multi-step
authentication flows automatically.

## Primary Authentication Flow

The core authentication flow consists of five primary endpoints that handle most authentication scenarios.

### Signup

Creates a new user account. May return a challenge if email/phone verification is required.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, SignupDTO, AuthResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    return await this.authService.signup(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { NAuthInstance, ExpressMiddlewareType } from '@nauth-toolkit/core';

export function createAuthRoutes(nauth: NAuthInstance<ExpressMiddlewareType, RequestHandler>): Router {
  const router = Router();

  router.post('/signup', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await nauth.authService.signup(req.body));
    } catch (err) { next(err); }
  });

  return router;
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { FastifyInstance } from 'fastify';
import { NAuthInstance } from '@nauth-toolkit/core';

export async function registerAuthRoutes(fastify: FastifyInstance, nauth: NAuthInstance<any, any>): Promise<void> {
  fastify.post(
    '/signup',
    { preHandler: [nauth.helpers.public()] },
    nauth.adapter.wrapRouteHandler(async (req, res) => {
      res.status(201).json(await nauth.authService.signup(req.body as any));
    }) as any
  );
}
```

</TabItem>
</Tabs>

**Request DTO:** [`SignupDTO`](/docs/api/core/dto/signup-dto)

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** [`AuthResponseDTO`](/docs/api/core/dto/auth-response-dto) - Contains tokens or challenge

See [Challenge System](/docs/concepts/challenge-system) for challenge handling.

### Login

Authenticates user with email/password. May return a challenge if MFA or verification is required.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, LoginDTO, AuthResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO): Promise<AuthResponseDTO> {
    return await this.authService.login(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/login', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.login(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/login',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.login(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`LoginDTO`](/docs/api/core/dto/login-dto)

```json
{
  "identifier": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** [`AuthResponseDTO`](/docs/api/core/dto/auth-response-dto) - Contains tokens or challenge

See [Challenge System](/docs/concepts/challenge-system) for MFA and challenge handling.

### Respond to Challenge

Unified endpoint for completing any challenge type (email verification, phone verification, MFA, password change).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, RespondChallengeDTO, AuthResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('respond-challenge')
  @HttpCode(HttpStatus.OK)
  async respondToChallenge(@Body() dto: RespondChallengeDTO): Promise<AuthResponseDTO> {
    return await this.authService.respondToChallenge(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/respond-challenge', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.respondToChallenge(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/respond-challenge',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.respondToChallenge(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`RespondChallengeDTO`](/docs/api/core/dto/respond-challenge-dto)

**Email Verification:**

```json
{
  "session": "challenge-session-token",
  "type": "VERIFY_EMAIL",
  "code": "123456"
}
```

**Phone Verification (Collection/Update):**

```json
{
  "session": "challenge-session-token",
  "type": "VERIFY_PHONE",
  "phone": "+1234567890"
}
```

**Note**: The `phone` field can be used to:

- Collect a phone number when user has none (e.g., social signup)
- Update an existing phone number if user entered wrong number during signup

After submitting phone, backend sends verification SMS and returns the same challenge for code verification.

**Phone Verification (Code):**

```json
{
  "session": "challenge-session-token",
  "type": "VERIFY_PHONE",
  "code": "123456"
}
```

**MFA Verification:**

```json
{
  "session": "challenge-session-token",
  "type": "MFA_REQUIRED",
  "method": "totp",
  "code": "123456"
}
```

**Response:** [`AuthResponseDTO`](/docs/api/core/dto/auth-response-dto) - Contains tokens or next challenge

See [Challenge System](/docs/concepts/challenge-system) for complete challenge flow documentation.

### Refresh Token

Issues a new access token using a valid refresh token.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService, RefreshTokenDTO, TokenResponse, Public } from '@nauth-toolkit/nestjs';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDTO | undefined, @Req() req: Request): Promise<TokenResponse> {
    const dtoToUse: RefreshTokenDTO = dto ?? ({} as RefreshTokenDTO);
    if (!dtoToUse.refreshToken) {
      dtoToUse.refreshToken = req?.cookies?.['nauth_refresh_token'];
    }
    return await this.authService.refreshToken(dtoToUse);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/refresh', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.body?.refreshToken?.trim() || req.cookies?.['nauth_refresh_token'];
    res.json(await nauth.authService.refreshToken({ refreshToken: token }));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/refresh',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    const token = (req.body as { refreshToken?: string })?.refreshToken?.trim() || req.cookies?.['nauth_refresh_token'];
    res.json(await nauth.authService.refreshToken({ refreshToken: token }));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`RefreshTokenDTO`](/docs/api/core/dto/refresh-token-dto)

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** [`TokenResponse`](/docs/api/core/dto/auth-response-dto) - New access and refresh tokens

See [Token Delivery](/docs/concepts/token-management) for token rotation details.

### Logout

Revokes the current session and clears authentication cookies. User identity is automatically resolved from the JWT context.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, LogoutDTO, LogoutResponseDTO, AuthGuard } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard)
  @Get('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Query() dto: LogoutDTO): Promise<LogoutResponseDTO> {
    return await this.authService.logout(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.get('/logout', nauth.helpers.requireAuth({ csrf: false }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.logout(req.query));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/logout',
  { preHandler: [nauth.helpers.requireAuth({ csrf: false })] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.logout(req.query as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`LogoutDTO`](/docs/api/core/dto/logout-dto)

**Query Parameters:**

- `forgetMe` (optional) - If `true`, untrusts the device

**Response:** [`LogoutResponseDTO`](/docs/api/core/dto/logout-dto)

```json
{
  "success": true
}
```

## Password Management

### Change Password

Allows authenticated users to change their password.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, ChangePasswordDTO, ChangePasswordResponseDTO, AuthGuard } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDTO): Promise<ChangePasswordResponseDTO> {
    return await this.authService.changePassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/change-password', nauth.helpers.requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.changePassword(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/change-password',
  { preHandler: [nauth.helpers.requireAuth()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.changePassword(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`ChangePasswordDTO`](/docs/api/core/dto/change-password-dto)

```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewSecurePass123!"
}
```

**Response:** [`ChangePasswordResponseDTO`](/docs/api/core/dto/change-password-dto)

```json
{
  "success": true
}
```

### Forgot Password

Request a password reset code via email or SMS. The `baseUrl` field is used by the toolkit to construct the reset link in the email.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, ForgotPasswordDTO, ForgotPasswordResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDTO): Promise<ForgotPasswordResponseDTO> {
    dto.baseUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:4200'}/auth/reset-password`;
    return await this.authService.forgotPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/forgot-password', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.forgotPassword({ ...req.body, baseUrl: 'https://localhost:4200' }));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/forgot-password',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.forgotPassword({ ...(req.body as object), baseUrl: 'https://localhost:4200' } as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`ForgotPasswordDTO`](/docs/api/core/dto/forgot-password-dto)

```json
{
  "identifier": "user@example.com"
}
```

**Response:** [`ForgotPasswordResponseDTO`](/docs/api/core/dto/forgot-password-dto) - Response details in same file

### Confirm Forgot Password

Confirm password reset code and set new password.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, ConfirmForgotPasswordDTO, ConfirmForgotPasswordResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('forgot-password/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmForgotPassword(@Body() dto: ConfirmForgotPasswordDTO): Promise<ConfirmForgotPasswordResponseDTO> {
    return await this.authService.confirmForgotPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/forgot-password/confirm', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.confirmForgotPassword(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/forgot-password/confirm',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.confirmForgotPassword(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`ConfirmForgotPasswordDTO`](/docs/api/core/dto/forgot-password-dto) - DTO details in same file

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## Helper Endpoints

### Get Setup Data

Get MFA setup data during `MFA_SETUP_REQUIRED` challenge.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, Inject, BadRequestException } from '@nestjs/common';
import { MFAService, GetSetupDataDTO, GetSetupDataResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(MFAService)
    private readonly mfaService?: MFAService,
  ) {}

  @Public()
  @Post('challenge/setup-data')
  @HttpCode(HttpStatus.OK)
  async getSetupData(@Body() dto: GetSetupDataDTO): Promise<GetSetupDataResponseDTO> {
    if (!this.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }
    return await this.mfaService.getSetupData(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/challenge/setup-data', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.mfaService!.getSetupData(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/challenge/setup-data',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.mfaService!.getSetupData(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`GetSetupDataDTO`](/docs/api/core/dto/get-setup-data-dto)

```json
{
  "session": "challenge-session-token",
  "method": "totp"
}
```

**Response:** [`GetSetupDataResponseDTO`](/docs/api/core/dto/get-setup-data-response-dto) - Provider-specific setup data

See [MFA Guide](/docs/guides/mfa/how-mfa-works) for complete MFA setup flow.

### Resend Code

Resend verification code for the current challenge.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, ResendCodeDTO, ResendCodeResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('challenge/resend')
  @HttpCode(HttpStatus.OK)
  async resendCode(@Body() dto: ResendCodeDTO): Promise<ResendCodeResponseDTO> {
    return await this.authService.resendCode(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/challenge/resend', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.authService.resendCode(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/challenge/resend',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    res.json(await nauth.authService.resendCode(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

**Request DTO:** [`ResendCodeDTO`](/docs/api/core/dto/resend-code-dto)

```json
{
  "session": "challenge-session-token"
}
```

**Response:** [`ResendCodeResponseDTO`](/docs/api/core/dto/resend-code-dto)

```json
{
  "destination": "u***r@example.com"
}
```

## MFA Management

### Get MFA Status

Get MFA configuration status for the current user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { MFAService, AuthGuard } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly mfaService: MFAService) {}

  @UseGuards(AuthGuard)
  @Get('mfa/status')
  async getMfaStatus() {
    return await this.mfaService.getMfaStatus();
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.get('/mfa/status', nauth.helpers.requireAuth(), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await nauth.mfaService!.getMfaStatus());
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/status',
  { preHandler: [nauth.helpers.requireAuth()] },
  nauth.adapter.wrapRouteHandler(async (_req, res) => {
    res.json(await nauth.mfaService!.getMfaStatus());
  }) as any
);
```

</TabItem>
</Tabs>

**Response:**

```json
{
  "enabled": true,
  "required": false,
  "methods": ["totp", "sms"],
  "availableMethods": ["totp", "sms", "passkey"],
  "hasBackupCodes": true,
  "preferredMethod": "totp"
}
```

See [Managing MFA Devices](/docs/guides/mfa/how-mfa-works#device-management) for complete MFA device management.

## Social Authentication

Redirect-first social login. The backend owns the OAuth callback, sets cookies (or issues an `exchangeToken`), then redirects back to the frontend.

### Start social login redirect

`GET /auth/social/:provider/redirect?returnTo=/auth/callback&appState=12345`

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Get, Param, Query, Redirect } from '@nestjs/common';
import { Public, SocialRedirectHandler, StartSocialRedirectQueryDTO, StartSocialRedirectResponseDTO } from '@nauth-toolkit/nestjs';

@Controller('auth/social')
export class SocialRedirectController {
  constructor(private readonly socialRedirect: SocialRedirectHandler) {}

  @Public()
  @Redirect()
  @Get(':provider/redirect')
  async start(
    @Param('provider') provider: string,
    @Query() dto: StartSocialRedirectQueryDTO,
  ): Promise<StartSocialRedirectResponseDTO> {
    return await this.socialRedirect.start(provider, dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
// socialRedirect = nauth.socialRedirect! (from NAuth.create())
router.get('/:provider/redirect', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = await socialRedirect.start(req.params.provider, req.query);
    res.redirect(url);
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
// socialRedirect = nauth.socialRedirect! (from NAuth.create())
fastify.get(
  '/social/:provider/redirect',
  { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    const params = req.params as { provider: string };
    const { url } = await socialRedirect.start(params.provider, req.query);
    (res.raw as any).redirect(url, 302);
  }) as any
);
```

</TabItem>
</Tabs>

### Provider callback (backend)

Provider redirects back to:

- `GET /auth/social/:provider/callback` (Google/Facebook)
- `POST /auth/social/:provider/callback` (Apple `form_post`)

Backend responds with:

- **302 → frontend** `returnTo?appState=...` (cookies success path), and sets httpOnly cookies in the same response
- **302 → frontend** `returnTo?appState=...&exchangeToken=...` (json/hybrid, and cookies-with-challenge)

#### NestJS: simplified controller

The handler reads delivery and deviceToken from ContextStorage and applies cookies via `HTTP_RESPONSE`. The controller only passes provider and DTO.

```typescript
import { Controller, Get, Post, Param, Query, Body, Redirect } from '@nestjs/common';
import { Public, SocialRedirectHandler, SocialCallbackQueryDTO, SocialCallbackFormDTO, SocialRedirectCallbackResponseDTO } from '@nauth-toolkit/nestjs';

@Controller('auth/social')
export class SocialRedirectController {
  constructor(private readonly socialRedirect: SocialRedirectHandler) {}

  @Public()
  @Redirect()
  @Get(':provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query() dto: SocialCallbackQueryDTO,
  ): Promise<SocialRedirectCallbackResponseDTO> {
    return await this.socialRedirect.callback(provider, dto);
  }

  @Public()
  @Redirect()
  @Post(':provider/callback')
  async callbackPost(
    @Param('provider') provider: string,
    @Body() dto: SocialCallbackFormDTO,
  ): Promise<SocialRedirectCallbackResponseDTO> {
    return await this.socialRedirect.callback(provider, dto);
  }
}
```

### Exchange `exchangeToken`

`POST /auth/social/exchange`

```json
{ "exchangeToken": "..." }
```

Response: [`AuthResponseDTO`](/docs/api/core/dto/auth-response-dto)

## OpenID Connect Interaction

When your application is also an [OpenID Connect provider](/docs/guides/oauth-provider/how-oauth-provider-works), four more routes bridge the provider and your login. `OIDCProviderModule.forRoot()` registers them for you at `oidc/interaction/:uid`, under any global prefix — the paths below assume none.

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/oidc/interaction/:uid` | GET | Optional | What the pending authorization request needs |
| `/oidc/interaction/:uid/abort` | POST | Optional | Abandon the request with `access_denied` |
| `/oidc/interaction/:uid/confirm` | POST | Optional | Record the consent decision |
| `/oidc/interaction/:uid/login` | POST | Optional | Complete the login step |

"Optional" means the routes run inside the guard chain so a signed-in caller is identified, but an anonymous caller is **answered**, not rejected — a signed-out response is what tells your page to send the user to login. If you write these routes yourself, reproduce that: `@UseGuards(AuthGuard)` on the class and `@Public()` on every route.

Each returns JSON rather than a 302; the consent screen navigates itself with `window.location.assign(redirectTo)`. See [`createOIDCInteractionController`](/docs/api/oidc-provider/interaction-controller) for the shipped implementation and [Building the Consent Screen](/docs/guides/oauth-provider/consent-screen) for the frontend.

## User Profile

### Get Current User

Get the authenticated user's profile. Use `UserResponseDTO.fromEntity()` to sanitize the response and exclude sensitive fields like password hashes.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, UserResponseDTO } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: IUser): Promise<UserResponseDTO> {
    return UserResponseDTO.fromEntity(user);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { IUser, UserResponseDTO } from '@nauth-toolkit/core';

router.get('/profile', nauth.helpers.requireAuth(), (_req: Request, res: Response, next: NextFunction) => {
  try {
    const user = nauth.helpers.getCurrentUser() as IUser;
    res.json(UserResponseDTO.fromEntity(user));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { IUser, UserResponseDTO } from '@nauth-toolkit/core';

fastify.get(
  '/profile',
  { preHandler: [nauth.helpers.requireAuth()] },
  nauth.adapter.wrapRouteHandler(async (_req, res) => {
    const user = nauth.helpers.getCurrentUser() as IUser;
    res.json(UserResponseDTO.fromEntity(user));
  }) as any
);
```

</TabItem>
</Tabs>

**Response:** [`UserResponseDTO`](/docs/api/core/dto/user-response-dto) - Sanitized user profile

## Error Handling

All endpoints use [`NAuthException`](/docs/concepts/error-handling) for structured error responses. Handle errors appropriately:

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';

// In main.ts
app.useGlobalFilters(new NAuthHttpExceptionFilter());
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuthException } from '@nauth-toolkit/core';

app.use((error, req, res, next) => {
  if (error instanceof NAuthException) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  next(error);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuthException } from '@nauth-toolkit/core';

fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof NAuthException) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  reply.send(error);
});
```

</TabItem>
</Tabs>

See [Error Handling](/docs/concepts/error-handling) for complete error handling guide.

## Related Documentation

- [Challenge System](/docs/concepts/challenge-system) - Multi-step authentication flows
- [AuthService API](/docs/api/core/services/auth-service) - Complete service reference
- [DTO Reference](/docs/api/core/dto/overview) - All request/response DTOs
- [MFA Guide](/docs/guides/mfa/how-mfa-works) - Multi-factor authentication setup
- [Social Login](/docs/guides/social/how-social-login-works) - OAuth integration
- [OIDC Provider](/docs/guides/oauth-provider/how-oauth-provider-works) - Being an identity provider yourself
- [Token Delivery](/docs/concepts/token-management) - Token delivery modes
