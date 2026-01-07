---
title: NAuthEndpoints
description: Endpoint paths configuration for the client SDK
keywords: [endpoints, configuration, api, paths]
image: /img/api-social-card.png
sidebar_position: 240
---

# NAuthEndpoints

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Endpoint paths configuration for the client SDK. Override these if your backend uses different paths.

## Interface

```typescript
interface NAuthEndpoints {
  // Authentication
  login: string;
  signup: string;
  logout: string;
  logoutAll: string;
  refresh: string;

  // Challenge Flow
  respondChallenge: string;
  resendCode: string;
  getSetupData: string;
  getChallengeData: string;

  // User Profile
  profile: string;
  updateProfile: string;
  changePassword: string;
  requestPasswordChange: string;
  forgotPassword: string;
  confirmForgotPassword: string;
  confirmAdminResetPassword: string;

  // MFA Management
  mfaStatus: string;
  mfaDevices: string;
  mfaSetupData: string;
  mfaVerifySetup: string;
  mfaRemove: string;
  mfaPreferred: string;
  mfaBackupCodes: string;
  mfaExemption: string;

  // Social Authentication
  socialRedirectStart: string;
  socialExchange: string;
  socialLinked: string;
  socialLink: string;
  socialUnlink: string;
  socialVerify: string;

  // Device Trust
  trustDevice: string;
  isTrustedDevice: string;

  // Audit
  auditHistory: string;
}
```

## Default Endpoints

```typescript
{
  login: '/login',
  signup: '/signup',
  logout: '/logout',
  logoutAll: '/logout/all',
  refresh: '/refresh',
  respondChallenge: '/respond-challenge',
  resendCode: '/challenge/resend',
  getSetupData: '/challenge/setup-data',
  getChallengeData: '/challenge/challenge-data',
  profile: '/profile',
  updateProfile: '/profile',
  changePassword: '/change-password',
  requestPasswordChange: '/request-password-change',
  forgotPassword: '/forgot-password',
  confirmForgotPassword: '/forgot-password/confirm',
  confirmAdminResetPassword: '/admin/reset-password/confirm',
  mfaStatus: '/mfa/status',
  mfaDevices: '/mfa/devices',
  mfaSetupData: '/mfa/setup-data',
  mfaVerifySetup: '/mfa/verify-setup',
  mfaRemove: '/mfa/method',
  mfaPreferred: '/mfa/preferred-method',
  mfaBackupCodes: '/mfa/backup-codes/generate',
  mfaExemption: '/mfa/exemption',
  socialLinked: '/social/linked',
  socialLink: '/social/link',
  socialUnlink: '/social/unlink',
  socialVerify: '/social/:provider/verify',
  socialRedirectStart: '/social/:provider/redirect',
  socialExchange: '/social/exchange',
  trustDevice: '/trust-device',
  isTrustedDevice: '/is-trusted-device',
  auditHistory: '/audit/history',
}
```

## Example

Override endpoints if your backend uses different paths:

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => {},
  endpoints: {
    login: '/signin', // Custom path
    signup: '/register', // Custom path
    // ... other endpoints use defaults
  },
});
```

## Used By

- [NAuthClientConfig](../nauth-client-config) - `endpoints` property

## Related Types

- [`NAuthClientConfig`](../nauth-client-config) - Client configuration interface
