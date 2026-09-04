---
title: NAuthClient
description: Core client class for nauth-toolkit frontend SDK
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

## Methods

:::warning Backend Configuration Required
Some methods require additional backend features to be enabled:

- **MFA methods** (`generateBackupCodes`, `getMfaDevices`, `getMfaStatus`, `removeMfaDeviceById`, `setPreferredMfaDevice`, `setupMfaDevice`, `verifyMfaSetup`): require MFA enabled in `nauth.config.ts`. See [Backend MFA Configuration](/docs/guides/mfa/how-mfa-works).
- **Social auth methods** (`exchangeSocialRedirect`, `getLastOauthState`, `getLinkedAccounts`, `linkSocialAccount`, `loginWithSocial`, `unlinkSocialAccount`, `verifyNativeSocial`): require social auth providers configured. See [Backend Social Login Configuration](/docs/guides/social/how-social-login-works).
- **Device trust methods** (`isTrustedDevice`, `trustDevice`): require device trust feature enabled. See [Backend Configuration](/docs/concepts/configuration).
- **Audit methods** (`getAuditHistory`): require audit logging enabled. See [Backend Configuration](/docs/concepts/configuration).
:::

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

| Code                          | When                   | Details                 |
| ----------------------------- | ---------------------- | ----------------------- |
| `PASSWORD_INCORRECT`          | Wrong current password | `undefined`             |
| `WEAK_PASSWORD`               | Policy violation       | `{ errors?: string[] }` |
| `PASSWORD_REUSED`             | Password recently used | `undefined`             |
| `PASSWORD_CHANGE_NOT_ALLOWED` | Social-only account    | `undefined`             |

**Example**

```typescript
await client.changePassword('oldPassword123', 'newSecurePassword456!');
```

---

### clearStoredChallenge()

Clear persisted challenge session.

```typescript
async clearStoredChallenge(): Promise<void>
```

---

### confirmForgotPassword()

Confirm a password reset code and set a new password.

```typescript
async confirmForgotPassword(identifier: string, code: string, newPassword: string): Promise<ConfirmForgotPasswordResponse>
```

**Parameters**

| Parameter     | Type     | Description               |
| ------------- | -------- | ------------------------- |
| `identifier`  | `string` | Email, username, or phone |
| `code`        | `string` | One-time reset code       |
| `newPassword` | `string` | New password              |

**Returns**

- [`ConfirmForgotPasswordResponse`](./types/confirm-forgot-password-response)

See [`ConfirmForgotPasswordRequest`](./types/confirm-forgot-password-request) for request structure.

**Errors**

| Code                          | When                   | Details                 |
| ----------------------------- | ---------------------- | ----------------------- |
| `PASSWORD_RESET_CODE_INVALID` | Code invalid           | `undefined`             |
| `PASSWORD_RESET_CODE_EXPIRED` | Code expired           | `undefined`             |
| `PASSWORD_RESET_MAX_ATTEMPTS` | Too many attempts      | `undefined`             |
| `WEAK_PASSWORD`               | Policy violation       | `{ errors?: string[] }` |
| `PASSWORD_REUSED`             | Password recently used | `undefined`             |

**Example**

```typescript
await client.confirmForgotPassword('user@example.com', '123456', 'NewSecurePass123!');
```

---

### dispose()

Cleans up resources (event listeners). Call when client is no longer needed.

```typescript
dispose(): void
```

---

### exchangeSocialRedirect()

Exchange an `exchangeToken` (returned in the frontend callback URL) into an `AuthResponse`.

```typescript
async exchangeSocialRedirect(exchangeToken: string): Promise<AuthResponse>
```

**Parameters**

| Parameter       | Type     | Description                                    |
| --------------- | -------- | ---------------------------------------------- |
| `exchangeToken` | `string` | One-time token issued by backend redirect flow |

**Returns**

- [`AuthResponse`](./types/auth-response) - Authentication result (tokens or challenge)

**Example**

```typescript
const params = new URLSearchParams(window.location.search);
const exchangeToken = params.get('exchangeToken');
if (exchangeToken) {
  const response = await client.exchangeSocialRedirect(exchangeToken);
  // Redirect based on response.challengeName or success
}
```

**Errors**

| Code | When |
|------|------|
| `CHALLENGE_INVALID` | `exchangeToken` is missing or invalid |

**See**

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth)

---

