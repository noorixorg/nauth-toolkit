---
title: PhoneVerificationService
description: Phone verification service for sending SMS codes, verifying with code, and resending with rate limiting. Supports both phone number and user sub-based verification.
keywords: [phone, verification, service, sms, code, api]
image: /img/api-social-card.png
sidebar_position: 7
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# PhoneVerificationService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Phone verification service that handles sending verification SMS codes, verifying phones with codes, and resending with rate limiting.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { PhoneVerificationService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { PhoneVerificationService } from '@nauth-toolkit/core';
// Access via nauth.phoneVerificationService after NAuth.create()
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { PhoneVerificationService } from '@nauth-toolkit/core';
// Access via nauth.phoneVerificationService after NAuth.create()
```

</TabItem>
</Tabs>

## Overview

Handles phone verification workflow including code generation, SMS delivery, verification with code, and resend operations with rate limiting.

:::note
Auto-injected by framework. No manual instantiation required.
:::

## Methods

### resendVerificationSMS()

Resend verification SMS with rate limiting. Supports identification by user sub or phone number.

```typescript
async resendVerificationSMS(dto: ResendVerificationSMSDTO): Promise<ResendVerificationSMSResponseDTO>
```

**Parameters**

- `dto` - [`ResendVerificationSMSDTO`](../dto/resend-verification-sms-dto) - Request DTO
  - `sub` - `string` (optional) - User identifier (UUID v4)
  - `phone` - `string` (optional) - User phone number (E.164 format)

:::info
Either `sub` or `phone` must be provided (not both).
:::

**Returns**

- [`ResendVerificationSMSResponseDTO`](../dto/resend-verification-sms-response-dto) - Response with token ID
  - `tokenId` - `number` - Verification token ID (internal)

**Errors**

| Code                | When                   | Details                                        |
| ------------------- | ---------------------- | ---------------------------------------------- |
| `ALREADY_VERIFIED`  | Phone already verified | `{}`                                           |
| `NOT_FOUND`         | User not found         | `{ userId?: string }`                          |
| `PHONE_REQUIRED`    | No phone on account    | `{}`                                           |
| `RATE_LIMIT_RESEND` | Resend delay not met   | `{ retryAfter: number, resendDelay: number }`  |
| `RATE_LIMIT_SMS`    | Too many requests      | `{ retryAfter: number, currentCount: number }` |
| `VALIDATION_FAILED` | Neither sub nor phone  | `{ message: string }`                          |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendVerificationSMSDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private phoneVerificationService: PhoneVerificationService) {}

  async resendBySub() {
    const dto: ResendVerificationSMSDTO = {
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
    };
    await this.phoneVerificationService.resendVerificationSMS(dto);
  }

  async resendByPhone() {
    const dto: ResendVerificationSMSDTO = {
      phone: '+1234567890',
    };
    await this.phoneVerificationService.resendVerificationSMS(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendVerificationSMSDTO } from '@nauth-toolkit/core';

// Resend by sub
app.post('/resend-sms', async (req, res) => {
  const dto: ResendVerificationSMSDTO = {
    sub: req.body.sub,
  };
  await nauth.phoneVerificationService.resendVerificationSMS(dto);
  res.json({ success: true });
});

// Resend by phone
app.post('/resend-sms-phone', async (req, res) => {
  const dto: ResendVerificationSMSDTO = {
    phone: req.body.phone,
  };
  await nauth.phoneVerificationService.resendVerificationSMS(dto);
  res.json({ success: true });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendVerificationSMSDTO } from '@nauth-toolkit/core';

// Resend by sub
fastify.post(
  '/resend-sms',
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const dto: ResendVerificationSMSDTO = {
      sub: req.body.sub,
    };
    await nauth.phoneVerificationService.resendVerificationSMS(dto);
    return { success: true };
  }),
);

// Resend by phone
fastify.post(
  '/resend-sms-phone',
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const dto: ResendVerificationSMSDTO = {
      phone: req.body.phone,
    };
    await nauth.phoneVerificationService.resendVerificationSMS(dto);
    return { success: true };
  }),
);
```

