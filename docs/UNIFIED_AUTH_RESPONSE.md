# Unified Authentication Response

## Overview

As of v0.1.0, **all authentication endpoints** return the same consistent response format, regardless of the authentication method used. This includes both **success responses** (with tokens) and **challenge responses** (requiring additional steps).

The response format follows a **discriminated union pattern** where either `accessToken` OR `challengeName` is present, but never both.

## Unified Response Format

### Success Response (Authentication Complete)

```typescript
interface AuthSuccessResponse {
  user: {
    sub: string; // User's unique ID (UUID)
    email: string; // User's email
    firstName?: string; // Optional first name
    lastName?: string; // Optional last name
    isEmailVerified: boolean; // Email verification status
    socialProviders?: string[]; // Linked providers (e.g., ['google', 'apple'])
  };
  accessToken: string; // JWT access token
  refreshToken: string; // JWT refresh token
  accessTokenExpiresAt: number; // Unix timestamp (seconds)
  refreshTokenExpiresAt: number; // Unix timestamp (seconds)

  // Challenge fields are NOT present in success response
  challengeName?: never;
  session?: never;
  challengeParameters?: never;
}
```

### Challenge Response (Additional Steps Required)

When authentication requires additional steps (email verification, MFA, password change), the response includes challenge information instead of tokens:

```typescript
interface AuthChallengeResponse {
  // Challenge information
  challengeName: AuthChallenge; // 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'MFA_REQUIRED' | etc.
  session: string; // Temporary session token for challenge completion
  challengeParameters?: Record<string, unknown>; // Challenge-specific data
  userSub: string; // User identifier for the challenge

  // Token fields are NOT present in challenge response
  accessToken?: never;
  refreshToken?: never;
  user?: never;
}
```

**Example Challenge Response:**

```json
{
  "challengeName": "VERIFY_EMAIL",
  "session": "550e8400-e29b-41d4-a716-446655440000",
  "challengeParameters": {
    "email": "user@example.com",
    "codeDeliveryDestination": "u***@example.com"
  },
  "userSub": "user-550e8400-e29b-41d4-a716-446655440000"
}
```

### Combined Type (Discriminated Union)

```typescript
type AuthResponseDTO = AuthSuccessResponse | AuthChallengeResponse;
```

This ensures that:

- ✅ A response has **either** tokens **or** a challenge, never both
- ✅ TypeScript can discriminate between the two cases
- ✅ Frontend code can handle both scenarios cleanly

**Frontend Type Guard:**

```typescript
function isChallenge(response: AuthResponseDTO): response is AuthChallengeResponse {
  return 'challengeName' in response && response.challengeName !== undefined;
}

function isSuccess(response: AuthResponseDTO): response is AuthSuccessResponse {
  return 'accessToken' in response && response.accessToken !== undefined;
}

// Usage
const response = await authService.login(credentials);
if (isChallenge(response)) {
  // Handle challenge
  navigateToChallenge(response.challengeName, response.session);
} else {
  // Handle success
  storeTokens(response);
  navigateToDashboard();
}
```

## Endpoints Using This Format

All authentication endpoints now return `AuthResponseDTO`:

### 1. Email/Password Signup

```typescript
POST /auth/signup
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: AuthResponseDTO
```

### 2. Email/Password Login

```typescript
POST /auth/login
{
  "identifier": "user@example.com",
  "password": "SecurePass123!"
}

Response: AuthResponseDTO
```

### 3. Social OAuth Callback (Web)

```typescript
POST /auth/social/google/callback
{
  "code": "oauth-code",
  "state": "csrf-state"
}

Response: AuthResponseDTO
```

### 4. Social Auth Token (Native Mobile)

```typescript
POST /auth/social/google/verify
{
  "idToken": "google-id-token",
  "accessToken": "google-access-token"
}

Response: AuthResponseDTO
```

### 5. Token Refresh

```typescript
POST /auth/refresh
{
  "refreshToken": "current-refresh-token"
}

Response: AuthResponseDTO (always success, never challenge)
```

### 6. Challenge Completion (Unified Endpoint)

**✨ NEW in v0.1.0:** Single endpoint for all challenge completions

```typescript
POST /auth/respond-challenge
{
  "session": "challenge-session-token",
  "type": "VERIFY_EMAIL" | "VERIFY_PHONE" | "MFA_REQUIRED" | ...,
  // ... type-specific fields
}

Response: AuthResponseDTO (success or next challenge)
```

**Examples:**

