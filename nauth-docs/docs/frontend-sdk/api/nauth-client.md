---
title: NAuthClient
description: Core client class for nauth-toolkit frontend SDK
sidebar_position: 1
keywords: [client, sdk, authentication, api, methods]
image: /img/api-social-card.png
---

# NAuthClient

**Package:** `@nauth-toolkit/client`
**Type:** Class

Primary client for interacting with nauth-toolkit backend. Handles authentication, challenges, MFA, social auth, and token management.

```typescript
import { NAuthClient } from '@nauth-toolkit/client';
```

## Constructor

```typescript
new NAuthClient(config: NAuthClientConfig)
```

**Parameters**

- `config` - [`NAuthClientConfig`](./nauth-client-config)

**Example**

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => window.location.replace('/login'),
  onAuthStateChange: (user) => console.log('Auth state:', user),
});
```

---

## Lifecycle Methods

### initialize()

Hydrates client state from storage. Call on app startup to restore authentication state.

```typescript
async initialize(): Promise<void>
```

**Example**

```typescript
await client.initialize();
const user = client.getCurrentUser();
```

---

### dispose()

Cleans up resources (event listeners). Call when client is no longer needed.

```typescript
dispose(): void
```

---

## Event Methods

### on()

Subscribe to authentication events.

```typescript
on(event: AuthEventType | '*', listener: AuthEventListener): () => void
```

**Parameters**

| Parameter  | Type                   | Description                                       |
| ---------- | ---------------------- | ------------------------------------------------- |
| `event`    | `AuthEventType \| '*'` | Event type to listen for, or `'*'` for all events |
| `listener` | `AuthEventListener`    | Callback function                                 |

**Returns**

- `() => void` - Unsubscribe function

**Event Types**

- `'oauth:started'` - Social login initiated
- `'oauth:callback'` - OAuth callback detected
- `'oauth:completed'` - OAuth flow completed
- `'oauth:error'` - OAuth error
- `'auth:success'` - User authenticated
- `'auth:challenge'` - Challenge required
- `'auth:error'` - Authentication error
- `'auth:logout'` - User logged out

**Example**

```typescript
// Listen to specific event
const unsubscribe = client.on('auth:success', (event) => {
  console.log('User logged in:', event.data.user);
});

// Listen to all events
client.on('*', (event) => {
  console.log('Auth event:', event.type);
});

// Unsubscribe
unsubscribe();
```

**See**

- [Authentication Events Guide](../guides/authentication-events) - Complete event documentation
- [Event-Driven Architecture](../guides/social-auth#event-driven-architecture) - OAuth-specific events
- [Angular AuthService Events](../angular/auth-service#observables) - Angular Observable streams

---

### off()

Unsubscribe from authentication events.

```typescript
off(event: AuthEventType | '*', listener: AuthEventListener): void
```

**Parameters**

| Parameter  | Type                   | Description                 |
| ---------- | ---------------------- | --------------------------- |
| `event`    | `AuthEventType \| '*'` | Event type                  |
| `listener` | `AuthEventListener`    | Callback function to remove |

---

## Authentication Methods

### login()

Authenticate with identifier (email) and password.

```typescript
async login(identifier: string, password: string): Promise<AuthResponse>
```

**Returns**

- [`AuthResponse`](./types/auth-response) - Contains user/tokens or challenge

**Parameters**

| Parameter    | Type     | Description            |
| ------------ | -------- | ---------------------- |
| `identifier` | `string` | User email or username |
| `password`   | `string` | User password          |

**Returns**

- [`AuthResponse`](./types/auth-response) - Contains user/tokens or challenge

**Errors**

| Code                       | When                 | Details                     |
| -------------------------- | -------------------- | --------------------------- |
| `AUTH_INVALID_CREDENTIALS` | Wrong email/password | `undefined`                 |
| `AUTH_ACCOUNT_LOCKED`      | Too many attempts    | `{ lockoutUntil?: string }` |
| `AUTH_ACCOUNT_INACTIVE`    | Account deactivated  | `undefined`                 |

See [`NAuthClientError`](./nauth-client-error) for error handling.

**Example**

```typescript
const response = await client.login('user@example.com', 'password123');

