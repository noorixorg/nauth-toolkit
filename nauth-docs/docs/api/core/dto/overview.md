---
title: Data Transfer Objects (DTOs)
description: Complete reference for all request and response DTOs used in nauth-toolkit authentication APIs. Includes validation rules and usage examples.
keywords: [dto, data transfer objects, request, response, validation, api, typescript]
image: /img/api-social-card.png
sidebar_position: 0
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Data Transfer Objects (DTOs)

**Package:** `@nauth-toolkit/core`
**Type:** Data Transfer Objects

Platform-agnostic request and response DTOs for authentication operations. All DTOs use `class-validator` decorators for automatic validation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SignupDTO, LoginDTO, AuthResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SignupDTO, LoginDTO, AuthResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SignupDTO, LoginDTO, AuthResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

DTOs provide type-safe, validated data structures for all authentication operations. They ensure:
- **Type Safety** - Full TypeScript support with IntelliSense
- **Automatic Validation** - `class-validator` decorators enforce rules
- **Framework Integration** - NestJS and Express handle validation automatically

:::note
All DTOs are automatically validated by framework adapters. No manual validation required.
:::

## Authentication DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [SignupDTO](./signup-dto) | User registration request | Email, password, optional username/phone |
| [LoginDTO](./login-dto) | User login request | Identifier (email/username/phone) and password |
| [AuthResponseDTO](./auth-response-dto) | Unified authentication response | Tokens OR challenge (MFA/verification) |
| [RefreshTokenDTO](./refresh-token-dto) | Token refresh request | Refresh token |
| [LogoutDTO](./logout-dto) | Logout request | Session termination |
| [LogoutAllDTO](./logout-all-dto) | Logout all sessions | Revoke all user sessions |
| [LogoutResponseDTO](./logout-response-dto) | Logout response | Success confirmation |
| [LogoutAllResponseDTO](./logout-all-response-dto) | Logout all response | Count of revoked sessions |
| [TrustDeviceResponseDTO](./trust-device-response-dto) | Device trust response | Device trust token |

## Password Management DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [ChangePasswordRequestDTO](./change-password-request-dto) | Change password request | Current and new password |
| [ChangePasswordResponseDTO](./change-password-response-dto) | Change password response | Success confirmation |
| [ResetPasswordDTO](./reset-password-dto) | Reset password request | Reset token and new password |
| [ForgotPasswordDTO](./forgot-password-dto) | Forgot password flow | Request reset code and confirm reset |
| [SetMustChangePasswordDTO](./set-must-change-password-dto) | Force password change | Admin operation |
| [SetMustChangePasswordResponseDTO](./set-must-change-password-response-dto) | Force password change response | Success confirmation |
| [AdminSetPasswordDTO](./admin-set-password-dto) | Admin password reset | Identifier and new password |

## Email Verification DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [SendVerificationEmailDTO](./send-verification-email-dto) | Send verification email | User sub and optional base URL |
| [SendVerificationEmailResponseDTO](./send-verification-email-response-dto) | Send email response | Token ID |
| [VerifyEmailWithCodeDTO](./verify-email-with-code-dto) | Verify email with code | User sub and verification code |
| [VerifyEmailWithTokenDTO](./verify-email-with-token-dto) | Verify email with token | Verification token from URL |
| [VerifyEmailResponseDTO](./verify-email-response-dto) | Verify email response | Success message |
| [ResendVerificationEmailDTO](./resend-verification-email-dto) | Resend verification email | User sub or email |
| [ResendVerificationEmailResponseDTO](./resend-verification-email-response-dto) | Resend email response | Token ID |

## Phone Verification DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [SendVerificationSMSDTO](./send-verification-sms-dto) | Send verification SMS | User sub |
| [SendVerificationSMSResponseDTO](./send-verification-sms-response-dto) | Send SMS response | Token ID |
| [VerifyPhoneWithCodeDTO](./verify-phone-dto) | Verify phone with code | Phone number and code |
| [VerifyPhoneWithCodeBySubDTO](./verify-phone-by-sub-dto) | Verify phone by sub | User sub and code |
| [VerifyPhoneResponseDTO](./verify-phone-response-dto) | Verify phone response | Success message |
| [ResendVerificationSMSDTO](./resend-verification-sms-dto) | Resend verification SMS | User sub or phone |
| [ResendVerificationSMSResponseDTO](./resend-verification-sms-response-dto) | Resend SMS response | Token ID |

## Challenge Flow DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [RespondChallengeDTO](./respond-challenge-dto) | Respond to challenge | Challenge session and response data |
| [GetChallengeDataDTO](./get-challenge-data-dto) | Get challenge data | Challenge session token |
| [GetChallengeDataResponseDTO](./get-challenge-data-response-dto) | Challenge data response | Challenge information |
| [ChallengeResponseDTO](./challenge-response-dto) | Challenge response | Challenge type and session |
| [AuthChallengeDTO](./auth-challenge-dto) | Challenge details | Challenge type enum and parameters |

## MFA DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [GetAvailableMethodsDTO](./get-available-methods-dto) | Get available MFA methods | User sub |
| [GetSetupDataDTO](./get-setup-data-dto) | Get MFA setup data | Challenge session and method |
| [GetSetupDataResponseDTO](./get-setup-data-response-dto) | Setup data response | Provider-specific setup data |
| [SetupMFADTO](./setup-mfa-dto) | Setup MFA device | User sub, method name, setup data |
| [VerifyMFACodeDTO](./verify-mfa-code-dto) | Verify MFA code | User sub, method, code |
| [GetMFAStatusDTO](./get-mfa-status-dto) | Get MFA status | User sub |
| [GetUserDevicesDTO](./get-user-devices-dto) | Get user MFA devices | User sub |
| [SetPreferredMethodDTO](./set-preferred-method-dto) | Set preferred MFA method | User sub and method type |
| [SetMFAExemptionDTO](./set-mfa-exemption-dto) | Set MFA exemption | User sub, exempt flag, reason |
| [RemoveDevicesDTO](./remove-devices-dto) | Remove MFA devices | User sub and method type |