### forgotPassword()

Request a password reset code (account recovery).

```typescript
async forgotPassword(identifier: string): Promise<ForgotPasswordResponse>
```

**Parameters**

| Parameter    | Type     | Description               |
| ------------ | -------- | ------------------------- |
| `identifier` | `string` | Email, username, or phone |

**Returns**

- [`ForgotPasswordResponse`](./types/forgot-password-response)

See [`ForgotPasswordRequest`](./types/forgot-password-request) for request structure.

**Errors**

| Code                        | When              | Details                                         |
| --------------------------- | ----------------- | ----------------------------------------------- |
| `RATE_LIMIT_PASSWORD_RESET` | Too many requests | `{ retryAfter?: number, maxAttempts?: number }` |

**Example**

```typescript
await client.forgotPassword('user@example.com');
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

### getAccessToken()

Get current access token.

```typescript
async getAccessToken(): Promise<string | null>
```

---

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

### getCurrentUser()

Get current user from cache.

```typescript
getCurrentUser(): AuthUser | null
```

**Returns**

- [`AuthUser`](./types/auth-user) or `null` if not authenticated

See [`AuthUser`](./types/auth-user) for user properties.

---

### getLastOauthState()

Get the last OAuth appState from social redirect callback.

Returns the appState that was stored during the most recent social login redirect callback. This is useful for restoring UI state, applying invite codes, or tracking referral information.

The state is automatically stored when the callback guard processes the redirect URL, and is automatically cleared after retrieval to prevent reuse.

```typescript
async getLastOauthState(): Promise<string | null>
```

**Returns**

- `Promise<string | null>` - The stored appState, or null if none exists

**Example**

```typescript
// After social login redirect completes
const appState = await client.getLastOauthState();
if (appState) {
  // Apply invite code or restore UI state
  console.log('OAuth state:', appState);
  // Example: applyInviteCode(appState);
}
```

**Note**

- The appState is also passed as a query parameter to the success route (e.g., `/dashboard?appState=invite-code-123`)
- You can read it from the URL query parameters instead if preferred
- The state is cleared after retrieval, so call this method only once per OAuth flow

**See**

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth)
- [Social Login](/docs/guides/social/how-social-login-works)

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

### getMfaDevices()

Get user's registered MFA devices.

```typescript
async getMfaDevices(): Promise<GetMFADevicesResponse>
```

**Returns**

- [`GetMFADevicesResponse`](./types/mfa-device) - `{ devices: MFADevice[] }`

**Example**

```typescript
const result = await client.getMfaDevices();
result.devices.forEach((device) => {
  console.log('Device:', device.type, device.name);
});
```

---

### getMfaStatus()

Get user's MFA status.

```typescript
async getMfaStatus(): Promise<MFAStatus>
```

**Returns**

- [`MFAStatus`](./types/mfa-status) - User's MFA configuration and status

See [`MFAStatus`](./types/mfa-status) for all properties.

---

### getProfile()

Fetch current user profile from server.

```typescript
async getProfile(): Promise<AuthUser>
```

**Returns**

- [`AuthUser`](./types/auth-user)

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

### getStoredChallenge()

Retrieve persisted challenge session from storage.

```typescript
async getStoredChallenge(): Promise<AuthResponse | null>
```

**Returns**

- [`AuthResponse`](./types/auth-response) or `null` if no challenge stored

See [`ChallengeResponse`](./types/challenge-response) for challenge types.

---

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

**Returns**

- `{ message: string }` - Success message

**Example**

```typescript
// After OAuth callback
const params = new URLSearchParams(window.location.search);
await client.linkSocialAccount('google', params.get('code')!, params.get('state')!);
```

---

### login()

Authenticate with identifier (email) and password.

```typescript
async login(identifier: string, password: string, recaptchaToken?: string): Promise<AuthResponse>
```

**Parameters**

| Parameter        | Type     | Description                                           |
| ---------------- | -------- | ----------------------------------------------------- |
| `identifier`     | `string` | User email or username                                |
| `password`       | `string` | User password                                         |
| `recaptchaToken` | `string` | Optional reCAPTCHA token (v2 manual mode or explicit) |

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

### loginWithSocial()

Start redirect-first web social login.

```typescript
async loginWithSocial(provider: 'google' | 'apple' | 'facebook', options?: SocialLoginOptions): Promise<void>
```

**Parameters**

| Parameter  | Type                                                 | Description                                                                     |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `provider` | `'google' \| 'apple' \| 'facebook'`                  | OAuth provider                                                                  |
| `options`  | [`SocialLoginOptions`](./types/social-login-options) | Redirect options (`returnTo`, `appState`, `action`, `oauthParams`) |

**Returns**

- `Promise<void>` - Redirects to OAuth provider

**Examples**

```typescript
// Basic usage
await client.loginWithSocial('google', {
  returnTo: '/auth/callback',
  appState: '12345'
});