if (response.challengeName) {
  // Handle challenge (MFA, email verification, etc.)
  console.log('Challenge:', response.challengeName, response.session);
} else {
  // Login successful
  console.log('User:', response.user);
}
```

---

### signup()

Register a new user account.

```typescript
async signup(payload: SignupRequest): Promise<AuthResponse>
```

**Returns**

- [`AuthResponse`](./types/auth-response) - Contains user/tokens or challenge

**Parameters**

- `payload` - [`SignupRequest`](./types/signup-request)

**Returns**

- [`AuthResponse`](./types/auth-response) - Contains user/tokens or challenge

**Errors**

| Code                   | When                               | Details                       |
| ---------------------- | ---------------------------------- | ----------------------------- |
| `SIGNUP_EMAIL_EXISTS`  | Email already registered           | `undefined`                   |
| `SIGNUP_WEAK_PASSWORD` | Password doesn't meet requirements | `{ requirements?: string[] }` |
| `VALIDATION_FAILED`    | Invalid input data                 | `{ field?: string }`          |

See [`NAuthClientError`](./nauth-client-error) for error handling.

**Example**

```typescript
const response = await client.signup({
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+14155551234',
});

if (response.challengeName === 'VERIFY_EMAIL') {
  // Redirect to email verification page
}
```

---

### logout()

End current session. Uses GET request to avoid CSRF token issues.

```typescript
async logout(forgetDevice?: boolean): Promise<void>
```

**Parameters**

| Parameter      | Type      | Description                                     |
| -------------- | --------- | ----------------------------------------------- |
| `forgetDevice` | `boolean` | If true, removes device trust. Default: `false` |

:::info Authentication Required
This method requires the user to be authenticated. The endpoint is protected and cannot be called publicly.
:::

**Example**

```typescript
// Normal logout (device remains trusted)
await client.logout();

// Logout and forget device (device untrusted, MFA required on next login)
await client.logout(true);
```

---

### logoutAll()

End all sessions for the current user across all devices.

```typescript
async logoutAll(forgetDevices?: boolean): Promise<{ revokedCount: number }>
```

**Parameters**

| Parameter       | Type      | Required | Description                                                                             |
| --------------- | --------- | -------- | --------------------------------------------------------------------------------------- |
| `forgetDevices` | `boolean` | No       | If `true`, also revokes all trusted devices. Default: `false` (devices remain trusted). |

**Returns**

| Property       | Type     | Description                |
| -------------- | -------- | -------------------------- |
| `revokedCount` | `number` | Number of sessions revoked |

:::warning Backend Configuration Required
This method requires the backend to have session management enabled. If this endpoint is not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`.
:::

:::info Authentication Required
This method requires the user to be authenticated. The endpoint is protected and cannot be called publicly.
:::

**Examples**

```typescript
// Revoke all sessions but keep devices trusted
const result = await client.logoutAll();
console.log(`Revoked ${result.revokedCount} sessions`);

// Revoke all sessions AND all trusted devices
const result2 = await client.logoutAll(true);
console.log(`Revoked ${result2.revokedCount} sessions and all trusted devices`);
```

---

### refreshTokens()

Manually refresh access and refresh tokens.

```typescript
async refreshTokens(): Promise<TokenResponse>
```

**Returns**

- [`TokenResponse`](./types/token-response) - New access and refresh tokens

**Errors**

| Code                 | When                          | Details     |
| -------------------- | ----------------------------- | ----------- |
| `AUTH_TOKEN_EXPIRED` | Refresh token expired         | `undefined` |
| `AUTH_TOKEN_INVALID` | Refresh token invalid/revoked | `undefined` |

See [`NAuthClientError`](./nauth-client-error) for error handling.

**Example**

```typescript
try {
  const tokens = await client.refreshTokens();
  console.log('New access token expires at:', tokens.accessTokenExpiresAt);
} catch (error) {
  // Token expired - redirect to login
}
```