## Social Authentication DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [GetSocialAuthUrlDTO](./get-social-auth-url-dto) | Get social auth URL | Provider name and redirect URI |
| [GetSocialAuthUrlResponseDTO](./get-social-auth-url-response-dto) | Social auth URL response | Authorization URL |
| [HandleSocialCallbackDTO](./handle-social-callback-dto) | Handle social callback | Provider, code, state |
| [LinkSocialAccountDTO](./link-social-account-dto) | Link social account | Provider, code, state |
| [LinkSocialAccountResponseDTO](./link-social-account-response-dto) | Link account response | Success confirmation |
| [GetLinkedAccountsDTO](./get-linked-accounts-dto) | Get linked accounts | User sub |
| [GetLinkedAccountsResponseDTO](./get-linked-accounts-response-dto) | Linked accounts response | Array of linked providers |
| [UnlinkSocialAccountDTO](./unlink-social-account-dto) | Unlink social account | User sub and provider |
| [UnlinkSocialAccountResponseDTO](./unlink-social-account-response-dto) | Unlink account response | Success confirmation |
| [CanSetPasswordDTO](./can-set-password-dto) | Check if password can be set | User sub |
| [CanSetPasswordResponseDTO](./can-set-password-response-dto) | Can set password response | Boolean flag |
| [SetPasswordForSocialUserDTO](./set-password-for-social-user-dto) | Set password for social user | User sub and new password |
| [SetPasswordForSocialUserResponseDTO](./set-password-for-social-user-response-dto) | Set password response | Success confirmation |

## User Management DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [UserResponseDTO](./user-response-dto) | User profile data | User information (excludes sensitive fields) |
| [GetUserByEmailDTO](./get-user-by-email-dto) | Get user by email | Email address |
| [GetUserByIdDTO](./get-user-by-id-dto) | Get user by ID | User sub (UUID) |
| [UpdateUserAttributesRequestDTO](./update-user-attributes-request-dto) | Update user attributes | User sub and attributes |
| [UserUpdateDTO](./user-update-dto) | User update request | User profile fields |

## Audit & Client Info DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [GetUserAuthHistoryDTO](./get-user-auth-history-dto) | Get auth history | User sub, pagination, filters |
| [GetEventsByTypeDTO](./get-events-by-type-dto) | Get events by type | Event type, pagination, date range |
| [GetSuspiciousActivityDTO](./get-suspicious-activity-dto) | Get suspicious activity | User sub (optional), limit |
| [GetRiskAssessmentHistoryDTO](./get-risk-assessment-history-dto) | Get risk assessment history | User sub, limit |
| [GetClientInfoDTO](./get-client-info-dto) | Get client information | No parameters (from context) |
| [GetDeviceTokenResponseDTO](./get-device-token-response-dto) | Device token response | Device trust token |
| [GetIpAddressResponseDTO](./get-ip-address-response-dto) | IP address response | Client IP address |
| [GetSessionIdResponseDTO](./get-session-id-response-dto) | Session ID response | JWT session ID |
| [GetUserAgentResponseDTO](./get-user-agent-response-dto) | User agent response | Client user agent |

## Error & Utility DTOs

| DTO | Description | Documentation |
| --- | ----------- | ------------- |
| [ErrorResponseDTO](./error-response-dto) | Standardized error format | Error code, message, details |
| [ResendCodeDTO](./resend-code-dto) | Resend verification code | Challenge session |
| [ResendCodeResponseDTO](./resend-code-response-dto) | Resend code response | Success confirmation |
| [HasProviderDTO](./has-provider-dto) | Check if provider exists | Provider name |
| [ListProvidersResponseDTO](./list-providers-response-dto) | List providers response | Array of provider names |

## Usage

All DTOs are automatically validated by framework adapters:

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService, SignupDTO, AuthResponseDTO } from '@nauth-toolkit/nestjs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    // DTO automatically validated by NestJS
    return this.authService.signup(dto);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import express from 'express';
import { createNAuth, SignupDTO } from '@nauth-toolkit/core';

const app = express();
const nauth = await createNAuth(config, dataSource);

app.post('/signup', async (req, res) => {
  // DTO automatically validated by Express adapter
  const result = await nauth.authService.signup(req.body as SignupDTO);
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SignupDTO, LoginDTO, AuthResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Validation

All DTOs use `class-validator` decorators for automatic validation:

- **Email** - `@IsEmail()` validates email format
- **UUID** - `@IsUUID('4')` validates UUID v4 format
- **Phone** - `@Matches()` validates E.164 format
- **Length** - `@Length()`, `@MinLength()`, `@MaxLength()` enforce string length
- **Numbers** - `@IsNumberString()` for numeric strings
- **Required** - `@IsNotEmpty()` for required fields
- **Optional** - `@IsOptional()` for optional fields

Validation errors are automatically converted to `NAuthException` with `VALIDATION_FAILED` code.

## Related Documentation

- [AuthService](../services/auth-service) - Authentication methods
- [MFAService](../services/mfa-service) - MFA operations
- [SocialAuthService](../services/social-auth-service) - Social authentication
- [NAuthException](../exceptions/nauth-exception) - Error handling
- [Error Handling Guide](/docs/concepts/error-handling) - Best practices