// Force Google account chooser
await client.loginWithSocial('google', {
  returnTo: '/dashboard',
  oauthParams: { prompt: 'select_account' }
});

// Multiple OAuth parameters
await client.loginWithSocial('google', {
  returnTo: '/dashboard',
  oauthParams: {
    prompt: 'select_account consent',
    hd: 'company.com',
    login_hint: 'user@company.com'
  }
});

// Facebook: Rerequest declined permissions
await client.loginWithSocial('facebook', {
  returnTo: '/settings',
  oauthParams: { auth_type: 'rerequest' }
});

// Apple with nonce for ID token validation
await client.loginWithSocial('apple', {
  returnTo: '/dashboard',
  oauthParams: { nonce: 'random-nonce-value' }
});
```

**OAuth Parameters**

The `oauthParams` option allows per-request customization of the OAuth flow. These parameters:
- Override any defaults set in the backend configuration
- Are appended directly to the provider's authorization URL
- Enable provider-specific behaviors

Common use cases:
- **Google**: Force account chooser, restrict to domain, pre-fill email
- **Facebook**: Rerequest declined permissions, customize display mode
- **Apple**: Add nonce for ID token validation

See [`SocialLoginOptions`](./types/social-login-options) for complete parameter documentation.

**See**

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth)

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

- `'auth:login'` - Login initiated
- `'auth:signup'` - Signup initiated
- `'auth:success'` - User authenticated
- `'auth:challenge'` - Challenge required
- `'auth:error'` - Authentication error
- `'auth:logout'` - User logged out
- `'auth:refresh'` - Token refresh attempted
- `'auth:session_expired'` - Refresh token expired; user must re-authenticate
- `'oauth:started'` - Social login initiated
- `'oauth:callback'` - OAuth callback detected
- `'oauth:completed'` - OAuth flow completed
- `'oauth:error'` - OAuth error

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
- [Authentication Events](../guides/authentication-events) - OAuth-specific events
- [Angular AuthService Events](../angular/auth-service#observables) - Angular Observable streams

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

### removeMfaDeviceById()

Remove a single MFA device by its unique device ID.

Use this method to give users granular control over which specific device to remove.

```typescript
async removeMfaDeviceById(deviceId: number): Promise<RemoveMFADeviceResponse>
```

**Parameters**

| Parameter  | Type     | Description                                               |
| ---------- | -------- | --------------------------------------------------------- |
| `deviceId` | `number` | MFA device ID (from `getMfaDevices()` or challenge data) |

**Returns**

- [`RemoveMFADeviceResponse`](./types/remove-mfa-device-response) - Removal result with device details

**Example**

```typescript
// Get user's devices
const devices = await client.getMfaDevices();
// [{ id: 48, name: "Google Authenticator", type: "totp", isPreferred: true },
//  { id: 52, name: "Microsoft Authenticator", type: "totp", isPreferred: false }]

// Remove specific device by ID
const result = await client.removeMfaDeviceById(52);
console.log(result.removedDeviceId);  // 52
console.log(result.removedMethod);    // 'totp'
console.log(result.mfaDisabled);      // false (still has device 48)
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

### resetPasswordWithCode()

Reset password with verification code (generic method for both admin-initiated and user-initiated resets).

```typescript
async resetPasswordWithCode(
  identifier: string,
  code: string,
  newPassword: string
): Promise<ResetPasswordWithCodeResponse>
```

**Parameters**

| Parameter     | Type     | Description                              |
| ------------- | -------- | ---------------------------------------- |
| `identifier`  | `string` | User identifier (email, username, phone) |
| `code`        | `string` | Verification code (6-10 digits)          |
| `newPassword` | `string` | New password (min 8 characters)          |

**Returns**

- [`ResetPasswordWithCodeResponse`](./types/reset-password-with-code-response) - `{ success: boolean }`