---

## Challenge Methods

### respondToChallenge()

Complete any authentication challenge (email verification, MFA, etc.).

```typescript
async respondToChallenge(response: ChallengeResponse): Promise<AuthResponse>
```

**Parameters**

- `response` - [`ChallengeResponse`](./types/challenge-response)

**Returns**

- [`AuthResponse`](./types/auth-response) - Next challenge or authentication success

**SDK Validation**

The SDK performs client-side validation before sending requests:

- **TOTP Setup**: Validates that `setupData` contains both `secret` (from `getSetupData()`) and `code` (user-entered). Throws [`NAuthClientError`](./nauth-client-error) with `VALIDATION_FAILED` if either is missing.

**Errors**

| Code                | When                                  | Details                         |
| ------------------- | ------------------------------------- | ------------------------------- |
| `VALIDATION_FAILED` | TOTP setup missing `secret` or `code` | `{ field: 'secret' \| 'code' }` |

**Example**

```typescript
// Email verification
const result = await client.respondToChallenge({
  session: challengeSession,
  type: 'VERIFY_EMAIL',
  code: '123456',
});

// MFA verification
const result = await client.respondToChallenge({
  session: challengeSession,
  type: 'MFA_REQUIRED',
  method: 'totp',
  code: '123456',
});

// MFA setup (TOTP - requires both secret and code)
const setupData = await client.getSetupData(challengeSession, 'totp');
const result = await client.respondToChallenge({
  session: challengeSession,
  type: 'MFA_SETUP_REQUIRED',
  method: 'totp',
  setupData: {
    secret: setupData.setupData.secret, // Must include secret from getSetupData
    code: '123456', // User-entered verification code
  },
});

// MFA setup (SMS)
const result = await client.respondToChallenge({
  session: challengeSession,
  type: 'MFA_SETUP_REQUIRED',
  method: 'sms',
  setupData: { code: '123456' },
});
```

---

### resendCode()

Resend verification code for current challenge.

```typescript
async resendCode(session: string): Promise<{ destination: string }>
```

**Parameters**

| Parameter | Type     | Description             |
| --------- | -------- | ----------------------- |
| `session` | `string` | Challenge session token |

**Returns**

| Property      | Type     | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| `destination` | `string` | Masked destination (e.g., `***@example.com`) |

**Errors**

| Code           | When                     | Details                   |
| -------------- | ------------------------ | ------------------------- |
| `RATE_LIMITED` | Too many resend attempts | `{ retryAfter?: number }` |

---

### getSetupData()

Get MFA setup data during [`MFA_SETUP_REQUIRED`](./types/auth-challenge) challenge.

```typescript
async getSetupData(session: string, method: MFAMethod): Promise<GetSetupDataResponse>
```

**Parameters**

| Parameter | Type                              | Description             |
| --------- | --------------------------------- | ----------------------- |
| `session` | `string`                          | Challenge session token |
| `method`  | [`MFAMethod`](./types/mfa-method) | MFA method to set up    |

**Returns**

- [`GetSetupDataResponse`](./types/get-setup-data-response) - Method-specific setup data

**Setup Data by Method**

| Method    | Structure                                                 |
| --------- | --------------------------------------------------------- |
| `totp`    | `{ secret, qrCode, manualEntryKey, issuer, accountName }` |
| `sms`     | `{ maskedPhone }` or `{ deviceId, autoCompleted: true }`  |
| `email`   | `{ maskedEmail }` or `{ deviceId, autoCompleted: true }`  |
| `passkey` | WebAuthn registration options                             |

See [`GetSetupDataResponse`](./types/get-setup-data-response) for details.

---

### getChallengeData()

Get challenge data during [`MFA_REQUIRED`](./types/auth-challenge) challenge (e.g., passkey options).

```typescript
async getChallengeData(session: string, method: MFAChallengeMethod): Promise<GetChallengeDataResponse>
```

**Parameters**

| Parameter | Type                                       | Description             |
| --------- | ------------------------------------------ | ----------------------- |
| `session` | `string`                                   | Challenge session token |
| `method`  | [`MFAChallengeMethod`](./types/mfa-method) | MFA method              |

