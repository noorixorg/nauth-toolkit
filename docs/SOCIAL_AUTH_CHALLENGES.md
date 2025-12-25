# Social Authentication + Challenge System Integration

## Overview

Social authentication (Google, Apple, Facebook) is now fully integrated with the challenge system. When users sign up or log in via OAuth, they will be required to complete any pending verification challenges before gaining full access.

## How It Works

### Email Verification

- **Social users automatically have verified emails** - OAuth providers (Google, Apple, Facebook) verify emails
- `isEmailVerified` is set to `true` based on `profile.verified_email` from the provider
- Social users will **skip email verification challenges**

### Phone Verification

- **Social auth does NOT collect phone numbers during signup**
- If your configuration requires phone verification (`verificationMethod: 'phone'` or `'both'`):
  - **Social users without phone**: Will be BLOCKED with `VERIFY_PHONE` challenge - they MUST add a phone number using the `/auth/profile` endpoint, then verify it before they can proceed
  - **Social users with phone** (added later): Will be required to verify it on next login

### Challenge Flow

```typescript
// User signs up via Google
// ↓
// Email is auto-verified from Google
// ↓
// Check pending challenges
// ↓
// If phone verification required AND user has phone → VERIFY_PHONE challenge
// If phone verification required BUT user has NO phone → Allow login (no challenge)
```

## Configuration Examples

### Example 1: Email Verification Only (Default)

```typescript
AuthModule.forRoot({
  signup: {
    verificationMethod: 'email', // Default
  },
  // ...
});
```

**Behavior for social users:**

- Email is auto-verified from provider
- User can log in immediately
- No challenges required

---

### Example 2: Phone Verification Required

```typescript
AuthModule.forRoot({
  signup: {
    verificationMethod: 'phone',
  },
  // ...
});
```

**Behavior for social users:**

- Email is auto-verified from provider
- **Phone is NOT collected during social signup**
- User is BLOCKED with `VERIFY_PHONE` challenge
- **User must add phone via `/auth/profile` endpoint, then verify it**

---

### Example 3: Both Email AND Phone Required

```typescript
AuthModule.forRoot({
  signup: {
    verificationMethod: 'both',
  },
  // ...
});
```

**Behavior for social users:**

- Email is auto-verified from provider
- **Phone is NOT collected during social signup**
- User is BLOCKED with `VERIFY_EMAIL_AND_PHONE` challenge
- **User must add phone via `/auth/profile` endpoint, then verify both**

---

## How Phone Collection Works for Social Users

### Phone Required But Not Collected

Social OAuth flows (Google, Apple, Facebook) do not provide phone numbers. When `verificationMethod: 'phone'` or `'both'`:

- **Social users are BLOCKED** with `VERIFY_PHONE` challenge
- **Challenge response includes** `requiresPhoneCollection: 'true'` parameter
- **Frontend must show phone collection form**
- **User adds phone via** `POST /auth/respond-challenge` with `phone` field
- **Backend updates user phone and sends SMS verification code automatically**
- **User verifies phone** with code via `POST /auth/respond-challenge` with `code` field
- **System re-checks challenges** → all verified → tokens issued

### Phone Update During Challenge

**Important**: Users can update their phone number during the `VERIFY_PHONE` challenge, even if they already have a phone number. This is useful when:

- User entered wrong number during signup
- User made a typo
- User wants to use a different number

The backend accepts phone updates unconditionally during the challenge. The `requiresPhoneCollection` flag is only a UI hint indicating the user has no phone, but it doesn't prevent phone updates.

**Example Flow:**

```typescript
// User has wrong phone number from signup
const challenge = await client.login(email, password);
// challenge.challengeName === 'VERIFY_PHONE'
// challenge.challengeParameters.phone === '+1234567890' (wrong number)
// challenge.challengeParameters.requiresPhoneCollection === undefined (phone exists)

// User can update phone during challenge:
await client.respondToChallenge({
  session: challenge.session!,
  type: 'VERIFY_PHONE',
  phone: '+1999999999', // Corrected phone number
});
// Backend updates phone, sends SMS to new number, returns challenge for code verification
```

---

## Recommended Approaches

