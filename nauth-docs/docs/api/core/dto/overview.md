---
title: Data Transfer Objects (DTOs)
description: Complete reference for all request and response DTOs used in nauth-toolkit authentication APIs. Includes validation rules and usage examples.
keywords: [dto, data transfer objects, request, response, validation, api, typescript]
image: /img/api-social-card.png
sidebar_position: 1
sidebar_label: Overview
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

| DTO                                                   | Description                     | Documentation                                  |
| ----------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| [AuthResponseDTO](./auth-response-dto)                | Unified authentication response | Tokens OR challenge (MFA/verification)         |
| [LoginDTO](./login-dto)                               | User login request              | Identifier (email/username/phone) and password |
| [LogoutAllDTO](./logout-all-dto)                      | Logout all sessions             | Revoke all user sessions                       |
| [LogoutAllResponseDTO](./logout-all-response-dto)     | Logout all response             | Count of revoked sessions                      |
| [LogoutDTO](./logout-dto)                             | Logout request                  | Session termination                            |
| [LogoutResponseDTO](./logout-response-dto)            | Logout response                 | Success confirmation                           |
| [RefreshTokenDTO](./refresh-token-dto)                | Token refresh request           | Refresh token                                  |
| [SignupDTO](./signup-dto)                             | User registration request       | Email, password, optional username/phone       |
| [TrustDeviceResponseDTO](./trust-device-response-dto) | Device trust response           | Device trust token                             |
| [Trusted Device DTOs](./trusted-device-dto) | List and revoke trusted devices | Device records, revocation results             |
| [IsTrustedDeviceResponseDTO](./is-trusted-device-response-dto) | Trusted device check response | Whether current device is trusted              |

## Session Management DTOs

| DTO                                                              | Description              | Documentation                |
| ---------------------------------------------------------------- | ------------------------ | ---------------------------- |
| [GetUserSessionsDTO](./get-user-sessions-dto)                    | Get user sessions        | Pagination and filters       |
| [GetUserSessionsResponseDTO](./get-user-sessions-response-dto)   | Sessions list response   | Active sessions with details |
| [LogoutSessionDTO](./logout-session-dto)                         | Logout specific session  | Session ID                   |
| [LogoutSessionResponseDTO](./logout-session-response-dto)        | Session logout response  | Success confirmation         |

## Admin Operations DTOs

| DTO                                                                | Description                  | Documentation                                                                       |
| ------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------- |
| [AdminSetPasswordDTO](./admin-set-password-dto)                    | Admin password reset         | Set user password by sub                                                            |
| [AdminSignupDTO](./admin-signup-dto)                               | Admin user creation          | Create user with override capabilities (bypass verification, force password change) |
| [AdminSignupSocialDTO](./admin-signup-social-dto)                  | Admin social user import     | Import social users from external platforms (Cognito, Auth0) with social linkage    |
| [AdminSignupSocialResponseDTO](./admin-signup-social-response-dto) | Admin social import response | User object and social account confirmation                                         |
| [DeleteUserDTO](./delete-user-dto)                                 | Admin user deletion          | Hard delete user with complete cascade cleanup                                      |
| [DeleteUserResponseDTO](./delete-user-response-dto)                | Admin deletion response      | Deletion confirmation with cascade counts                                           |
| [DisableUserDTO](./disable-user-dto)                               | Admin account locking        | Permanent account lock with session revocation                                      |
| [DisableUserResponseDTO](./disable-user-response-dto)              | Admin lock response          | Lock confirmation with revoked session count                                        |
| [EnableUserDTO](./enable-user-dto)                                 | Admin account unlocking      | Clear lock fields and reset failed attempts                                         |
| [EnableUserResponseDTO](./enable-user-response-dto)                | Admin unlock response        | Unlock confirmation with updated user status                                        |
| [GetUsersDTO](./get-users-dto)                                     | Admin user listing           | Paginated user search with advanced filtering                                       |
| [GetUsersResponseDTO](./get-users-response-dto)                    | Admin listing response       | User list with pagination metadata                                                  |
| [AdminLogoutAllDTO](./admin-logout-all-dto)                        | Admin global logout          | Revoke all sessions for a target user                                              |
| [AdminUpdateUserAttributesDTO](./admin-update-user-attributes-dto) | Admin user update            | Update user profile attributes with required sub                                   |
| [AdminResetPasswordDTO](./confirm-admin-reset-password-dto)        | Admin password reset request | Initiate admin-driven password reset                                               |
| [AdminRevokeSessionDTO](./admin-revoke-session-dto)                | Admin session revoke         | Revoke a specific session for a target user                                        |
| [ConfirmAdminResetPasswordDTO](./confirm-admin-reset-password-dto) | Confirm admin password reset | Code, new password, and session                                                    |
| [UpdateVerifiedStatusRequestDTO](./update-verified-status-request-dto) | Admin verification status | Update email/phone verified flags                                                  |