**Returns**

- [`GetChallengeDataResponse`](./types/get-challenge-data-response) - Challenge-specific data

See [`GetChallengeDataResponse`](./types/get-challenge-data-response) for details.

---

### getStoredChallenge()

Retrieve persisted challenge session from storage.

```typescript
async getStoredChallenge(): Promise<AuthResponse | null>
```

**Returns**

- [`AuthResponse`](./types/auth-response) or `null` if no challenge stored

See [`ChallengeResponse`](./types/challenge-response) for challenge types.

---

### clearStoredChallenge()

Clear persisted challenge session.

```typescript
async clearStoredChallenge(): Promise<void>
```

---

## State Methods

### isAuthenticated()

Check if user is authenticated (async, checks tokens).

```typescript
async isAuthenticated(): Promise<boolean>
```

---

### isAuthenticatedSync()

Check if user is authenticated (sync, checks cached state). Use for guards and templates.

```typescript
isAuthenticatedSync(): boolean
```

---

### getCurrentUser()

Get current user from cache.

```typescript
getCurrentUser(): AuthUser | null
```

**Returns**

- [`AuthUser`](./types/auth-user) or `null` if not authenticated

See [`AuthUser`](./types/auth-user) for user properties.

---

### getAccessToken()

Get current access token.

```typescript
async getAccessToken(): Promise<string | null>
```

---

## Profile Methods

### getProfile()

Fetch current user profile from server.

```typescript
async getProfile(): Promise<AuthUser>
```

**Returns**

- [`AuthUser`](./types/auth-user)

---

### updateProfile()

Update user profile.

```typescript
async updateProfile(updates: UpdateProfileRequest): Promise<AuthUser>
```

**Parameters**

- `updates` - [`UpdateProfileRequest`](./types/update-profile-request)

**Returns**

- [`AuthUser`](./types/auth-user)

---

### changePassword()

Change user password (requires current password).

```typescript
async changePassword(oldPassword: string, newPassword: string): Promise<void>
```

**Parameters**

| Parameter     | Type     | Description                           |
| ------------- | -------- | ------------------------------------- |
| `oldPassword` | `string` | Current password                      |
| `newPassword` | `string` | New password (must meet requirements) |

See [`ChangePasswordRequest`](./types/change-password-request) for request structure.

**Errors**

| Code                          | When                       | Details                |
| ----------------------------- | -------------------------- | ---------------------- |
| `PASSWORD_INCORRECT`          | Wrong current password     | `undefined`            |
| `WEAK_PASSWORD`               | Policy violation           | `{ errors?: string[] }` |
| `PASSWORD_REUSED`             | Password recently used     | `undefined`            |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Social-only account        | `undefined`            |

**Example**

```typescript
await client.changePassword('oldPassword123', 'newSecurePassword456!');
```

---

### confirmForgotPassword()

Confirm a password reset code and set a new password.

```typescript
async confirmForgotPassword(identifier: string, code: string, newPassword: string): Promise<ConfirmForgotPasswordResponse>
```

**Parameters**

| Parameter     | Type     | Description              |
| ------------- | -------- | ------------------------ |
| `identifier`  | `string` | Email, username, or phone |
| `code`        | `string` | One-time reset code      |
| `newPassword` | `string` | New password             |

**Returns**

- [`ConfirmForgotPasswordResponse`](./types/confirm-forgot-password-response)

See [`ConfirmForgotPasswordRequest`](./types/confirm-forgot-password-request) for request structure.

**Errors**

| Code                        | When                    | Details                |
| --------------------------- | ----------------------- | ---------------------- |
| `PASSWORD_RESET_CODE_INVALID` | Code invalid           | `undefined`            |
| `PASSWORD_RESET_CODE_EXPIRED` | Code expired           | `undefined`            |
| `PASSWORD_RESET_MAX_ATTEMPTS` | Too many attempts      | `undefined`            |
| `WEAK_PASSWORD`            | Policy violation        | `{ errors?: string[] }` |
| `PASSWORD_REUSED`          | Password recently used  | `undefined`            |

