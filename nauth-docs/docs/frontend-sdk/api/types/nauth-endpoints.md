---
title: NAuthEndpoints
description: Endpoint paths configuration for the client SDK
keywords: [endpoints, configuration, api, paths]
image: /img/api-social-card.png
---

# NAuthEndpoints

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Endpoint paths configuration for the client SDK. Override these if your backend uses different paths.

## Interface

```typescript
interface NAuthEndpoints {
  login: string;
  signup: string;
  logout: string;
  logoutAll: string;
  refresh: string;
  respondChallenge: string;
  resendCode: string;
  getSetupData: string;
  getChallengeData: string;
  profile: string;
  changePassword: string;
  forgotPassword: string;
  confirmForgotPassword: string;
  confirmAdminResetPassword: string;
  mfaStatus: string;
  mfaDevices: string;
  mfaSetupData: string;
  mfaVerifySetup: string;
  mfaPreferred: string;
  mfaBackupCodes: string;
  mfaAvailableMethods: string;
  socialLinked: string;
  socialLink: string;
  socialUnlink: string;
  socialVerify: string;
  socialRedirectStart: string;
  socialExchange: string;
  socialCanSetPassword: string;
  socialSetPassword: string;
  trustDevice: string;
  isTrustedDevice: string;
  auditHistory: string;
  updateProfile: string;
  sessions: string;
  logoutSession: string;
  trustedDevices: string;
  trustedDevice: string;
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
  changePassword: '/change-password',
  forgotPassword: '/forgot-password',
  confirmForgotPassword: '/forgot-password/confirm',
  confirmAdminResetPassword: '/reset-password/confirm',
  mfaStatus: '/mfa/status',
  mfaDevices: '/mfa/devices',
  mfaSetupData: '/mfa/setup-data',
  mfaVerifySetup: '/mfa/verify-setup',
  mfaPreferred: '/mfa/devices/:deviceId/preferred',
  mfaBackupCodes: '/mfa/backup-codes/generate',
  mfaAvailableMethods: '/mfa/available-methods',
  socialLinked: '/social/linked',
  socialLink: '/social/link',
  socialUnlink: '/social/unlink',
  socialVerify: '/social/:provider/verify',
  socialRedirectStart: '/social/:provider/redirect',
  socialExchange: '/social/exchange',
  socialCanSetPassword: '/social/can-set-password',
  socialSetPassword: '/social/set-password',
  trustDevice: '/trust-device',
  isTrustedDevice: '/is-trusted-device',
  auditHistory: '/audit/history',
  updateProfile: '/profile',
  sessions: '/sessions',
  logoutSession: '/sessions/:sessionId',
  trustedDevices: '/trusted-devices',
  trustedDevice: '/trusted-devices/:deviceId',
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

:::note[No key for MFA device removal]
There is no endpoint key for removing an MFA device; the client derives that path from
`mfaDevices`.
:::
