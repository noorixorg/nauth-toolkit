---
title: AuthService
description: Angular service for authentication operations
sidebar_position: 2
keywords: [angular, service, authentication, promise, async, await]
image: /img/api-social-card.png
---

# AuthService

**Package:** `@nauth-toolkit/client-angular`
**Type:** Injectable Service

Angular wrapper around NAuthClient that provides promise-based authentication methods and maintains reactive state.

```typescript
import { AuthService } from '@nauth-toolkit/client-angular';
```

## Overview

AuthService wraps the core NAuthClient and provides:

- Reactive state via BehaviorSubjects (`currentUser$`, `isAuthenticated$`, `challenge$`)
- All NAuthClient methods returning Promises for clean async/await syntax
- Automatic state synchronization on auth state changes
- Direct access to underlying client when needed

:::note
AuthService is provided in root. No manual provider configuration needed.
:::

## Properties

### Observables

| Property           | Type                                                             | Description                           |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------- |
| `currentUser$`     | `Observable<[AuthUser](../api/types/auth-user) \| null>`         | Current authenticated user            |
| `isAuthenticated$` | `Observable<boolean>`                                            | Authentication state                  |
| `challenge$`       | `Observable<[AuthResponse](../api/types/auth-response) \| null>` | Current challenge (if any)            |
| `authEvents$`      | `Observable<[AuthEvent](../../api/types/auth-event)>`            | All authentication lifecycle events   |
| `authSuccess$`     | `Observable<[AuthEvent](../../api/types/auth-event)>`            | Successful authentication events only |
| `authError$`       | `Observable<[AuthEvent](../../api/types/auth-event)>`            | Authentication error events only      |

### Sync Accessors

| Method                  | Returns                                                | Description                               |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `isAuthenticated()`     | `boolean`                                              | Sync auth check (use in guards/templates) |
| `getCurrentUser()`      | [`AuthUser`](../api/types/auth-user) \| `null`         | Current user from cache                   |
| `getCurrentChallenge()` | [`AuthResponse`](../api/types/auth-response) \| `null` | Current challenge from cache              |

## Methods

### login()

Authenticate with email and password.

```typescript
async login(identifier: string, password: string): Promise<AuthResponse>
```

**Parameters**

| Parameter    | Type     | Description   |
| ------------ | -------- | ------------- |
| `identifier` | `string` | User email    |
| `password`   | `string` | User password |

**Returns**

- `Promise<[AuthResponse](../api/types/auth-response)>` - Auth result or challenge

**Example**

```typescript
async handleLogin() {
  try {
    const response = await this.auth.login('user@example.com', 'password');

    if (response.challengeName) {
      // Handle challenge
      this.router.navigate(['/challenge', response.challengeName]);
    } else {
      // Login successful
      this.router.navigate(['/dashboard']);
    }
  } catch (err) {
    this.error = err.message;
  }
}
```

---

### signup()

Register a new user.

```typescript
async signup(payload: SignupRequest): Promise<AuthResponse>
```

**Returns**

- `Promise<[AuthResponse](../api/types/auth-response)>` - Auth result or challenge

**Parameters**

| Property    | Type     | Required | Description          |
| ----------- | -------- | -------- | -------------------- |
| `email`     | `string` | Yes      | User email           |
| `password`  | `string` | Yes      | Password             |
| `firstName` | `string` | No       | First name           |
| `lastName`  | `string` | No       | Last name            |
| `phone`     | `string` | No       | Phone (E.164 format) |

**Example**

```typescript
async handleSignup() {
  try {
    const response = await this.auth.signup({
      email: 'new@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+14155551234',
    });

    // Usually returns VERIFY_EMAIL challenge
    if (response.challengeName === 'VERIFY_EMAIL') {
      this.router.navigate(['/verify-email']);
    }
  } catch (err) {
    this.error = err.message;
  }
}
```

---

### logout()

End current session.

```typescript
async logout(forgetDevice?: boolean): Promise<void>
```

**Parameters**