**Example**

```typescript
await client.confirmForgotPassword('user@example.com', '123456', 'NewSecurePass123!');
```

---

### forgotPassword()

Request a password reset code (account recovery).

```typescript
async forgotPassword(identifier: string): Promise<ForgotPasswordResponse>
```

**Parameters**

| Parameter    | Type     | Description              |
| ------------ | -------- | ------------------------ |
| `identifier` | `string` | Email, username, or phone |

**Returns**

- [`ForgotPasswordResponse`](./types/forgot-password-response)

See [`ForgotPasswordRequest`](./types/forgot-password-request) for request structure.

**Errors**

| Code                      | When              | Details                                   |
| ------------------------- | ----------------- | ----------------------------------------- |
| `RATE_LIMIT_PASSWORD_RESET` | Too many requests | `{ retryAfter?: number, maxAttempts?: number }` |

**Example**

```typescript
await client.forgotPassword('user@example.com');
```

---

### requestPasswordChange()

Request password change (forces user to change password on next login).

```typescript
async requestPasswordChange(): Promise<void>
```

:::warning Backend Configuration Required
This method requires the backend to have password change request functionality enabled. If this endpoint is not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`.
:::

**Example**

```typescript
await client.requestPasswordChange();
// User will be required to change password on next login
```

---

## MFA Methods

:::warning Backend Configuration Required
MFA methods require the backend to have MFA enabled. If MFA endpoints are not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`.

Ensure your backend has:

- MFA feature enabled in `nauth.config.ts`
- MFA endpoints available
- MFA methods configured (TOTP, SMS, Email, Passkey)

See [Backend MFA Configuration](/docs/features/mfa) for setup details.
:::

### getMfaStatus()

Get user's MFA status.

```typescript
async getMfaStatus(): Promise<MFAStatus>
```

**Returns**

- [`MFAStatus`](./types/mfa-status) - User's MFA configuration and status

See [`MFAStatus`](./types/mfa-status) for all properties.

---

### getMfaDevices()

Get user's registered MFA devices.

```typescript
async getMfaDevices(): Promise<unknown[]>
```

**Returns**

- [`MFADevice[]`](./types/mfa-device) - Array of MFA device objects

**Example**

```typescript
const devices = await client.getMfaDevices();
devices.forEach((device) => {
  console.log('Device:', device.type, device.name);
});
```

---

### setupMfaDevice()

Initiate MFA device setup for authenticated users (outside challenge flow).

```typescript
async setupMfaDevice(method: string): Promise<unknown>
```

**Parameters**

| Parameter | Type                              | Description                                            |
| --------- | --------------------------------- | ------------------------------------------------------ |
| `method`  | [`MFAMethod`](./types/mfa-method) | MFA method (`'totp'`, `'sms'`, `'email'`, `'passkey'`) |

**Returns**

- `unknown` - Method-specific setup data

**Example**

```typescript
const setupData = await client.setupMfaDevice('totp');
console.log('QR Code:', setupData.qrCode);
```

---

### verifyMfaSetup()

Complete MFA device setup by verifying the setup code/data.

```typescript
async verifyMfaSetup(
  method: string,
  setupData: Record<string, unknown>,
  deviceName?: string
): Promise<{ deviceId: number }>
```

**Parameters**

| Parameter    | Type                              | Description                                                   |
| ------------ | --------------------------------- | ------------------------------------------------------------- |
| `method`     | [`MFAMethod`](./types/mfa-method) | MFA method being set up                                       |
| `setupData`  | `Record<string, unknown>`         | Method-specific verification data (e.g., TOTP code, SMS code) |
| `deviceName` | `string`                          | Optional device name for identification                       |

**Returns**

- `{ deviceId: number }` - ID of the newly created MFA device

**Example**

```typescript
// After getting setup data
const setupData = await client.setupMfaDevice('totp');

// User enters code from authenticator app
const { deviceId } = await client.verifyMfaSetup(
  'totp',
  {
    code: '123456',
  },
  'My Phone',
);
```

