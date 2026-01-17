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

This is not an exhaustive and complete guide but shows how to implement the most common authentication endpoints with DTO validation, error handling, and multi-step authentication flows.

:::warning Accuracy and Adaptation
The examples on this page may not compile or run accurately if directly copied. Please use this to build your own flows. Don't assume input validation and do your input santisation, and application specific logic where possible.
:::

For framework-specific integration details, see:

- [NestJS Integration](/docs/api/nestjs/overview) - Guards, decorators, modules
- [Express Integration](/docs/api/express/overview) - Middleware, helpers
- [Fastify Integration](/docs/api/fastify/overview) - Hooks, context wrapping

## Overview

nauth-toolkit provides a comprehensive set of authentication endpoints that support:

- **Primary authentication flows** - Signup, login, challenge responses, token refresh, logout
- **Password management** - Change password, forgot password, password reset
- **Multi-factor authentication** - MFA setup, verification, device management
- **Social authentication** - OAuth flows, account linking
- **Session management** - Device trust, session revocation
- **Audit logging** - Authentication history

All endpoints use [DTOs](/docs/api/core/dto/overview) for request validation and return structured responses. The [Challenge System](/docs/concepts/challenge-system) handles multi-step authentication flows automatically.

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
import { Router } from 'express';
import { NAuthInstance, ExpressMiddlewareType, RequestHandler } from '@nauth-toolkit/core';
import { SignupDTO } from '@nauth-toolkit/core';