| Parameter      | Type      | Description                           |
| -------------- | --------- | ------------------------------------- |
| `forgetDevice` | `boolean` | Remove device trust. Default: `false` |

**Example**

```typescript
await this.auth.logout();
// or
await this.auth.logout(true); // Forget device
```

---

### logoutAll()

End all sessions for current user across all devices.

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
const result = await this.auth.logoutAll();
console.log(`Revoked ${result.revokedCount} sessions`);

// Revoke all sessions AND all trusted devices
const result2 = await this.auth.logoutAll(true);
console.log(`Revoked ${result2.revokedCount} sessions and all trusted devices`);
```

---

### respondToChallenge()

Complete any authentication challenge.

```typescript
async respondToChallenge(response: ChallengeResponse): Promise<AuthResponse>
```

**Parameters**

- `response` - [`ChallengeResponse`](../api/types/challenge-response) - Challenge response (type depends on challenge)

**Returns**

- `Promise<[AuthResponse](../api/types/auth-response)>` - Next challenge or authentication success

**SDK Validation**

The SDK performs client-side validation before sending requests. For TOTP setup, it validates that both `secret` and `code` are present in `setupData`.

**Example - Email Verification**

```typescript
async verifyEmail(code: string) {
  try {
    const response = await this.auth.respondToChallenge({
      session: this.challengeSession,
      type: 'VERIFY_EMAIL',
      code,
    });

    if (response.challengeName) {
      // Next challenge
      this.handleChallenge(response);
    } else {
      // Complete
      this.router.navigate(['/dashboard']);
    }
  } catch (err) {
    this.error = err.message;
  }
}
```

**Example - TOTP Setup (requires both secret and code)**

```typescript
async setupTotp() {
  try {
    // Get setup data first
    const setupResponse = await this.auth.getSetupData(session, 'totp');
    const secret = setupResponse.setupData.secret;

    // Display QR code to user
    this.qrCode = setupResponse.setupData.qrCode;

    // When user enters verification code:
    const response = await this.auth.respondToChallenge({
      session,
      type: 'MFA_SETUP_REQUIRED',
      method: 'totp',
      setupData: {
        secret, // Required: from getSetupData
        code: this.userEnteredCode, // Required: from user's authenticator app
      },
    });

    if (response.challengeName) {
      // Progressive challenge (e.g., email verification next)
      this.router.navigate(['/challenge', response.challengeName]);
    } else {
      // Setup complete, user authenticated
      this.router.navigate(['/dashboard']);
    }
  } catch (err) {
    // SDK validation error if secret or code is missing
    if (err instanceof NAuthClientError && err.isCode(NAuthErrorCode.VALIDATION_FAILED)) {
      console.error('TOTP setup validation failed:', err.message);
    }
  }
}
```

---

### resendCode()

Resend verification code.

```typescript
async resendCode(session: string): Promise<{ destination: string }>
```

**Example**

```typescript
const result = await this.auth.resendCode(this.challengeSession);
console.log('Code sent to:', result.destination);
```

---

### getSetupData()

Get MFA setup data during MFA_SETUP_REQUIRED challenge.

```typescript
async getSetupData(session: string, method: string): Promise<GetSetupDataResponse>
```

**Returns**

- `Promise<[GetSetupDataResponse](../api/types/get-setup-data-response)>` - Method-specific setup data

**Example - TOTP Setup**

```typescript
async initTotpSetup() {
  // Get TOTP setup data (QR code, secret, manual entry key)
  const response = await this.auth.getSetupData(session, 'totp');
  const setupData = response.setupData;
  // setupData contains:
  // {
  //   secret: 'JBSWY3DPEHPK3PXP',
  //   qrCode: 'data:image/png;base64,...',
  //   manualEntryKey: 'JBSW Y3DP EHPK 3PXP',
  //   issuer: 'MyApp',
  //   accountName: 'user@example.com'
  // }

  // Display QR code
  this.qrCode = setupData.qrCode;
  this.manualKey = setupData.manualEntryKey;

  // Store secret for later use in respondToChallenge
  this.secret = setupData.secret;
}