## API Key DTOs

| DTO                                                    | Description                     | Documentation                                             |
| ------------------------------------------------------ | ------------------------------- | --------------------------------------------------------- |
| [CreateApiKeyDTO](./create-api-key-dto)                | Create API key (user)           | Name, mandatory expiry, optional IP allowlist             |
| [UpdateApiKeyDTO](./update-api-key-dto)                | Update API key (user)           | Change label and/or IP allowlist                          |
| [RevokeApiKeyDTO](./revoke-api-key-dto)                | Revoke API key (user)           | Soft-disable a key by keyId                               |
| [DeleteApiKeyDTO](./delete-api-key-dto)                | Delete API key (user)           | Permanently delete a key by keyId                         |
| [ApiKeyResponseDTO](./api-key-response-dto)            | Sanitized key metadata          | Returned by list/update (never the secret)                |
| [CreateApiKeyResponseDTO](./create-api-key-response-dto) | Key creation response         | One-time plaintext key plus metadata                      |
| [ListApiKeysResponseDTO](./list-api-keys-response-dto) | Key list response               | `{ apiKeys }` — sanitized array                           |
| [RevokeApiKeyResponseDTO](./revoke-api-key-response-dto) | Key revoke response           | `{ success }`                                             |
| [DeleteApiKeyResponseDTO](./delete-api-key-response-dto) | Key delete response           | `{ success }`                                             |
| [AdminCreateApiKeyDTO](./admin-create-api-key-dto)     | Admin create key for user       | Target sub plus key options                               |
| [AdminUpdateApiKeyDTO](./admin-update-api-key-dto)     | Admin update user's key         | Target sub, keyId, label/IP allowlist                     |
| [AdminManageApiKeyDTO](./admin-manage-api-key-dto)     | Admin list/revoke/delete key    | Target sub and optional keyId                             |

## Password Management DTOs

| DTO                                                                         | Description                    | Documentation                        |
| --------------------------------------------------------------------------- | ------------------------------ | ------------------------------------ |
| [ChangePasswordDTO](./change-password-dto)                                  | Change password request        | Current and new password             |
| [ChangePasswordResponseDTO](./change-password-response-dto)                 | Change password response       | Success confirmation                 |
| [ConfirmForgotPasswordDTO](./forgot-password-dto)                           | Confirm password reset         | Reset code and new password          |
| [ForgotPasswordDTO](./forgot-password-dto)                                  | Forgot password flow           | Request reset code                   |
| [ResetPasswordDTO](./reset-password-dto)                                    | Reset password request         | Reset token and new password         |
| [SetMustChangePasswordDTO](./set-must-change-password-dto)                  | Force password change          | Admin operation                      |
| [SetMustChangePasswordResponseDTO](./set-must-change-password-response-dto) | Force password change response | Success confirmation                 |

## Email Verification DTOs

| DTO                                                                            | Description               | Documentation                  |
| ------------------------------------------------------------------------------ | ------------------------- | ------------------------------ |
| [ResendVerificationEmailDTO](./resend-verification-email-dto)                  | Resend verification email | User sub or email              |
| [ResendVerificationEmailResponseDTO](./resend-verification-email-response-dto) | Resend email response     | Token ID                       |
| [SendVerificationEmailDTO](./send-verification-email-dto)                      | Send verification email   | User sub and optional base URL |
| [SendVerificationEmailResponseDTO](./send-verification-email-response-dto)     | Send email response       | Token ID                       |
| [VerifyEmailResponseDTO](./verify-email-response-dto)                          | Verify email response     | Success message                |
| [VerifyEmailWithCodeDTO](./verify-email-with-code-dto)                         | Verify email with code    | Email address and 6-digit verification code |
| [VerifyEmailWithTokenDTO](./verify-email-with-token-dto)                       | Verify email with token   | Verification token from URL    |

## Phone Verification DTOs

| DTO                                                                        | Description             | Documentation         |
| -------------------------------------------------------------------------- | ----------------------- | --------------------- |
| [ResendVerificationSMSDTO](./resend-verification-sms-dto)                  | Resend verification SMS | User sub or phone     |
| [ResendVerificationSMSResponseDTO](./resend-verification-sms-response-dto) | Resend SMS response     | Token ID              |
| [SendVerificationSMSDTO](./send-verification-sms-dto)                      | Send verification SMS   | User sub              |
| [SendVerificationSMSResponseDTO](./send-verification-sms-response-dto)     | Send SMS response       | Token ID              |
| [VerifyPhoneResponseDTO](./verify-phone-response-dto)                      | Verify phone response   | Success message       |
| [VerifyPhoneWithCodeBySubDTO](./verify-phone-by-sub-dto)                   | Verify phone by sub     | User sub and code     |
| [VerifyPhoneWithCodeDTO](./verify-phone-dto)                               | Verify phone with code  | Phone number and code |