### Approach 1: Unified Challenge Flow (Recommended)

Use the built-in challenge system for phone collection and verification:

```typescript
// After social login, if VERIFY_PHONE challenge is returned:
const challenge = await client.socialLogin(provider, token);

if (challenge.challengeName === 'VERIFY_PHONE') {
  // Check if phone collection needed
  if (requiresPhoneCollection(challenge)) {
    // User has no phone - show phone input
    showPhoneInput();
  } else {
    // User has phone - show code input
    // Optionally: Allow phone update with "Change Number" button
    showCodeInput();
    showChangePhoneOption(); // Optional UX enhancement
  }

  // When user submits phone (new or updated):
  const response = await client.respondToChallenge({
    session: challenge.session!,
    type: 'VERIFY_PHONE',
    phone: userEnteredPhone, // Backend updates phone and sends SMS
  });

  // Then verify code:
  await client.respondToChallenge({
    session: response.session!,
    type: 'VERIFY_PHONE',
    code: userEnteredCode,
  });
}
```

**Benefits:**
- Unified API for phone collection and updates
- Automatic SMS sending after phone update
- No separate endpoints needed
- Works for both new phones and phone updates

---

### Approach 2: Skip Phone Verification for Social Users

If phone verification is not critical for social auth users:

```typescript
// Option 1: Use email-only verification
AuthModule.forRoot({
  signup: {
    verificationMethod: 'email', // Social users auto-verified
  },
});

// Option 2: Use 'none' to skip all verification for social users
AuthModule.forRoot({
  signup: {
    verificationMethod: 'none',
  },
});
```

---

### Approach 3: Hybrid - Require Phone for Password Users Only

Use different verification methods for different signup types:

```typescript
// In auth configuration
AuthModule.forRoot({
  signup: {
    verificationMethod: 'email',  // Default for social (auto-verified)
  },
})

// In your signup endpoint
@Post('signup')
async signup(@Body() dto: SignupDTO) {
  // Password-based signup
  const result = await this.authService.signup(dto);

  // If phone provided, require verification
  if (dto.phone) {
    await this.phoneVerificationService.sendVerificationSMS(result.user.sub);
  }

  return result;
}
```

---

## Implementation Details

### Code Changes

#### 1. `social-auth.service.ts` - `handleCallback` Method

Now checks for pending challenges before issuing tokens:

```typescript
// After OAuth callback and user creation/linking
const response = await this.challengeHelper.determineAuthResponse(
  user,
  this.config,
  clientInfo.ipAddress || 'unknown',
  clientInfo.userAgent || 'web-browser',
);

if (response.challengeName) {
  // Return challenge instead of tokens
  return response;
}

// No challenges - return tokens
return { accessToken, refreshToken, user };
```

#### 2. `auth-challenge-helper.service.ts` - `determinePendingChallenges` Method

Updated to handle social users properly:

```typescript
// Check phone verification
// IMPORTANT: Phone verification requires user to HAVE a phone number
// Social auth doesn't collect phone during signup, so:
// - If user has phone but not verified: require VERIFY_PHONE
// - If user has NO phone and phone verification is required: skip for now
const requiresPhoneVerification =
  (verificationMethod === 'phone' || verificationMethod === 'both') && user.phone && !user.isPhoneVerified;
```

#### 3. `findOrCreateUser` - Auto-Verify Email

Social users have `isEmailVerified` set from provider:

```typescript
const user = this.userRepository.create({
  email: profile.email || '',
  firstName: profile.firstName || null,
  lastName: profile.lastName || null,
  isEmailVerified: profile.verified || false, // ← From OAuth provider
  hasSocialAuth: true,
  socialProviders: [provider],
});
```

---

## Testing Social Auth + Challenges

### Test Scenario 1: Social Signup with Email Verification

```bash
# Configuration
verificationMethod: 'email'

# Expected Flow
1. User clicks "Sign in with Google"
2. OAuth flow completes
3. User created with isEmailVerified = true
4. User receives tokens immediately (no challenge)
5. User can access protected routes
```

### Test Scenario 2: Social Signup with Phone Verification (No Phone)