</TabItem>
</Tabs>

---

### sendVerificationSMS()

Send verification SMS to user with code.

```typescript
async sendVerificationSMS(dto: SendVerificationSMSDTO): Promise<SendVerificationSMSResponseDTO>
```

**Parameters**

- `dto` - [`SendVerificationSMSDTO`](../dto/send-verification-sms-dto) - Request DTO
  - `sub` - `string` - User identifier (UUID v4)
  - `skipAlreadyVerifiedCheck` - `boolean` (optional) - Skip already verified check (for MFA)

**Returns**

- [`SendVerificationSMSResponseDTO`](../dto/send-verification-sms-response-dto) - Response with token ID
  - `tokenId` - `number` - Verification token ID (internal)

**Errors**

| Code                | When                   | Details                                        |
| ------------------- | ---------------------- | ---------------------------------------------- |
| `ALREADY_VERIFIED`  | Phone already verified | `{}`                                           |
| `NOT_FOUND`         | User not found         | `{ userId: string }`                           |
| `PHONE_REQUIRED`    | No phone on account    | `{}`                                           |
| `RATE_LIMIT_RESEND` | Resend delay not met   | `{ retryAfter: number, resendDelay: number }`  |
| `RATE_LIMIT_SMS`    | Too many requests      | `{ retryAfter: number, currentCount: number }` |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SendVerificationSMSDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private phoneVerificationService: PhoneVerificationService) {}

  async sendCode() {
    const dto: SendVerificationSMSDTO = {
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      skipAlreadyVerifiedCheck: false,
    };
    const result = await this.phoneVerificationService.sendVerificationSMS(dto);
    console.log('Token ID:', result.tokenId);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SendVerificationSMSDTO } from '@nauth-toolkit/core';

app.post('/send-sms', async (req, res) => {
  const dto: SendVerificationSMSDTO = {
    sub: req.body.sub,
  };
  const result = await nauth.phoneVerificationService.sendVerificationSMS(dto);
  res.json({ tokenId: result.tokenId });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SendVerificationSMSDTO } from '@nauth-toolkit/core';

fastify.post(
  '/send-sms',
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const dto: SendVerificationSMSDTO = {
      sub: req.body.sub,
    };
    const result = await nauth.phoneVerificationService.sendVerificationSMS(dto);
    return { tokenId: result.tokenId };
  }),
);
```

</TabItem>
</Tabs>

---

### verifyPhoneWithCode()

Verify phone number using 6-digit code.

```typescript
async verifyPhoneWithCode(dto: VerifyPhoneWithCodeDTO): Promise<VerifyPhoneResponseDTO>
```

**Parameters**

- `dto` - [`VerifyPhoneWithCodeDTO`](../dto/verify-phone-dto) - Request DTO
  - `phone` - `string` - Phone number (E.164 format)
  - `code` - `string` - 6-digit verification code

**Returns**

- [`VerifyPhoneResponseDTO`](../dto/verify-phone-response-dto) - Response with success message
  - `message` - `string` - Success message

**Errors**

| Code                             | When                    | Details                          |
| -------------------------------- | ----------------------- | -------------------------------- |
| `VERIFICATION_CODE_EXPIRED`      | Code expired            | `{}`                             |
| `VERIFICATION_CODE_INVALID`      | Invalid or expired code | `{ attemptsRemaining?: number }` |
| `VERIFICATION_TOO_MANY_ATTEMPTS` | Too many attempts       | `{}`                             |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyPhoneWithCodeDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private phoneVerificationService: PhoneVerificationService) {}

  async verify() {
    const dto: VerifyPhoneWithCodeDTO = {
      phone: '+1234567890',
      code: '123456',
    };
    const result = await this.phoneVerificationService.verifyPhoneWithCode(dto);
    console.log(result.message);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyPhoneWithCodeDTO } from '@nauth-toolkit/core';

app.post('/verify-phone', async (req, res) => {
  const dto: VerifyPhoneWithCodeDTO = {
    phone: req.body.phone,
    code: req.body.code,
  };
  const result = await nauth.phoneVerificationService.verifyPhoneWithCode(dto);
  res.json({ message: result.message });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyPhoneWithCodeDTO } from '@nauth-toolkit/core';

fastify.post(
  '/verify-phone',
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const dto: VerifyPhoneWithCodeDTO = {
      phone: req.body.phone,
      code: req.body.code,
    };
    const result = await nauth.phoneVerificationService.verifyPhoneWithCode(dto);
    return { message: result.message };
  }),
);
```