## Challenge Flow DTOs

| DTO                                                              | Description              | Documentation                           |
| ---------------------------------------------------------------- | ------------------------ | --------------------------------------- |
| [AuthChallengeDTO](./auth-challenge-dto)                         | Challenge details        | Challenge type enum and parameters      |
| [ChallengeResponseData](./challenge-response-dto)                | Challenge response types | TypeScript discriminated union types    |
| [GetChallengeDataDTO](./get-challenge-data-dto)                  | Get challenge data       | Challenge session token                 |
| [GetChallengeDataResponseDTO](./get-challenge-data-response-dto) | Challenge data response  | Challenge information                   |
| [RespondChallengeDTO](./respond-challenge-dto)                   | Respond to challenge     | Challenge session and response data     |
| [AuthChallengeResponseDTO](./auth-challenge-dto)                 | Challenge response       | Challenge type, session, and parameters |

## MFA DTOs

| DTO                                                                | Description                        | Documentation                       |
| ------------------------------------------------------------------ | ---------------------------------- | ----------------------------------- |
| [AdminGetMFAStatusDTO](./admin-get-mfa-status-dto)                 | Admin get MFA status               | Target user sub                     |
| [AdminGetUserDevicesDTO](./admin-get-user-devices-dto)             | Admin get user MFA devices         | Target user sub                     |
| [AdminRemoveDeviceDTO](./admin-remove-device-dto)                  | Admin remove MFA device by ID      | Device ID                           |
| [AdminSetPreferredDeviceDTO](./admin-set-preferred-device-dto)     | Admin set preferred MFA device     | User sub and device ID              |
| [GenerateBackupCodesResponseDTO](./generate-backup-codes-response-dto) | Backup codes response          | Plaintext recovery codes            |
| [GetAvailableMethodsResponseDTO](./get-available-methods-response-dto) | Available MFA methods response | Allowed method names                |
| [GetMFAStatusResponseDTO](./get-mfa-status-dto)                    | MFA status response                | Status fields                       |
| [GetSetupDataDTO](./get-setup-data-dto)                            | Get MFA setup data                 | Challenge session and method        |
| [GetSetupDataResponseDTO](./get-setup-data-response-dto)           | Setup data response                | Provider-specific setup data        |
| [GetUserDevicesDTO](./get-user-devices-dto)                        | Get user MFA devices (self-service)| User from context                   |
| [RemoveDeviceDTO](./remove-device-dto)                             | Remove MFA device by ID            | Device ID                           |
| [SetMFAExemptionDTO](./set-mfa-exemption-dto)                      | Set MFA exemption                  | User sub, exempt flag, reason       |
| [SetPreferredDeviceDTO](./set-preferred-device-dto)                | Set preferred MFA device           | Device ID                           |
| [SetupMFADTO](./setup-mfa-dto)                                     | Setup MFA device                   | Method name, setup data             |
| [VerifyMFACodeDTO](./verify-mfa-code-dto)                          | Verify MFA code                    | Method, code                        |

## Social Authentication DTOs