```bash
# Configuration
verificationMethod: 'phone'

# Expected Flow
1. User clicks "Sign in with Google"
2. OAuth flow completes
3. User created WITHOUT phone number
4. User receives tokens immediately (no phone to verify)
5. User can access protected routes
```

### Test Scenario 3: Social User Adds Phone Later

```bash
# Configuration
verificationMethod: 'both'

# Expected Flow
1. User signs in with Google (has no phone)
2. User receives tokens (no phone challenge)
3. User adds phone via app UI
4. User logs out and logs in again
5. User receives VERIFY_PHONE challenge
6. User enters verification code
7. User receives tokens after verification
```

### Test Scenario 4: Existing Password User Links Social Account

```bash
# Configuration
verificationMethod: 'both'

# Expected Flow
1. User signs up with email/password
2. Email and phone verification required
3. User verifies email and phone
4. User links Google account
5. User logs out
6. User signs in with Google
7. User receives tokens immediately (already verified)
```

---

## API Response Examples

### Social Login - No Challenges

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "accessTokenExpiresAt": 1234567890,
  "refreshTokenExpiresAt": 1234567890,
  "user": {
    "sub": "uuid-123",
    "email": "user@gmail.com",
    "isEmailVerified": true,
    "socialProviders": ["google"],
    "hasPasswordHash": false
  }
}
```

### Social Login - Phone Challenge Required

```json
{
  "challengeName": "VERIFY_PHONE",
  "session": "challenge-session-token",
  "challengeParameters": {
    "phone": "+1234567890",
    "codeDeliveryDestination": "***-***-7890"
  },
  "userSub": "uuid-123"
}
```

---

## Frequently Asked Questions

### Q: Why don't social users get phone verification challenges?

**A:** Social OAuth providers (Google, Apple, Facebook) don't provide phone numbers in their user profiles. We cannot verify what we don't have.

### Q: How do I enforce phone verification for all users?

**A:** You'll need to:

1. Collect phone numbers separately after social login
2. Send verification SMS via the phone verification service
3. Users will be challenged on their next login

### Q: Can I skip email verification for social users?

**A:** Email is automatically verified for social users. They will never see an email verification challenge because `isEmailVerified` is set to `true` from the OAuth provider.

### Q: What if I want to force social users to add a phone?

**A:** This requires custom implementation:

1. After social login, check `if (!user.phone)`
2. Redirect to phone collection page
3. Don't allow app access until phone is added and verified
4. This is application-level logic, not handled by the auth library

### Q: Does this work with native mobile apps (Capacitor)?

**A:** Yes! The `verifySocialAuthToken` method (for native social auth) already includes challenge checking. Both web and native flows now support challenges.

---

## Migration Guide

### If You're Already Using Social Auth

**No breaking changes!** The updates are backward compatible:

1. **Rebuild your packages**:

   ```bash
   yarn workspace @nauth-toolkit/core build
   yarn workspace sample-app build
   ```

2. **Restart your backend**:

   ```bash
   yarn workspace sample-app start:dev
   ```

3. **Test social login flow**:
   - Users with verified emails → No challenges
   - Users with unverified emails → Email challenge (rare for social)
   - Users with phone but unverified → Phone challenge

4. **No frontend changes required** unless you want to add phone collection UI

---

## Summary

**What's New:**

- Social auth now checks for pending challenges
- Email is auto-verified from OAuth providers
- Phone verification works if user has a phone

**Current Limitations:**

- Phone numbers are NOT collected during social signup
- No "collect phone" challenge (future enhancement)
- Social users can bypass phone verification if they don't have a phone

**Recommended:**

- Use `verificationMethod: 'email'` for social-heavy apps (default)
- Collect phone numbers separately if needed
- Use `verificationMethod: 'both'` for password signups only

---

## Related Documentation

- [Authentication Flow](./AUTHENTICATION_FLOW_COMPLETE.md)
- [Challenge System](./AUTH_CHALLENGE_SYSTEM.md)
- [Database Adapter Architecture](./DATABASE_ADAPTER_ARCHITECTURE.md)
- [Capacitor Native Social Auth](./CAPACITOR_NATIVE_SOCIAL_AUTH.md)