---

### removeMfaDevice()

Remove an MFA device for the authenticated user.

```typescript
async removeMfaDevice(method: string): Promise<{ message: string }>
```

**Parameters**

| Parameter | Type                              | Description                                                      |
| --------- | --------------------------------- | ---------------------------------------------------------------- |
| `method`  | [`MFAMethod`](./types/mfa-method) | MFA method to remove (`'totp'`, `'sms'`, `'email'`, `'passkey'`) |

**Returns**

- `{ message: string }` - Success message

**Example**

```typescript
await client.removeMfaDevice('sms');
```

---

### setPreferredMfaMethod()

Set user's preferred MFA method (used when multiple methods are available).

```typescript
async setPreferredMfaMethod(method: 'totp' | 'sms' | 'email' | 'passkey'): Promise<{ message: string }>
```

**Parameters**

| Parameter | Type                                    | Description                                                                             |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `method`  | [`MFADeviceMethod`](./types/mfa-method) | Preferred MFA method (`'totp'`, `'sms'`, `'email'`, `'passkey'`). Cannot be `'backup'`. |

**Returns**

- `{ message: string }` - Success message

**Example**

```typescript
await client.setPreferredMfaMethod('totp');
```

---

### generateBackupCodes()

Generate new backup codes for MFA recovery.

```typescript
async generateBackupCodes(): Promise<string[]>
```

**Returns**

- `string[]` - Array of backup codes (store securely). See [`BackupCodesResponse`](./types/backup-codes-response) for response structure.

**Example**

```typescript
const codes = await client.generateBackupCodes();
console.log('Backup codes:', codes); // ['ABC123', 'DEF456', ...]
// Store these securely - they won't be shown again
```

---

### setMfaExemption()

Set MFA exemption for user (admin/test scenarios).

```typescript
async setMfaExemption(exempt: boolean, reason?: string): Promise<void>
```

**Parameters**

| Parameter | Type      | Description                                  |
| --------- | --------- | -------------------------------------------- |
| `exempt`  | `boolean` | Whether to exempt user from MFA requirements |
| `reason`  | `string`  | Optional reason for exemption (for audit)    |

:::warning Backend Configuration Required
This method requires the backend to have MFA exemption functionality enabled. If this endpoint is not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`. This is typically an admin-only feature.
:::

**Example**

```typescript
await client.setMfaExemption(true, 'Test account');
```

---

## Social Auth Methods

:::warning Backend Configuration Required
Social authentication methods require the backend to have social auth providers configured (Google, Apple, Facebook). If these endpoints are not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`.

Ensure your backend has:

- Social auth providers configured in `nauth.config.ts`
- Social auth endpoints enabled
- OAuth credentials set up

See [Backend Social Login Configuration](/docs/features/social-login) for setup details.
:::

### loginWithSocial()

Start social OAuth login flow with automatic state management.

```typescript
async loginWithSocial(provider: 'google' | 'apple' | 'facebook', options?: { redirectUri?: string }): Promise<void>
```

**Parameters**

| Parameter             | Type                                | Description                  |
| --------------------- | ----------------------------------- | ---------------------------- |
| `provider`            | `'google' \| 'apple' \| 'facebook'` | OAuth provider               |
| `options.redirectUri` | `string`                            | Optional custom redirect URI |

**Returns**

- `Promise<void>` - Redirects to OAuth provider

**Example**

```typescript
await client.loginWithSocial('google');
```

**See**

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth)

---

### handleOAuthCallback()

Auto-detect and handle OAuth callback.

```typescript
async handleOAuthCallback(urlOrParams?: string | URLSearchParams): Promise<AuthResponse | null>
```

**Parameters**

| Parameter     | Type                        | Description                                           |
| ------------- | --------------------------- | ----------------------------------------------------- |
| `urlOrParams` | `string \| URLSearchParams` | Optional URL or params (auto-detects if not provided) |

**Returns**

- `Promise<AuthResponse \| null>` - AuthResponse if OAuth callback, null otherwise

