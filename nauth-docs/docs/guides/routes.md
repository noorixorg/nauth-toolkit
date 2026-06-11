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
- [Token Delivery](/docs/concepts/token-management) - Token delivery modes