// Later, when user enters verification code:
async completeTotpSetup(userCode: string) {
  try {
    const response = await this.auth.respondToChallenge({
      session,
      type: 'MFA_SETUP_REQUIRED',
      method: 'totp',
      setupData: {
        secret: this.secret, // Required: from getSetupData
        code: userCode, // Required: from user's authenticator app
      },
    });

    if (response.challengeName) {
      // Another challenge required
      this.router.navigate(['/challenge', response.challengeName]);
    } else {
      // Setup complete
      this.router.navigate(['/dashboard']);
    }
  } catch (err) {
    // Handle error (e.g., invalid code, missing secret)
    console.error('TOTP setup failed:', err);
  }
}
```

---

### getChallengeData()

Get challenge data for MFA verification.

```typescript
async getChallengeData(session: string, method: string): Promise<GetChallengeDataResponse>
```

**Example**

```typescript
const challengeData = await this.auth.getChallengeData(session, 'passkey');
```

---

### clearChallenge()

Clear stored challenge session.

```typescript
async clearChallenge(): Promise<void>
```

**Example**

```typescript
await this.auth.clearChallenge();
```

---

### getProfile()

Fetch current user profile from server.

```typescript
async getProfile(): Promise<AuthUser>
```

**Returns**

- `Promise<[AuthUser](../api/types/auth-user)>`

**Example**

```typescript
const user = await this.auth.getProfile();
console.log('User:', user);
```

---

### updateProfile()

Update user profile.

```typescript
async updateProfile(updates: UpdateProfileRequest): Promise<AuthUser>
```

**Parameters**

- `updates` - [`UpdateProfileRequest`](../api/types/update-profile-request)

**Returns**

- `Promise<[AuthUser](../api/types/auth-user)>`

**Example**

```typescript
const user = await this.auth.updateProfile({
  firstName: 'John',
  lastName: 'Doe',
});
console.log('Updated:', user);
```

---

### changePassword()

Change user password.

```typescript
async changePassword(oldPassword: string, newPassword: string): Promise<void>
```

**Example**

```typescript
await this.auth.changePassword('oldPass123', 'newPass456!');
```

---

### resetPasswordWithCode()

Reset password with verification code (generic method for both admin and user-initiated resets).

```typescript
async resetPasswordWithCode(
  identifier: string,
  code: string,
  newPassword: string
): Promise<ResetPasswordWithCodeResponse>
```

**Parameters**

| Parameter     | Type     | Description                                   |
| ------------- | -------- | --------------------------------------------- |
| `identifier`  | `string` | User identifier (email, username, phone)      |
| `code`        | `string` | Verification code (6-10 digits)               |
| `newPassword` | `string` | New password (min 8 characters)               |

**Returns**

- `Promise<[ResetPasswordWithCodeResponse](../api/types/reset-password-with-code-response)>`

**Example**

```typescript
// With code from email
await this.auth.resetPasswordWithCode('user@example.com', '123456', 'NewPass123!');
```

---

### getMfaStatus()

Get user's MFA status.

```typescript
async getMfaStatus(): Promise<MFAStatus>
```

**Returns**

- `Promise<[MFAStatus](../api/types/mfa-status)>`

**Example**

```typescript
const status = await this.auth.getMfaStatus();
console.log('MFA enabled:', status.enabled);
```

---

### loginWithSocial()

Start redirect-first web social login (performs browser navigation).

```typescript
async loginWithSocial(provider: SocialProvider, options?: SocialLoginOptions): Promise<void>
```

**Example**

```typescript
await this.auth.loginWithSocial('google', { returnTo: '/auth/callback', appState: '12345' });
```

---

### exchangeSocialRedirect()

Exchange `exchangeToken` (from callback URL) into an auth result.

```typescript
async exchangeSocialRedirect(exchangeToken: string): Promise<AuthResponse>
```

**Example**

```typescript
const response = await this.auth.exchangeSocialRedirect(exchangeToken);
if (response.challengeName) {
  // Handle challenge
} else {
  // Login successful
}
```

---

### verifyNativeSocial()

Verify native social token (mobile).

```typescript
async verifyNativeSocial(request: SocialVerifyRequest): Promise<AuthResponse>
```

**Example**

```typescript
const result = await this.auth.verifyNativeSocial({
  provider: 'google',
  idToken: nativeIdToken,
});
```

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
// After social login redirect completes (e.g., in dashboard component)
ngOnInit() {
  this.checkOauthState();
}

async checkOauthState() {
  const appState = await this.auth.getLastOauthState();
  if (appState) {
    // Apply invite code or restore UI state
    console.log('OAuth state:', appState);
    // Example: this.applyInviteCode(appState);
  }
}
```