```typescript
// Email verification
POST /auth/respond-challenge
{
  "session": "uuid-session",
  "type": "VERIFY_EMAIL",
  "code": "123456"
}

// MFA verification
POST /auth/respond-challenge
{
  "session": "uuid-session",
  "type": "MFA_REQUIRED",
  "method": "totp",
  "code": "123456"
}

// Password change
POST /auth/respond-challenge
{
  "session": "uuid-session",
  "type": "FORCE_CHANGE_PASSWORD",
  "newPassword": "NewSecurePass123!"
}
```

## Challenge Types

The following challenge types are supported:

| Challenge Name          | Purpose                        | Response Data                                     |
| ----------------------- | ------------------------------ | ------------------------------------------------- |
| `VERIFY_EMAIL`          | Email address verification     | `{ session, type, code }`                         |
| `VERIFY_PHONE`          | Phone number verification      | `{ session, type, code }` or `{ session, phone }` |
| `MFA_REQUIRED`          | Multi-factor authentication    | `{ session, type, method, code/credential }`      |
| `MFA_SETUP_REQUIRED`    | Enroll MFA device              | `{ session, type, method, data }`                 |
| `FORCE_CHANGE_PASSWORD` | Admin-mandated password change | `{ session, type, newPassword }`                  |

## Benefits

### 1. **Consistent Frontend Code**

```typescript
// Single function handles ALL auth responses (success OR challenge)
function handleAuthResponse(response: AuthResponseDTO) {
  if ('challengeName' in response && response.challengeName) {
    // Handle challenge
    navigateToChallenge(response.challengeName, response.session);
  } else if ('accessToken' in response && response.accessToken) {
    // Handle success
    storeTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.accessTokenExpiresAt * 1000,
    });
    storeUser(response.user);
    navigateToDashboard();
  }
}

// Use it everywhere - works for login, signup, social auth, AND challenges
const loginResponse = await login(credentials);
handleAuthResponse(loginResponse);

const googleResponse = await verifySocialAuthToken('google', idToken);
handleAuthResponse(googleResponse);

const challengeResponse = await respondToChallenge({ session, type: 'VERIFY_EMAIL', code });
handleAuthResponse(challengeResponse); // Same handler!
```

### 2. **Simplified Type System**

```typescript
// Before: Multiple interfaces
interface LoginResponse { ... }
interface SignupResponse { ... }
interface SocialLoginResponse { ... }

// After: One interface
interface AuthResponse { ... }
```

### 3. **Better Encapsulation**

The consumer app doesn't need to know:

- How the user authenticated
- Whether it was social or password-based
- Whether it's a new signup or existing user

All you care about is: "I have authenticated tokens and user info."

## Migration from Old Code

If you have existing code using `SocialLoginResponse`, it's compatible:

```typescript
// Old code (still works)
const response: SocialLoginResponse = await socialLogin('google');

// New code (recommended)
const response: AuthResponse = await socialLogin('google');
```

`SocialLoginResponse` is now just a type alias for `AuthResponse`.

## Example: Complete Auth Flow

```typescript
class AuthService {
  private async handleAnyAuth(authPromise: Promise<AuthResponse>): Promise<void> {
    try {
      const response = await authPromise;

      // Store tokens
      this.storeTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: Math.max(1, response.accessTokenExpiresAt - Date.now() / 1000),
        expiresAt: response.accessTokenExpiresAt * 1000,
      });

      // Store user
      this.storeUser(response.user);

      // Navigate to dashboard
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.handleAuthError(error);
    }
  }

  // All authentication methods use the same handler
  async loginWithEmail(email: string, password: string) {
    await this.handleAnyAuth(this.http.post<AuthResponse>('/auth/login', { identifier: email, password }));
  }

  async signupWithEmail(email: string, password: string) {
    await this.handleAnyAuth(this.http.post<AuthResponse>('/auth/signup', { email, password }));
  }

  async loginWithGoogle(idToken: string) {
    await this.handleAnyAuth(this.http.post<AuthResponse>('/auth/social/google/verify', { idToken }));
  }

  async refreshTokens() {
    const refreshToken = this.getStoredRefreshToken();
    await this.handleAnyAuth(this.http.post<AuthResponse>('/auth/refresh', { refreshToken }));
  }
}
```

## Developer Experience Improvement

**Before:**

```typescript
// Different handling for different auth methods
if (method === 'email') {
  const response = await emailLogin();
  handleEmailResponse(response);
} else if (method === 'social') {
  const response = await socialLogin();
  handleSocialResponse(response); // Different function!
}
```

**After:**

```typescript
// Same handling for all methods
const response = await authenticate(method, credentials);
handleAuthResponse(response); // One function for everything!
```

## Timestamp Format

All timestamps are **Unix timestamps in seconds**:

```typescript
accessTokenExpiresAt: 1730000000; // October 27, 2024 12:00:00 AM UTC
refreshTokenExpiresAt: 1732592000; // November 26, 2024 12:00:00 AM UTC (30 days later)
```