**Example**

```typescript
await client.resetPasswordWithCode('user@example.com', '123456', 'NewPass123!');
```

---

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

### setPreferredMfaDevice()

Set a specific MFA device as preferred.

This is important when users can register multiple devices for the same method (notably TOTP and passkeys),
so your UI can pick a deterministic default device during MFA challenges.

```typescript
async setPreferredMfaDevice(deviceId: number): Promise<{ message: string }>
```

**Parameters**

| Parameter  | Type     | Description    |
| ---------- | -------- | -------------- |
| `deviceId` | `number` | MFA device ID  |

**Returns**

- `{ message: string }` - Success message

**Example**

```typescript
// Get user's devices
const devices = await client.getMfaDevices();

// Set preferred device (e.g., user selects "Google Authenticator" from list)
await client.setPreferredMfaDevice(devices[0].id);
```

---

### setupMfaDevice()

Initiate MFA device setup for authenticated users (outside challenge flow).

```typescript
async setupMfaDevice(method: string): Promise<GetSetupDataResponse>
```

**Parameters**

| Parameter | Type                              | Description                                            |
| --------- | --------------------------------- | ------------------------------------------------------ |
| `method`  | [`MFAMethod`](./types/mfa-method) | MFA method (`'totp'`, `'sms'`, `'email'`, `'passkey'`) |

**Returns**

- [`GetSetupDataResponse`](./types/get-setup-data-response) - Method-specific setup data wrapped in `setupData` property

**Example**

```typescript
const setupData = await client.setupMfaDevice('totp');
console.log('QR Code:', setupData.setupData.qrCode);
console.log('Secret:', setupData.setupData.secret);
```

---

### signup()

Register a new user account.

```typescript
async signup(payload: SignupRequest): Promise<AuthResponse>
```

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
  metadata: {
    invitation_code: '83891D228', // for custom use cases
    referralCode: 'ABC123',
  },
});

if (response.challengeName === 'VERIFY_EMAIL') {
  // Redirect to email verification page
}
```

---

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

// User scans QR code and enters the code from their authenticator app
const { deviceId } = await client.verifyMfaSetup(
  'totp',
  {
    secret: setupData.setupData.secret, // Must include secret from setupMfaDevice()
    code: '123456', // User-entered code from authenticator app
  },
  'My Phone',
);
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

**Errors**

| Code | When |
|------|------|
| `SOCIAL_TOKEN_INVALID` | Native token verification failed |

See [Social Authentication Guide](../guides/social-auth) for native flow details.

---

## Admin Operations

### admin

Admin operations service for user and system management. Available when `admin` configuration is provided in [`NAuthClientConfig`](./nauth-client-config).

```typescript
public readonly admin?: AdminOperations
```

**Access**

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  admin: {
    pathPrefix: '/admin',
  },
});

// Access admin operations
if (client.admin) {
  const users = await client.admin.getUsers({ page: 1 });
  await client.admin.deleteUser('user-uuid');
}
```

**See [AdminOperations](./admin-operations) for complete API documentation.**

---

## OpenID Connect Interaction

### oidc

Drives the consent screen of an application that is itself an OpenID Connect provider. Always present; the routes it calls default to `{baseUrl}/oidc/interaction`.

```typescript
public readonly oidc: OIDCOperations
```

**Access**

```typescript
const state = await client.oidc.getInteraction(uid);

if (state.gate === 'login_required') {
  await client.oidc.setPendingInteraction(uid);
  router.navigate(['/login']);
} else {
  window.location.assign((await client.oidc.approve(uid)).redirectTo);
}
```

**See [OIDCOperations](./oidc-operations) for complete API documentation.**

---

## Related APIs

- [NAuthClientConfig](./nauth-client-config) - Configuration options
- [NAuthClientError](./nauth-client-error) - Error handling
- [AuthResponse](./types/auth-response) - Authentication response type
- [ChallengeResponse](./types/challenge-response) - Challenge response union
- [AuthUser](./types/auth-user) - User profile type
- [MFAStatus](./types/mfa-status) - MFA configuration
- [AdminOperations](./admin-operations) - Admin operations service
- [OIDCOperations](./oidc-operations) - OpenID Connect consent operations
- [Angular AuthService](../angular/auth-service) - Angular wrapper with Observables
- [Angular Interceptor](../angular/interceptor) - HTTP interceptor for token management