**Note**

- The appState is also passed as a query parameter to the success route (e.g., `/dashboard?appState=invite-code-123`)
- You can read it from the URL query parameters using `ActivatedRoute` instead if preferred
- The state is cleared after retrieval, so call this method only once per OAuth flow

**See**

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth)
- [Social Login Feature](/docs/features/social-login)

---

### refresh()

Refresh tokens.

```typescript
async refresh(): Promise<TokenResponse>
```

**Example**

```typescript
const tokens = await this.auth.refresh();
```

---

### getClient()

Get underlying NAuthClient instance for advanced operations.

:::warning Deprecated
This method is deprecated. Use the direct promise-based methods on AuthService instead. The `getClient()` method is kept for backward compatibility only and may be removed in a future version.
:::

```typescript
getClient(): NAuthClient
```

**Example**

```typescript
// Deprecated - use direct methods instead
const client = this.auth.getClient();
await client.getProfile();

// Preferred - use direct methods
await this.auth.getProfile();
```

---

## Usage Patterns

### Reactive Authentication State

```typescript
@Component({
  template: `
    @if (auth.isAuthenticated$ | async) {
      <app-navbar [user]="auth.currentUser$ | async" />
      <router-outlet />
    } @else {
      <app-login />
    }
  `,
})
export class AppComponent {
  constructor(public auth: AuthService) {}
}
```

### Challenge Flow Navigation

```typescript
@Component({
  /* ... */
})
export class ChallengeRouterComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.auth.challenge$.pipe(filter((c) => c !== null)).subscribe((challenge) => {
      switch (challenge.challengeName) {
        case 'VERIFY_EMAIL':
          this.router.navigate(['/verify-email']);
          break;
        case 'VERIFY_PHONE':
          this.router.navigate(['/verify-phone']);
          break;
        case 'MFA_REQUIRED':
          this.router.navigate(['/mfa']);
          break;
        case 'MFA_SETUP_REQUIRED':
          this.router.navigate(['/mfa-setup']);
          break;
        case 'FORCE_CHANGE_PASSWORD':
          this.router.navigate(['/change-password']);
          break;
      }
    });
  }
}
```

### Form with Error Handling (Async/Await)

```typescript
@Component({
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" placeholder="Email" />
      <input formControlName="password" type="password" />
      @if (error) {
        <div class="error">{{ error }}</div>
      }
      <button [disabled]="loading">
        {{ loading ? 'Loading...' : 'Login' }}
      </button>
    </form>
  `,
})
export class LoginComponent {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {}

  async submit() {
    if (this.form.invalid) return;

    this.loading = true;
    this.error = '';

    try {
      const { email, password } = this.form.value;
      const res = await this.auth.login(email!, password!);

      if (res.challengeName) {
        this.router.navigate(['/challenge']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }
}
```

---

## Related APIs

- [NAuthClient](../api/nauth-client) - Underlying client class
- [NAuthClientConfig](../api/nauth-client-config) - Configuration options
- [AuthResponse](../api/types/auth-response) - Authentication response type
- [AuthUser](../api/types/auth-user) - User profile type
- [ChallengeResponse](../api/types/challenge-response) - Challenge response union
- [Interceptor](./interceptor) - HTTP interceptor for token management
- [Guards](./guards) - Route protection guards
- [NAuthClientError](../api/nauth-client-error) - Error handling
