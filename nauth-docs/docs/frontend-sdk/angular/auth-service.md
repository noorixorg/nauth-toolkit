---
title: AuthService
description: Angular service for authentication operations
sidebar_position: 2
keywords: [angular, service, authentication, observable]
image: /img/api-social-card.png
---

# AuthService

**Package:** `@nauth-toolkit/client/angular`
**Type:** Injectable Service

Angular wrapper around NAuthClient that exposes authentication methods as Observables and maintains reactive state.

```typescript
import { AuthService } from '@nauth-toolkit/client/angular';
```

## Overview

AuthService wraps the core NAuthClient and provides:

- Reactive state via BehaviorSubjects (`currentUser$`, `isAuthenticated$`, `challenge$`)
- All NAuthClient methods wrapped to return Observables
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
login(identifier: string, password: string): Observable<AuthResponse>
```

**Parameters**

| Parameter    | Type     | Description   |
| ------------ | -------- | ------------- |
| `identifier` | `string` | User email    |
| `password`   | `string` | User password |

**Returns**

- `Observable<[AuthResponse](../api/types/auth-response)>` - Emits auth result or challenge

**Example**

```typescript
this.auth.login('user@example.com', 'password').subscribe({
  next: (response) => {
    if (response.challengeName) {
      // Handle challenge
      this.router.navigate(['/challenge', response.challengeName]);
    } else {
      // Login successful
      this.router.navigate(['/dashboard']);
    }
  },
  error: (err) => (this.error = err.message),
});
```

---

### signup()

Register a new user.

```typescript
signup(payload: SignupRequest): Observable<AuthResponse>
```

**Returns**

- `Observable<[AuthResponse](../api/types/auth-response)>` - Emits auth result or challenge

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
this.auth
  .signup({
    email: 'new@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+14155551234',
  })
  .subscribe({
    next: (response) => {
      // Usually returns VERIFY_EMAIL challenge
      if (response.challengeName === 'VERIFY_EMAIL') {
        this.router.navigate(['/verify-email']);
      }
    },
  });
```

---

### logout()

End current session. Uses GET request to avoid CSRF token issues.

```typescript
logout(forgetDevice?: boolean): Observable<void>
```

**Parameters**

| Parameter      | Type      | Description                           |
| -------------- | --------- | ------------------------------------- |
| `forgetDevice` | `boolean` | Remove device trust. Default: `false` |

---

### logoutAll()

End all sessions for current user across all devices.

```typescript
logoutAll(forgetDevices?: boolean): Observable<{ revokedCount: number }>
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
this.auth.logoutAll().subscribe((result) => {
  console.log(`Revoked ${result.revokedCount} sessions`);
});

// Revoke all sessions AND all trusted devices
this.auth.logoutAll(true).subscribe((result) => {
  console.log(`Revoked ${result.revokedCount} sessions and all trusted devices`);
});
```

---

### respondToChallenge()

Complete any authentication challenge.

```typescript
respondToChallenge(response: ChallengeResponse): Observable<AuthResponse>
```

**Parameters**

- `response` - [`ChallengeResponse`](../api/types/challenge-response) - Challenge response (type depends on challenge)

**Returns**

- `Observable<[AuthResponse](../api/types/auth-response)>` - Next challenge or authentication success

**SDK Validation**

The SDK performs client-side validation before sending requests. For TOTP setup, it validates that both `secret` and `code` are present in `setupData`.

**Example - Email Verification**

```typescript
this.auth
  .respondToChallenge({
    session: this.challengeSession,
    type: 'VERIFY_EMAIL',
    code: '123456',
  })
  .subscribe({
    next: (response) => {
      if (response.challengeName) {
        // Next challenge
        this.handleChallenge(response);
      } else {
        // Complete
        this.router.navigate(['/dashboard']);
      }
    },
  });
```

**Example - TOTP Setup (requires both secret and code)**

```typescript
// IMPORTANT: TOTP setup requires both secret (from getSetupData) and code (from user)
this.auth.getSetupData(session, 'totp').subscribe((setupResponse) => {
  const secret = setupResponse.setupData.secret;

  // Display QR code to user
  this.qrCode = setupResponse.setupData.qrCode;

  // When user enters verification code:
  this.auth
    .respondToChallenge({
      session,
      type: 'MFA_SETUP_REQUIRED',
      method: 'totp',
      setupData: {
        secret, // Required: from getSetupData
        code: this.userEnteredCode, // Required: from user's authenticator app
      },
    })
    .subscribe({
      next: (response) => {
        if (response.challengeName) {
          // Progressive challenge (e.g., email verification next)
          this.router.navigate(['/challenge', response.challengeName]);
        } else {
          // Setup complete, user authenticated
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        // SDK validation error if secret or code is missing
        if (err instanceof NAuthClientError && err.isCode(NAuthErrorCode.VALIDATION_FAILED)) {
          console.error('TOTP setup validation failed:', err.message);
        }
      },
    });
});
```

---

### resendCode()

Resend verification code.

```typescript
resendCode(session: string): Observable<{ destination: string }>
```

---

### getSetupData()

Get MFA setup data during MFA_SETUP_REQUIRED challenge.