| DTO                                                                                | Description                       | Documentation              |
| ---------------------------------------------------------------------------------- | --------------------------------- | -------------------------- |
| [CanSetPasswordResponseDTO](./can-set-password-response-dto)                       | Can set password response         | Boolean flag               |
| [GetLinkedAccountsDTO](./get-linked-accounts-dto)                                  | Get linked accounts               | User sub                   |
| [GetLinkedAccountsResponseDTO](./get-linked-accounts-response-dto)                 | Linked accounts response          | Array of linked providers  |
| [LinkSocialAccountDTO](./link-social-account-dto)                                  | Link social account               | Provider, code, state      |
| [LinkSocialAccountResponseDTO](./link-social-account-response-dto)                 | Link account response             | Success confirmation       |
| [SetPasswordForSocialUserDTO](./set-password-for-social-user-dto)                  | Set password for social user      | New password               |
| [SetPasswordForSocialUserResponseDTO](./set-password-for-social-user-response-dto) | Set password response             | Success confirmation       |
| [SocialCallbackFormDTO](./social-callback-form-dto)                                | OAuth callback form data (POST)   | Apple form_post callbacks  |
| [SocialCallbackQueryDTO](./social-callback-query-dto)                              | OAuth callback query params (GET) | Google, Facebook callbacks |
| [SocialExchangeDTO](./social-exchange-dto)                                         | Exchange social redirect token    | One-time exchange token    |
| [SocialRedirectCallbackResponseDTO](./social-redirect-callback-response-dto)       | Callback redirect response        | url for @Redirect()        |
| [StartSocialRedirectQueryDTO](./start-social-redirect-query-dto)                   | Start social redirect flow        | returnTo, appState, action |
| [StartSocialRedirectResponseDTO](./start-social-redirect-response-dto)             | Start redirect response           | url for @Redirect()        |
| [UnlinkSocialAccountDTO](./unlink-social-account-dto)                              | Unlink social account             | User sub and provider      |
| [UnlinkSocialAccountResponseDTO](./unlink-social-account-response-dto)             | Unlink account response           | Success confirmation       |
| [VerifyTokenDTO](./verify-token-dto)                                               | Verify native social token        | Provider, ID token, access token |
| [HandleCallbackDTO](./handle-callback-dto)                                         | Handle OAuth callback             | Provider callback data     |

## User Management DTOs

| DTO                                                                    | Description            | Documentation                                |
| ---------------------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| [GetUserByEmailDTO](./get-user-by-email-dto)                           | Get user by email      | Email address                                |
| [GetUserByIdDTO](./get-user-by-id-dto)                                 | Get user by ID         | User sub (UUID)                              |
| [UpdateUserAttributesDTO](./update-user-attributes-dto)                | Update user attributes | User attributes (self-service)              |
| [UserResponseDTO](./user-response-dto)                                 | User profile data      | User information (excludes sensitive fields) |
| [UserUpdateDTO](./user-update-dto)                                     | User update request    | User profile fields                          |

## Audit & Client Info DTOs

| DTO                                                              | Description                 | Documentation                      |
| ---------------------------------------------------------------- | --------------------------- | ---------------------------------- |
| [GetClientInfoDTO](./get-client-info-dto)                        | Get client information      | No parameters (from context)       |
| [GetDeviceTokenResponseDTO](./get-device-token-response-dto)     | Device token response       | Device trust token                 |
| [GetEventsByTypeDTO](./get-events-by-type-dto)                   | Get events by type          | Event type, pagination, date range |
| [GetIpAddressResponseDTO](./get-ip-address-response-dto)         | IP address response         | Client IP address                  |
| [GetRiskAssessmentHistoryDTO](./get-risk-assessment-history-dto) | Get risk assessment history | User sub, limit                    |
| [GetSessionIdResponseDTO](./get-session-id-response-dto)         | Session ID response         | JWT session ID                     |
| [GetSuspiciousActivityDTO](./get-suspicious-activity-dto)        | Get suspicious activity     | User sub (optional), limit         |
| [GetUserAgentResponseDTO](./get-user-agent-response-dto)         | User agent response         | Client user agent                  |
| [GetUserAuthHistoryDTO](./get-user-auth-history-dto)             | Get auth history            | User sub, pagination, filters      |
| [GetUserAuthHistoryResponseDTO](./get-user-auth-history-response-dto) | Auth history response  | Paginated event list               |
| [GetEventsByTypeResponseDTO](./get-events-by-type-response-dto)  | Events by type response     | Filtered event list                |
| [GetRiskAssessmentHistoryResponseDTO](./get-risk-assessment-history-response-dto) | Risk assessment response | Risk scores and factors |
| [GetSuspiciousActivityResponseDTO](./get-suspicious-activity-response-dto) | Suspicious activity response | Flagged events             |

## Token Validation DTOs

| DTO                                                                    | Description                 | Documentation                |
| ---------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| [ValidateAccessTokenDTO](./validate-access-token-dto)                  | Validate access token       | Token string                 |
| [ValidateAccessTokenResponseDTO](./validate-access-token-response-dto) | Validation response         | Decoded JWT payload          |

## Error & Utility DTOs

| DTO                                                       | Description               | Documentation                |
| --------------------------------------------------------- | ------------------------- | ---------------------------- |
| [ErrorResponseDTO](./error-response-dto)                  | Standardized error format | Error code, message, details |
| [HasProviderDTO](./has-provider-dto)                      | Check if provider exists  | Provider name                |
| [ListProvidersResponseDTO](./list-providers-response-dto) | List providers response   | Array of provider names      |
| [ResendCodeDTO](./resend-code-dto)                        | Resend verification code  | Challenge session            |
| [ResendCodeResponseDTO](./resend-code-response-dto)       | Resend code response      | Success confirmation         |

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