</TabItem>
</Tabs>

---

### verifyPhoneWithCodeBySub()

Verify phone using user sub and 6-digit code.

```typescript
async verifyPhoneWithCodeBySub(dto: VerifyPhoneWithCodeBySubDTO): Promise<VerifyPhoneResponseDTO>
```

**Parameters**

- `dto` - [`VerifyPhoneWithCodeBySubDTO`](../dto/verify-phone-by-sub-dto) - Request DTO
  - `sub` - `string` - User identifier (UUID v4)
  - `code` - `string` - 6-digit verification code

**Returns**

- [`VerifyPhoneResponseDTO`](../dto/verify-phone-response-dto) - Response with success message
  - `message` - `string` - Success message

**Errors**

| Code                             | When                    | Details                          |
| -------------------------------- | ----------------------- | -------------------------------- |
| `NOT_FOUND`                      | User not found          | `{ userId?: string }`            |
| `PHONE_REQUIRED`                 | No phone on account     | `{}`                             |
| `VERIFICATION_CODE_EXPIRED`      | Code expired            | `{}`                             |
| `VERIFICATION_CODE_INVALID`      | Invalid or expired code | `{ attemptsRemaining?: number }` |
| `VERIFICATION_TOO_MANY_ATTEMPTS` | Too many attempts       | `{}`                             |

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyPhoneWithCodeBySubDTO } from '@nauth-toolkit/nestjs';

@Injectable()
export class MyService {
  constructor(private phoneVerificationService: PhoneVerificationService) {}

  async verifyBySub() {
    const dto: VerifyPhoneWithCodeBySubDTO = {
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      code: '123456',
    };
    const result = await this.phoneVerificationService.verifyPhoneWithCodeBySub(dto);
    console.log(result.message);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyPhoneWithCodeBySubDTO } from '@nauth-toolkit/core';

app.post('/verify-phone-by-sub', async (req, res) => {
  const dto: VerifyPhoneWithCodeBySubDTO = {
    sub: req.body.sub,
    code: req.body.code,
  };
  const result = await nauth.phoneVerificationService.verifyPhoneWithCodeBySub(dto);
  res.json({ message: result.message });
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyPhoneWithCodeBySubDTO } from '@nauth-toolkit/core';

fastify.post(
  '/verify-phone-by-sub',
  nauth.adapter.wrapRouteHandler(async (req, reply) => {
    const dto: VerifyPhoneWithCodeBySubDTO = {
      sub: req.body.sub,
      code: req.body.code,
    };
    const result = await nauth.phoneVerificationService.verifyPhoneWithCodeBySub(dto);
    return { message: result.message };
  }),
);
```

</TabItem>
</Tabs>

## Related

- [ResendVerificationSMSDTO](../dto/resend-verification-sms-dto)
- [ResendVerificationSMSResponseDTO](../dto/resend-verification-sms-response-dto)
- [SendVerificationSMSDTO](../dto/send-verification-sms-dto)
- [SendVerificationSMSResponseDTO](../dto/send-verification-sms-response-dto)
- [VerifyPhoneBySubDTO](../dto/verify-phone-by-sub-dto)
- [VerifyPhoneDTO](../dto/verify-phone-dto)
- [VerifyPhoneResponseDTO](../dto/verify-phone-response-dto)
- [AuthService](./auth-service)
- [NAuthException](../exceptions/nauth-exception)