```typescript
getSetupData(session: string, method: string): Observable<GetSetupDataResponse>
```

**Returns**

- `Observable<[GetSetupDataResponse](../api/types/get-setup-data-response)>` - Method-specific setup data

**Example - TOTP Setup**

```typescript
// Get TOTP setup data (QR code, secret, manual entry key)
this.auth.getSetupData(session, 'totp').subscribe((response) => {
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
});

// Later, when user enters verification code:
this.auth
  .respondToChallenge({
    session,
    type: 'MFA_SETUP_REQUIRED',
    method: 'totp',
    setupData: {
      secret: this.secret, // Required: from getSetupData
      code: this.userEnteredCode, // Required: from user's authenticator app
    },
  })
  .subscribe({
    next: (response) => {
      if (response.challengeName) {
        // Another challenge required
        this.router.navigate(['/challenge', response.challengeName]);
      } else {
        // Setup complete
        this.router.navigate(['/dashboard']);
      }
    },
    error: (err) => {
      // Handle error (e.g., invalid code, missing secret)
      console.error('TOTP setup failed:', err);
    },
  });
```

---

### getChallengeData()

Get challenge data for MFA verification.

```typescript
getChallengeData(session: string, method: string): Observable<unknown>
```

---

### clearChallenge()

Clear stored challenge session.

```typescript
clearChallenge(): Observable<void>
```

---

### getProfile()

Fetch current user profile from server.

```typescript
getProfile(): Observable<AuthUser>
```

**Returns**

- `Observable<[AuthUser](../api/types/auth-user)>`

---

### getProfilePromise()

Fetch current user profile from server (promise-based).

Returns a promise instead of an Observable, matching the core NAuthClient API. Useful for async/await patterns in guards and interceptors.

```typescript
getProfilePromise(): Promise<AuthUser>
```

**Returns**

- `Promise<[AuthUser](../api/types/auth-user)>`

**Example**

```typescript
// In a route guard
const user = await auth.getProfilePromise();
```

---

### updateProfile()

Update user profile.

```typescript
updateProfile(updates: UpdateProfileRequest): Observable<AuthUser>
```

**Parameters**

- `updates` - [`UpdateProfileRequest`](../api/types/update-profile-request)

**Returns**

- `Observable<[AuthUser](../api/types/auth-user)>`

---

### changePassword()

Change user password.

```typescript
changePassword(oldPassword: string, newPassword: string): Observable<void>
```

---

### getMfaStatus()

Get user's MFA status.

```typescript
getMfaStatus(): Observable<MFAStatus>
```

**Returns**

- `Observable<[MFAStatus](../api/types/mfa-status)>`

---

### loginWithSocial()

Start redirect-first web social login (performs browser navigation).

```typescript
loginWithSocial(provider: SocialProvider, options?: SocialLoginOptions): Promise<void>
```

**Example**

```typescript
this.auth.loginWithSocial('google', { returnTo: '/auth/callback', appState: '12345' });
```

---

### exchangeSocialRedirect()

Exchange `exchangeToken` (from callback URL) into an auth result.

```typescript
exchangeSocialRedirect(exchangeToken: string): Observable<AuthResponse>
```

---

### exchangeSocialRedirectPromise()

Exchange `exchangeToken` (from callback URL) into an auth result (promise-based).

Returns a promise instead of an Observable, matching the core NAuthClient API. Useful for async/await patterns in guards and interceptors.

```typescript
exchangeSocialRedirectPromise(exchangeToken: string): Promise<AuthResponse>
```

**Parameters**

| Parameter       | Type     | Description                    |
| --------------- | -------- | ------------------------------ |
| `exchangeToken` | `string` | One-time exchange token from callback URL |

**Returns**

- `Promise<[AuthResponse](../api/types/auth-response)>`

**Example**

```typescript
// In a route guard
const response = await auth.exchangeSocialRedirectPromise(exchangeToken);
```

---

### verifyNativeSocial()

Verify native social token (mobile).

```typescript
verifyNativeSocial(request: SocialVerifyRequest): Observable<AuthResponse>
```

---

### refreshTokensPromise()

Refresh tokens (promise-based).

Returns a promise instead of an Observable, matching the core NAuthClient API. Useful for async/await patterns in guards and interceptors.

```typescript
refreshTokensPromise(): Promise<TokenResponse>
```

**Returns**

- `Promise<[TokenResponse](../api/types/token-response)>`

**Example**

```typescript
// In an interceptor
const tokens = await auth.refreshTokensPromise();
```

---

### getClient()

Get underlying NAuthClient instance for advanced operations.

:::warning Deprecated
This method is deprecated. Use promise-based methods (`getProfilePromise()`, `exchangeSocialRedirectPromise()`, `refreshTokensPromise()`) instead of accessing the client directly. The `getClient()` method is kept for backward compatibility only and may be removed in a future version.
:::

```typescript
getClient(): NAuthClient
```

**Example**

```typescript
// Deprecated - use promise-based methods instead
const client = this.auth.getClient();
await client.getProfile();

// Preferred - use promise-based methods
await auth.getProfilePromise();
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

### Form with Error Handling

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

  submit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.error = '';

    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.challengeName) {
          this.router.navigate(['/challenge']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message;
      },
    });
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