**Example**

```typescript
const response = await client.handleOAuthCallback();
if (response?.challengeName) {
  // Handle challenge
}
```

**See**

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth)

---

### getSocialAuthUrl()

Get OAuth redirect URL (low-level API). For most cases, use [`loginWithSocial()`](#loginwithsocial).

```typescript
async getSocialAuthUrl(request: { provider: string; state?: string }): Promise<{ url: string }>
```

**Parameters**

| Parameter          | Type     | Description          |
| ------------------ | -------- | -------------------- |
| `request.provider` | `string` | OAuth provider       |
| `request.state`    | `string` | Optional state token |

**Returns**

- `{ url: string }` - OAuth authorization URL

**Example**

```typescript
const { url } = await client.getSocialAuthUrl({
  provider: 'google',
  state: 'custom-state',
});
```

---

### handleSocialCallback()

Handle OAuth callback (low-level API). For most cases, use [`handleOAuthCallback()`](#handleoauthcallback).

```typescript
async handleSocialCallback(request: { provider: string; code: string; state: string }): Promise<AuthResponse>
```

**Parameters**

| Parameter          | Type     | Description        |
| ------------------ | -------- | ------------------ |
| `request.provider` | `string` | OAuth provider     |
| `request.code`     | `string` | Authorization code |
| `request.state`    | `string` | State token        |

**Returns**

- [`AuthResponse`](./types/auth-response)

**Example**

```typescript
const response = await client.handleSocialCallback({
  provider: 'google',
  code: 'auth-code',
  state: 'state-token',
});
```

---

### verifyNativeSocial()

Verify native social token from mobile apps (Capacitor, React Native).

```typescript
async verifyNativeSocial(request: SocialVerifyRequest): Promise<AuthResponse>
```

**Parameters**

- `request` - [`SocialVerifyRequest`](./types/social-verify-request) - Native token data

**Returns**

- [`AuthResponse`](./types/auth-response) - Authentication result or challenge

**Example**

```typescript
// After native OAuth (e.g., Google Sign-In plugin)
const result = await client.verifyNativeSocial({
  provider: 'google',
  idToken: nativeIdToken,
  accessToken: nativeAccessToken,
});

if (result.challengeName) {
  // Handle challenge
} else {
  // Login successful
}
```

See [Social Authentication Guide](../guides/social-auth) for native flow details.

---

### getLinkedAccounts()

Get user's linked social accounts.

```typescript
async getLinkedAccounts(): Promise<LinkedAccountsResponse>
```

**Returns**

- [`LinkedAccountsResponse`](./types/linked-accounts-response) - List of linked social accounts

**Example**

```typescript
const accounts = await client.getLinkedAccounts();
console.log('Linked providers:', accounts.providers); // ['google', 'apple']
```

---

### linkSocialAccount()

Link a social account to existing authenticated user.

```typescript
async linkSocialAccount(
  provider: string,
  code: string,
  state: string
): Promise<{ message: string }>
```

**Parameters**

| Parameter  | Type             | Description                                           |
| ---------- | ---------------- | ----------------------------------------------------- |
| `provider` | `SocialProvider` | Social provider (`'google'`, `'apple'`, `'facebook'`) |
| `code`     | `string`         | OAuth authorization code from callback                |
| `state`    | `string`         | OAuth state parameter from callback                   |

See [`SocialCallbackRequest`](./types/social-callback-request) for request structure.

**Returns**

- `{ message: string }` - Success message

**Example**

```typescript
// After OAuth callback
const params = new URLSearchParams(window.location.search);
await client.linkSocialAccount('google', params.get('code')!, params.get('state')!);
```

---

### unlinkSocialAccount()

Unlink a social account from the authenticated user.

```typescript
async unlinkSocialAccount(provider: string): Promise<{ message: string }>
```

**Parameters**

| Parameter  | Type             | Description                                                     |
| ---------- | ---------------- | --------------------------------------------------------------- |
| `provider` | `SocialProvider` | Social provider to unlink (`'google'`, `'apple'`, `'facebook'`) |

**Returns**

- `{ message: string }` - Success message

**Example**

```typescript
await client.unlinkSocialAccount('google');
```

---

## Device Trust Methods

:::warning Backend Configuration Required
Device trust methods require the backend to have device trust enabled. If this endpoint is not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`.

Ensure your backend has:

- Device trust feature enabled in `nauth.config.ts`
- Device trust endpoints available

See [Backend Configuration](/docs/concepts/configuration) for setup details.
:::

### trustDevice()

Mark current device as trusted (skips MFA for future logins on this device).

```typescript
async trustDevice(): Promise<{ deviceToken: string }>
```

**Returns**

- `{ deviceToken: string }` - Device trust token (stored automatically)

**Example**

```typescript
const { deviceToken } = await client.trustDevice();
console.log('Device trusted:', deviceToken);
```

---

### isTrustedDevice()

Check if the current device is trusted.

Performs server-side validation of the device token and checks:

- Device token exists and is valid
- Device token matches a trusted device record in the database
- Trust has not expired

Works in both **cookies mode** (reads from httpOnly cookie) and **JSON mode** (reads from X-Device-Token header).

```typescript
async isTrustedDevice(): Promise<{ trusted: boolean }>
```

**Returns**

- `{ trusted: boolean }` - Whether the current device is trusted

**Example**

```typescript
const result = await client.isTrustedDevice();

if (result.trusted) {
  console.log('This device is trusted');
} else {
  console.log('This device is not trusted');
}
```

**Related:**

- [trustDevice()](#trustdevice) - Mark device as trusted
- [Trusted Devices Guide](../guides/mfa-setup#trusted-devices) - Complete guide

---

## Audit Methods

:::warning Backend Configuration Required
Audit history methods require the backend to have audit logging enabled. If this endpoint is not implemented, you will receive a [`NAuthClientError`](./nauth-client-error) with status code `404` or `501`.

Ensure your backend has:

- Audit logging feature enabled in `nauth.config.ts`
- Audit history endpoints available
- Audit database tables created

See [Backend Configuration](/docs/concepts/configuration) for setup details.
:::

### getAuditHistory()

Get user's authentication audit history with filtering and pagination.

```typescript
async getAuditHistory(params?: Record<string, string | number | boolean>): Promise<AuditHistoryResponse>
```

**Parameters**

| Parameter     | Type                                                      | Description                  |
| ------------- | --------------------------------------------------------- | ---------------------------- |
| `page`        | `number`                                                  | Page number (default: 1)     |
| `limit`       | `number`                                                  | Items per page (default: 20) |
| `eventType`   | [`AuthAuditEventType`](./types/auth-audit-event-type)     | Filter by event type         |
| `eventStatus` | [`AuthAuditEventStatus`](./types/auth-audit-event-status) | Filter by status             |

**Returns**

- [`AuditHistoryResponse`](./types/audit-history-response) - Paginated audit events

**Example**

```typescript
// Get all login events
const logins = await client.getAuditHistory({
  eventType: 'LOGIN_SUCCESS',
  page: 1,
  limit: 50,
});

// Get suspicious activity
const suspicious = await client.getAuditHistory({
  eventStatus: 'SUSPICIOUS',
  page: 1,
  limit: 100,
});

console.log(`Found ${suspicious.total} suspicious events`);
```

See [`AuditHistoryResponse`](./types/audit-history-response) and [`AuthAuditEvent`](./types/auth-audit-event) for details.

---

## Related APIs

- [NAuthClientConfig](./nauth-client-config) - Configuration options
- [NAuthClientError](./nauth-client-error) - Error handling
- [AuthResponse](./types/auth-response) - Authentication response type
- [ChallengeResponse](./types/challenge-response) - Challenge response union
- [AuthUser](./types/auth-user) - User profile type
- [MFAStatus](./types/mfa-status) - MFA configuration
- [Angular AuthService](../angular/auth-service) - Angular wrapper with Observables
- [Angular Interceptor](../angular/interceptor) - HTTP interceptor for token management
