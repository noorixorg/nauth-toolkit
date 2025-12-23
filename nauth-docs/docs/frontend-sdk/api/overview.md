---
title: API Overview
description: Complete API reference for the nauth-toolkit frontend SDK
sidebar_position: 0
keywords: [api, reference, sdk, client]
image: /img/api-social-card.png
---

# API Reference

Complete API reference for `@nauth-toolkit/client`.

## Core SDK

| Export                                                       | Type      | Description                                         |
| ------------------------------------------------------------ | --------- | --------------------------------------------------- |
| [`NAuthClient`](./nauth-client)                              | Class     | Main client class for all authentication operations |
| [`NAuthClientConfig`](./nauth-client-config)                 | Interface | Configuration options                               |
| [`NAuthClientError`](./nauth-client-error)                   | Class     | Error class for SDK operations                      |
| [`BrowserStorage`](./nauth-client-config#built-in-adapters)  | Class     | localStorage/sessionStorage adapter                 |
| [`InMemoryStorage`](./nauth-client-config#built-in-adapters) | Class     | In-memory storage adapter                           |

## Types

All TypeScript types are exported from the main package:

```typescript
import {
  // Auth types
  AuthChallenge, // See [AuthChallenge](./types/auth-challenge)
  AuthResponse, // See [AuthResponse](./types/auth-response)
  ChallengeResponse, // See [ChallengeResponse](./types/challenge-response)
  SignupRequest, // See [SignupRequest](./types/signup-request)
  TokenResponse, // See [TokenResponse](./types/token-response)

  // Challenge helper utilities
  getMaskedDestination, // See [Challenge Helpers](./utilities/challenge-helpers#getmaskeddestination)
  getMFAMethod, // See [Challenge Helpers](./utilities/challenge-helpers#getmfamethod)
  requiresPhoneCollection, // See [Challenge Helpers](./utilities/challenge-helpers#requiresphonecollection)
  getChallengeInstructions, // See [Challenge Helpers](./utilities/challenge-helpers#getchallengeinstructions)
  isOTPChallenge, // See [Challenge Helpers](./utilities/challenge-helpers#isotpchallenge)

  // User types
  AuthUser, // See [AuthUser](./types/auth-user)
  AuthUserSummary, // See [AuthUserSummary](./types/auth-user-summary)
  ChangePasswordRequest, // See [ChangePasswordRequest](./types/change-password-request)
  UpdateProfileRequest, // See [UpdateProfileRequest](./types/update-profile-request)

  // MFA types
  BackupCodesResponse, // See [BackupCodesResponse](./types/backup-codes-response)
  GetChallengeDataResponse, // See [GetChallengeDataResponse](./types/get-challenge-data-response)
  GetSetupDataResponse, // See [GetSetupDataResponse](./types/get-setup-data-response)
  MFAChallengeMethod, // See [MFAChallengeMethod](./types/mfa-challenge-method)
  MFADevice, // See [MFADevice](./types/mfa-device)
  MFAMethod, // See [MFAMethod](./types/mfa-method)
  MFAStatus, // See [MFAStatus](./types/mfa-status)

  // Social types
  LinkedAccountsResponse, // See [LinkedAccountsResponse](./types/linked-accounts-response)
  SocialLoginOptions, // See [SocialLoginOptions](./types/social-login-options)
  SocialVerifyRequest, // See [SocialVerifyRequest](./types/social-verify-request)

  // Config types
  NAuthEndpoints, // See [NAuthEndpoints](./types/nauth-endpoints)
  NAuthStorageAdapter, // See [NAuthStorageAdapter](./types/nauth-storage-adapter)
  TokenDeliveryMode, // See [TokenDeliveryMode](./types/token-delivery-mode)

  // Audit types
  AuditHistoryResponse, // See [AuditHistoryResponse](./types/audit-history-response)
  AuthAuditEvent, // See [AuthAuditEvent](./types/auth-audit-event)
  AuthAuditEventStatus, // See [AuthAuditEventStatus](./types/auth-audit-event-status)
  AuthAuditEventType, // See [AuthAuditEventType](./types/auth-audit-event-type)

  // Error types
  NAuthClientError, // See [NAuthClientError](./nauth-client-error)
  NAuthError, // See [NAuthError](./types/nauth-error)
  NAuthErrorCode, // See [NAuthErrorCode](./types/nauth-error-code)
} from '@nauth-toolkit/client';
```

See individual type pages in the [Types](./types/auth-audit-event) section for full documentation.

## Utilities

| Export                                                      | Type     | Description                                    |
| ----------------------------------------------------------- | -------- | ---------------------------------------------- |
| [`Challenge Helpers`](./utilities/challenge-helpers)        | Functions | Helper utilities for working with challenges   |

See [Challenge Helpers](./utilities/challenge-helpers) for complete documentation.

## Angular Adapter

```typescript
import {
  NAUTH_CLIENT_CONFIG,
  AuthService,
  authInterceptor,
  AuthInterceptor,
  authGuard,
  AuthGuard,
  NAuthModule,
} from '@nauth-toolkit/client/angular';
```

| Export                                      | Type              | Description                               |
| ------------------------------------------- | ----------------- | ----------------------------------------- |
| `NAUTH_CLIENT_CONFIG`                       | InjectionToken    | DI token for configuration                |
| [`AuthService`](../angular/auth-service)    | Service           | Angular wrapper with Observables          |
| [`authInterceptor`](../angular/interceptor) | HttpInterceptorFn | Functional HTTP interceptor               |
| `AuthInterceptor`                           | Class             | Class-based interceptor for NgModule      |
| [`authGuard`](../angular/guards)            | CanActivateFn     | Functional route guard                    |
| `AuthGuard`                                 | Class             | Class-based guard for NgModule            |
| `NAuthModule`                               | NgModule          | Module with `forRoot()` for NgModule apps |

## Quick Import Examples

### Vanilla JavaScript/TypeScript

```typescript
import { NAuthClient, BrowserStorage } from '@nauth-toolkit/client';
import type { AuthResponse, AuthUser } from '@nauth-toolkit/client';

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => {},
});
```

### Angular Standalone

```typescript
import { NAUTH_CLIENT_CONFIG, authInterceptor, AuthService, authGuard } from '@nauth-toolkit/client/angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        /* config */
      },
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

### Angular NgModule

```typescript
import { NAuthModule, AuthInterceptor, AuthGuard } from '@nauth-toolkit/client/angular';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

@NgModule({
  imports: [
    NAuthModule.forRoot({
      /* config */
    }),
  ],
  providers: [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }],
})
export class AppModule {}
```