Convert to JavaScript Date:

```typescript
const expiryDate = new Date(response.accessTokenExpiresAt * 1000);
```

Calculate time until expiry:

```typescript
const secondsUntilExpiry = response.accessTokenExpiresAt - Math.floor(Date.now() / 1000);
```

## Challenge Chaining

Challenges can be chained - completing one challenge may return another challenge:

```typescript
// 1. Login returns email verification challenge
POST /auth/login → { challengeName: 'VERIFY_EMAIL', session: 'abc' }

// 2. Verify email returns phone verification challenge
POST /auth/respond-challenge
{
  "session": "abc",
  "type": "VERIFY_EMAIL",
  "code": "123456"
}
→ { challengeName: 'VERIFY_PHONE', session: 'def' }

// 3. Verify phone returns MFA setup challenge
POST /auth/respond-challenge
{
  "session": "def",
  "type": "VERIFY_PHONE",
  "code": "654321"
}
→ { challengeName: 'MFA_SETUP_REQUIRED', session: 'ghi' }

// 4. Complete MFA setup returns tokens (success!)
POST /auth/respond-challenge
{
  "session": "ghi",
  "type": "MFA_SETUP_REQUIRED",
  "method": "totp",
  "data": { "secret": "...", "code": "123456" }
}
→ { accessToken: '...', refreshToken: '...', user: {...} }
```

**Frontend Handling:**

```typescript
async function handleChallenge(response: AuthResponseDTO) {
  while ('challengeName' in response && response.challengeName) {
    // Show challenge UI and wait for user input
    const userInput = await showChallengeUI(response.challengeName, response.challengeParameters);

    // Submit challenge response
    response = await authService.respondToChallenge({
      session: response.session,
      type: response.challengeName,
      ...userInput,
    });
  }

  // All challenges complete - store tokens
  storeTokens(response);
  navigateToDashboard();
}
```

## HTTP Status Codes

All authentication responses use **HTTP 200** (success) regardless of whether they contain tokens or challenges:

| Scenario                      | Status | Response                             |
| ----------------------------- | ------ | ------------------------------------ |
| Login success (no challenges) | `200`  | `{ accessToken, refreshToken, ... }` |
| Challenge required            | `200`  | `{ challengeName, session, ... }`    |
| Invalid credentials           | `401`  | Error message                        |
| Rate limit exceeded           | `429`  | Error message                        |
| Validation error              | `400`  | Error message                        |

**Why HTTP 200 for challenges?**

Challenges are **not errors** - they're expected intermediate states in the authentication flow. The request was processed successfully, and the server is asking for additional information. This design matches industry standards (AWS Cognito, Auth0).

See `CHALLENGE_SYSTEM_ARCHITECTURE.md` for detailed reasoning.

## Complete Flow Example

```typescript
class AuthService {
  // Universal handler for all auth operations
  private async handleAuthFlow(authPromise: Promise<AuthResponseDTO>): Promise<void> {
    try {
      let response = await authPromise;

      // Handle challenge chain
      while (this.isChallenge(response)) {
        console.log(`Challenge required: ${response.challengeName}`);

        // Show challenge UI
        const challengeData = await this.showChallengeUI(response);

        // Complete challenge
        response = await this.respondToChallenge(challengeData);
      }

      // Authentication complete
      this.storeTokens(response);
      this.storeUser(response.user);
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.handleAuthError(error);
    }
  }

  // All authentication methods use the same handler
  async loginWithEmail(email: string, password: string) {
    await this.handleAuthFlow(this.http.post<AuthResponseDTO>('/auth/login', { identifier: email, password }));
  }

  async signupWithEmail(email: string, password: string) {
    await this.handleAuthFlow(this.http.post<AuthResponseDTO>('/auth/signup', { email, password }));
  }

  async loginWithGoogle(idToken: string) {
    await this.handleAuthFlow(this.http.post<AuthResponseDTO>('/auth/social/google/verify', { idToken }));
  }

  private isChallenge(response: AuthResponseDTO): response is AuthChallengeResponse {
    return 'challengeName' in response && response.challengeName !== undefined;
  }
}
```

## Summary

✅ **One response format** for all authentication operations (success AND challenges)
✅ **Discriminated union** ensures type safety (tokens XOR challenge)
✅ **Simpler frontend code** with unified handling
✅ **Better encapsulation** in the nauth-toolkit library
✅ **Consistent timestamps** across all endpoints
✅ **Same developer experience** regardless of auth method
✅ **Challenge chaining** handled transparently
✅ **HTTP 200 for challenges** follows industry standards

This design follows the principle of **least surprise** - the consumer app has a consistent interface regardless of how authentication happens under the hood.