export function createAuthRoutes(nauth: NAuthInstance<ExpressMiddlewareType, RequestHandler>): Router {
  const router = Router();

  router.post('/signup', nauth.helpers.public(), async (req, res, next) => {
    try {
      const dto = Object.assign(new SignupDTO(), req.body);
      const result = await nauth.authService.signup(dto);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { FastifyInstance } from 'fastify';
import { NAuthInstance } from '@nauth-toolkit/core';
import { SignupDTO } from '@nauth-toolkit/core';

export async function createAuthRoutes(fastify: FastifyInstance, nauth: NAuthInstance<any, any>): Promise<void> {
  fastify.post(
    '/signup',
    { preHandler: nauth.helpers.public() as any },
    nauth.adapter.wrapRouteHandler(async (req) => {
      const dto = Object.assign(new SignupDTO(), req.body);
      return nauth.authService.signup(dto);
    }),
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
router.post('/login', nauth.helpers.public(), async (req, res, next) => {
  try {
    const dto = Object.assign(new LoginDTO(), req.body);
    const result = await nauth.authService.login(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/login',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const dto = Object.assign(new LoginDTO(), req.body);
    return nauth.authService.login(dto);
  }),
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
router.post('/respond-challenge', nauth.helpers.public(), async (req, res, next) => {
  try {
    const dto = Object.assign(new RespondChallengeDTO(), req.body);
    const result = await nauth.authService.respondToChallenge(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/respond-challenge',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const dto = Object.assign(new RespondChallengeDTO(), req.body);
    return nauth.authService.respondToChallenge(dto);
  }),
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
import type { FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
  ): Promise<TokenResponse> {
    const token =
      body?.refreshToken && body.refreshToken.trim() !== '' ? body.refreshToken : req?.cookies?.['nauth_refresh_token'];

    if (!token) {
      throw new BadRequestException('Refresh token is required');
    }

    const dto = new RefreshTokenDTO();
    dto.refreshToken = token;
    return await this.authService.refreshToken(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/refresh', nauth.helpers.public(), async (req, res, next) => {
  try {
    const token = req.body?.refreshToken || req.cookies?.['nauth_refresh_token'];
    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const dto = new RefreshTokenDTO();
    dto.refreshToken = token;
    const result = await nauth.authService.refreshToken(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/refresh',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const token = (req.body as any)?.refreshToken || req.cookies?.['nauth_refresh_token'];
    if (!token) {
      throw new BadRequestException('Refresh token is required');
    }

    const dto = new RefreshTokenDTO();
    dto.refreshToken = token;
    return nauth.authService.refreshToken(dto);
  }),
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

See [Token Delivery](/docs/features/token-delivery) for token rotation details.

### Logout

Revokes the current session and clears authentication cookies.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, LogoutDTO, AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard)
  @Get('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: IUser, @Query('forgetMe') forgetMe?: string): Promise<{ message: string }> {
    const dto = new LogoutDTO();
    dto.sub = user.sub;
    if (forgetMe === 'true' || forgetMe === '1') {
      dto.forgetMe = true;
    }

    await this.authService.logout(dto);
    return { message: 'Logged out successfully' };
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.get('/logout', nauth.helpers.requireAuth({ csrf: false }), async (req, res, next) => {
  try {
    const user = nauth.helpers.getCurrentUser();
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dto = new LogoutDTO();
    dto.sub = user.sub;
    if (req.query.forgetMe === 'true') {
      dto.forgetMe = true;
    }

    await nauth.authService.logout(dto);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/logout',
  { preHandler: nauth.helpers.requireAuth({ csrf: false }) as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const dto = new LogoutDTO();
    dto.sub = user.sub;
    if ((req.query as any)?.forgetMe === 'true') {
      dto.forgetMe = true;
    }

    await nauth.authService.logout(dto);
    return { message: 'Logged out successfully' };
  }),
);
```

</TabItem>
</Tabs>

**Request DTO:** [`LogoutDTO`](/docs/api/core/dto/logout-dto)

**Query Parameters:**

- `forgetMe` (optional) - If `true`, untrusts the device

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

## Password Management

### Change Password

Allows authenticated users to change their password.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, ChangePasswordDTO, AuthGuard } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() body: { oldPassword: string; newPassword: string }): Promise<{ message: string }> {
    const dto = new ChangePasswordDTO();
    dto.oldPassword = body.oldPassword;
    dto.newPassword = body.newPassword;

    await this.authService.changePassword(dto);
    return { message: 'Password changed successfully' };
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/change-password', nauth.helpers.requireAuth(), async (req, res, next) => {
  try {
    const user = nauth.helpers.getCurrentUser();
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dto = new ChangePasswordDTO();
    dto.oldPassword = req.body.oldPassword;
    dto.newPassword = req.body.newPassword;

    await nauth.authService.changePassword(dto);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/change-password',
  { preHandler: nauth.helpers.requireAuth() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const user = nauth.helpers.getCurrentUser();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const dto = new ChangePasswordDTO();
    dto.oldPassword = (req.body as any).oldPassword;
    dto.newPassword = (req.body as any).newPassword;

    await nauth.authService.changePassword(dto);
    return { message: 'Password changed successfully' };
  }),
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

### Forgot Password

Request a password reset code via email or SMS.

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
    return await this.authService.forgotPassword(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/forgot-password', nauth.helpers.public(), async (req, res, next) => {
  try {
    const dto = Object.assign(new ForgotPasswordDTO(), req.body);
    const result = await nauth.authService.forgotPassword(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/forgot-password',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const dto = Object.assign(new ForgotPasswordDTO(), req.body);
    return nauth.authService.forgotPassword(dto);
  }),
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
router.post('/forgot-password/confirm', nauth.helpers.public(), async (req, res, next) => {
  try {
    const dto = Object.assign(new ConfirmForgotPasswordDTO(), req.body);
    const result = await nauth.authService.confirmForgotPassword(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/forgot-password/confirm',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const dto = Object.assign(new ConfirmForgotPasswordDTO(), req.body);
    return nauth.authService.confirmForgotPassword(dto);
  }),
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
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MFAService, GetSetupDataDTO, GetSetupDataResponseDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly mfaService: MFAService) {}

  @Public()
  @Post('challenge/setup-data')
  @HttpCode(HttpStatus.OK)
  async getSetupData(@Body() dto: GetSetupDataDTO): Promise<GetSetupDataResponseDTO> {
    return await this.mfaService.getSetupData(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/challenge/setup-data', nauth.helpers.public(), async (req, res, next) => {
  try {
    if (!nauth.mfaService) {
      return res.status(400).json({ error: 'MFA service is not available' });
    }

    const dto = Object.assign(new GetSetupDataDTO(), req.body);
    const result = await nauth.mfaService.getSetupData(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/challenge/setup-data',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    if (!nauth.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    const dto = Object.assign(new GetSetupDataDTO(), req.body);
    return nauth.mfaService.getSetupData(dto);
  }),
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

See [MFA Guide](/docs/features/mfa) for complete MFA setup flow.

### Resend Code

Resend verification code for the current challenge.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, ResendCodeDTO, Public } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('challenge/resend')
  @HttpCode(HttpStatus.OK)
  async resendCode(@Body() dto: ResendCodeDTO): Promise<{ destination: string }> {
    return await this.authService.resendCode(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.post('/challenge/resend', nauth.helpers.public(), async (req, res, next) => {
  try {
    const dto = Object.assign(new ResendCodeDTO(), req.body);
    const result = await nauth.authService.resendCode(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.post(
  '/challenge/resend',
  { preHandler: nauth.helpers.public() as any },
  nauth.adapter.wrapRouteHandler(async (req) => {
    const dto = Object.assign(new ResendCodeDTO(), req.body);
    return nauth.authService.resendCode(dto);
  }),
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

**Response:**

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
import { MFAService, AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly mfaService: MFAService) {}

  @UseGuards(AuthGuard)
  @Get('mfa/status')
  async getMFAStatus(@CurrentUser() user: IUser) {
    return await this.mfaService.getMFAStatus(user);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.get('/mfa/status', nauth.helpers.requireAuth(), async (req, res, next) => {
  try {
    const user = nauth.helpers.getCurrentUser();
    if (!user || !nauth.mfaService) {
      return res.status(400).json({ error: 'MFA service is not available' });
    }

    const status = await nauth.mfaService.getMFAStatus(user);
    res.json(status);
  } catch (error) {
    next(error);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/mfa/status',
  { preHandler: nauth.helpers.requireAuth() as any },
  nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    if (!user || !nauth.mfaService) {
      throw new BadRequestException('MFA service is not available');
    }

    return nauth.mfaService.getMFAStatus(user);
  }),
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

See [Managing MFA Devices](/docs/features/mfa#managing-mfa-devices) for complete MFA device management.

## Social Authentication

Redirect-first social login. The backend owns the OAuth callback, sets cookies (or issues an `exchangeToken`), then redirects back to the frontend.

### Start social login redirect

`GET /auth/social/:provider/redirect?returnTo=/auth/callback&appState=12345`

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Public()
@Redirect()
@Get('social/:provider/redirect')
async start(
  @Param('provider') provider: string,
  @Query() q: { returnTo?: string; appState?: string },
  @Req() req: unknown,
): Promise<{ url: string }> {
  const out = await this.socialRedirect.start({ provider, returnTo: q.returnTo, appState: q.appState, req });
  return { url: out.redirectUrl };
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.get('/social/:provider/redirect', async (req, res, next) => {
  try {
    const out = await socialRedirect.start({
      provider: req.params.provider,
      returnTo: typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined,
      appState: typeof req.query.appState === 'string' ? req.query.appState : undefined,
      req,
    });
    res.redirect(302, out.redirectUrl);
  } catch (e) {
    next(e);
  }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get('/social/:provider/redirect', async (req, reply) => {
  const q = req.query as Record<string, unknown>;
  const out = await socialRedirect.start({
    provider: (req.params as any).provider,
    returnTo: typeof q.returnTo === 'string' ? q.returnTo : undefined,
    appState: typeof q.appState === 'string' ? q.appState : undefined,
    req,
  });
  return reply.redirect(302, out.redirectUrl);
});
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

#### NestJS: avoiding manual cookie logic

If you return the auth payload in the same object as the redirect URL, the toolkit’s `CookieTokenInterceptor` can set cookies automatically (same behavior as other endpoints), and strip tokens from the response body in cookies mode.

```typescript
import { Controller, Get, Param, Query, Req, Redirect } from '@nestjs/common';
import { Public, SocialRedirectHandler, AuthResponseDTO, TokenDelivery } from '@nauth-toolkit/nestjs';

@Controller('auth/social')
export class SocialRedirectController {
  constructor(private readonly socialRedirect: SocialRedirectHandler) {}

  @Public()
  @Redirect()
  // Optional: use explicit route-level delivery in hybrid deployments
  // @TokenDelivery('cookies')
  @Get(':provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query() q: { code?: string; state?: string; error?: string; error_description?: string },
    @Req() req: unknown,
  ): Promise<{ url: string } & Partial<AuthResponseDTO>> {
    const result = await this.socialRedirect.callback({
      provider,
      code: q.code,
      state: q.state,
      error: q.error,
      errorDescription: q.error_description,
      req,
    });

    if (result.authResponse) {
      return { url: result.redirectUrl, ...result.authResponse };
    }
    return { url: result.redirectUrl };
  }
}
```

### Exchange `exchangeToken`

`POST /auth/social/exchange`

```json
{ "exchangeToken": "..." }
```

Response: [`AuthResponseDTO`](/docs/api/core/dto/auth-response-dto)

## User Profile

### Get Current User

Get the authenticated user's profile.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@nauth-toolkit/nestjs';
import type { IUser } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: IUser): Promise<IUser> {
    return user;
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
router.get('/profile', nauth.helpers.requireAuth(), (req, res) => {
  const user = nauth.helpers.getCurrentUser();
  res.json(user);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/profile',
  { preHandler: nauth.helpers.requireAuth() as any },
  nauth.adapter.wrapRouteHandler(async () => nauth.helpers.getCurrentUser()),
);
```

</TabItem>
</Tabs>

**Response:** [`IUser`](/docs/api/core/interfaces/user) - User profile object

## Error Handling

All endpoints use [`NAuthException`](/docs/api/core/exceptions/nauth-exception) for structured error responses. Handle errors appropriately:

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
- [MFA Guide](/docs/features/mfa) - Multi-factor authentication setup
- [Social Login](/docs/features/social-login) - OAuth integration
- [Token Delivery](/docs/features/token-delivery) - Token delivery modes
