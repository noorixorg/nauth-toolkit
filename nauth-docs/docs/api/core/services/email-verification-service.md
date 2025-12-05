---
title: EmailVerificationService
description: Email verification service for sending codes, verifying with code or token, and resending with rate limiting. Supports both code-based and link-based verification.
keywords: [email, verification, service, code, token, api]
image: /img/api-social-card.png
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# EmailVerificationService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Email verification service that handles sending verification codes, verifying emails with codes or tokens, and resending with rate limiting.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { EmailVerificationService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { EmailVerificationService } from '@nauth-toolkit/core';
// Access via nauth.emailVerificationService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { EmailVerificationService } from '@nauth-toolkit/core';
// Access via nauth.emailVerificationService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

Handles email verification workflow including code generation, email delivery, verification with code or token, and resend operations with rate limiting.

:::note
Auto-injected by framework. No manual instantiation required.
:::

## Methods

### resendVerificationEmail()

Resend verification email with rate limiting.

```typescript
async resendVerificationEmail(dto: ResendVerificationEmailDTO): Promise<ResendVerificationEmailResponseDTO>
```

**Parameters**

- `dto` - [`ResendVerificationEmailDTO`](../dto/resend-verification-email-dto) - Request DTO
  - `sub` - `string` (optional) - User identifier (UUID v4)
  - `email` - `string` (optional) - User email address
  - `baseUrl` - `string` (optional) - Base URL for verification link

::::info
Either `sub` or `email` must be provided (not both).
::::

**Returns**

- [`ResendVerificationEmailResponseDTO`](../dto/resend-verification-email-response-dto) - Response with token ID
  - `tokenId` - `number` - Verification token ID (internal)

**Errors**

| Code                | When                    | Details                                      |
| ------------------- | ----------------------- | -------------------------------------------- |
| `NOT_FOUND`         | User not found          | `{ userId?: string }`                        |
| `RATE_LIMIT_RESEND` | Resend delay not met    | `{ retryAfter: number, resendDelay: number }` |
| `VALIDATION_FAILED` | Neither sub nor email   | `{ message: string }`                        |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendVerificationEmailDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private emailVerificationService: EmailVerificationService) {}

  async resendBySub() {
    const dto: ResendVerificationEmailDTO = {
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      baseUrl: 'https://example.com',
    };
    await this.emailVerificationService.resendVerificationEmail(dto);
  }

  async resendByEmail() {
    const dto: ResendVerificationEmailDTO = {
      email: 'user@example.com',
      baseUrl: 'https://example.com',
    };
    await this.emailVerificationService.resendVerificationEmail(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendVerificationEmailDTO } from '@nauth-toolkit/core';

// Resend by sub
app.post('/resend-verification', async (req, res) => {
  const dto: ResendVerificationEmailDTO = {
    sub: req.body.sub,
    baseUrl: 'https://example.com',
  };
  await nauth.emailVerificationService.resendVerificationEmail(dto);
  res.json({ success: true });
});

// Resend by email
app.post('/resend-verification-email', async (req, res) => {
  const dto: ResendVerificationEmailDTO = {
    email: req.body.email,
    baseUrl: 'https://example.com',
  };
  await nauth.emailVerificationService.resendVerificationEmail(dto);
  res.json({ success: true });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendVerificationEmailDTO } from '@nauth-toolkit/core';

// Resend by sub
fastify.post('/resend-verification', nauth.adapter.wrapRouteHandler(async (req, reply) => {
  const dto: ResendVerificationEmailDTO = {
    sub: req.body.sub,
    baseUrl: 'https://example.com',
  };
  await nauth.emailVerificationService.resendVerificationEmail(dto);
  return { success: true };
}));

// Resend by email
fastify.post('/resend-verification-email', nauth.adapter.wrapRouteHandler(async (req, reply) => {
  const dto: ResendVerificationEmailDTO = {
    email: req.body.email,
    baseUrl: 'https://example.com',
  };
  await nauth.emailVerificationService.resendVerificationEmail(dto);
  return { success: true };
}));
```

</TabItem>
</Tabs>

---

### sendVerificationEmail()

Send verification email to user with code and optional link.

```typescript
async sendVerificationEmail(dto: SendVerificationEmailDTO): Promise<SendVerificationEmailResponseDTO>
```

**Parameters**

- `dto` - [`SendVerificationEmailDTO`](../dto/send-verification-email-dto) - Request DTO
  - `sub` - `string` - User identifier (UUID v4)
  - `baseUrl` - `string` (optional) - Base URL for verification link
  - `skipAlreadyVerifiedCheck` - `boolean` (optional) - Skip already verified check (for MFA)

**Returns**

- [`SendVerificationEmailResponseDTO`](../dto/send-verification-email-response-dto) - Response with token ID
  - `tokenId` - `number` - Verification token ID (internal)

**Errors**

| Code                | When                    | Details                                      |
| ------------------- | ----------------------- | -------------------------------------------- |
| `ALREADY_VERIFIED`  | Email already verified  | `{}`                                         |
| `NOT_FOUND`         | User not found          | `{ userId: string }`                         |
| `RATE_LIMIT_EMAIL`  | Too many requests       | `{ retryAfter: number, currentCount: number }` |
| `RATE_LIMIT_RESEND` | Resend delay not met    | `{ retryAfter: number, resendDelay: number }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SendVerificationEmailDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private emailVerificationService: EmailVerificationService) {}

  async sendCode() {
    const dto: SendVerificationEmailDTO = {
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      baseUrl: 'https://example.com',
    };
    const result = await this.emailVerificationService.sendVerificationEmail(dto);
    console.log('Token ID:', result.tokenId);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SendVerificationEmailDTO } from '@nauth-toolkit/core';

app.post('/send-verification', async (req, res) => {
  const dto: SendVerificationEmailDTO = {
    sub: req.body.sub,
    baseUrl: 'https://example.com',
  };
  const result = await nauth.emailVerificationService.sendVerificationEmail(dto);
  res.json({ tokenId: result.tokenId });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SendVerificationEmailDTO } from '@nauth-toolkit/core';

fastify.post('/send-verification', nauth.adapter.wrapRouteHandler(async (req, reply) => {
  const dto: SendVerificationEmailDTO = {
    sub: req.body.sub,
    baseUrl: 'https://example.com',
  };
  const result = await nauth.emailVerificationService.sendVerificationEmail(dto);
  return { tokenId: result.tokenId };
}));
```

</TabItem>
</Tabs>

---

### verifyEmailWithCode()

Verify email address using 6-digit code.

```typescript
async verifyEmailWithCode(dto: VerifyEmailWithCodeDTO): Promise<VerifyEmailResponseDTO>
```

**Parameters**

- `dto` - [`VerifyEmailWithCodeDTO`](../dto/verify-email-with-code-dto) - Request DTO
  - `email` - `string` - User email address
  - `code` - `string` - 6-digit verification code

**Returns**

- [`VerifyEmailResponseDTO`](../dto/verify-email-response-dto) - Response with success message
  - `message` - `string` - Success message

**Errors**

| Code                             | When                    | Details                                      |
| -------------------------------- | ----------------------- | -------------------------------------------- |
| `NOT_FOUND`                      | User not found          | `{ email: string }`                          |
| `VERIFICATION_CODE_EXPIRED`      | Code expired            | `{}`                                         |
| `VERIFICATION_CODE_INVALID`      | Invalid or expired code | `{}`                                         |
| `VERIFICATION_TOO_MANY_ATTEMPTS` | Too many attempts       | `{}`                                         |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyEmailWithCodeDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private emailVerificationService: EmailVerificationService) {}

  async verify() {
    const dto: VerifyEmailWithCodeDTO = {
      email: 'user@example.com',
      code: '123456',
    };
    const result = await this.emailVerificationService.verifyEmailWithCode(dto);
    console.log(result.message);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyEmailWithCodeDTO } from '@nauth-toolkit/core';

app.post('/verify-email', async (req, res) => {
  const dto: VerifyEmailWithCodeDTO = {
    email: req.body.email,
    code: req.body.code,
  };
  const result = await nauth.emailVerificationService.verifyEmailWithCode(dto);
  res.json({ message: result.message });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyEmailWithCodeDTO } from '@nauth-toolkit/core';

fastify.post('/verify-email', nauth.adapter.wrapRouteHandler(async (req, reply) => {
  const dto: VerifyEmailWithCodeDTO = {
    email: req.body.email,
    code: req.body.code,
  };
  const result = await nauth.emailVerificationService.verifyEmailWithCode(dto);
  return { message: result.message };
}));
```

</TabItem>
</Tabs>

---

### verifyEmailWithToken()

Verify email address using URL token (link-based verification).

```typescript
async verifyEmailWithToken(dto: VerifyEmailWithTokenDTO): Promise<VerifyEmailResponseDTO>
```

**Parameters**

- `dto` - [`VerifyEmailWithTokenDTO`](../dto/verify-email-with-token-dto) - Request DTO
  - `token` - `string` - Verification token (64-character hex string)

**Returns**

- [`VerifyEmailResponseDTO`](../dto/verify-email-response-dto) - Response with success message
  - `message` - `string` - Success message

**Errors**

| Code                        | When                    | Details |
| --------------------------- | ----------------------- | ------- |
| `VERIFICATION_CODE_EXPIRED` | Token expired           | `{}`    |
| `VERIFICATION_CODE_INVALID` | Invalid or expired token| `{}`    |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyEmailWithTokenDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private emailVerificationService: EmailVerificationService) {}

  async verifyWithLink() {
    const dto: VerifyEmailWithTokenDTO = {
      token: 'abc123...', // 64-char hex string from URL
    };
    const result = await this.emailVerificationService.verifyEmailWithToken(dto);
    console.log(result.message);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyEmailWithTokenDTO } from '@nauth-toolkit/core';

app.get('/verify-email', async (req, res) => {
  const dto: VerifyEmailWithTokenDTO = {
    token: req.query.token as string,
  };
  const result = await nauth.emailVerificationService.verifyEmailWithToken(dto);
  res.json({ message: result.message });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyEmailWithTokenDTO } from '@nauth-toolkit/core';

fastify.get('/verify-email', nauth.adapter.wrapRouteHandler(async (req, reply) => {
  const dto: VerifyEmailWithTokenDTO = {
    token: req.query.token as string,
  };
  const result = await nauth.emailVerificationService.verifyEmailWithToken(dto);
  return { message: result.message };
}));
```

</TabItem>
</Tabs>

---

## Related

- [ResendVerificationEmailDTO](../dto/resend-verification-email-dto)
- [ResendVerificationEmailResponseDTO](../dto/resend-verification-email-response-dto)
- [SendVerificationEmailDTO](../dto/send-verification-email-dto)
- [SendVerificationEmailResponseDTO](../dto/send-verification-email-response-dto)
- [VerifyEmailResponseDTO](../dto/verify-email-response-dto)
- [VerifyEmailWithCodeDTO](../dto/verify-email-with-code-dto)
- [VerifyEmailWithTokenDTO](../dto/verify-email-with-token-dto)
- [AuthService](./auth-service)
- [NAuthException](../exceptions/nauth-exception)
