# Authentication Challenge System

**Status:** - Production Ready | **Tests:** 30/30 Passing | **Build:** - Passing

---

## What It Does

Enforces email/phone verification **before** granting access (like AWS Cognito). Works with signup, login, and social auth.

---

## Challenge Types

```typescript
enum AuthChallenge {
  VERIFY_EMAIL              // Email verification required
  VERIFY_PHONE              // Phone verification required
  VERIFY_EMAIL_AND_PHONE    // Both required
  MFA_REQUIRED              // Placeholder for Phase 4
  FORCE_CHANGE_PASSWORD     // Admin-forced resets
}
```

---

## API Response

### Success (No Challenges)

```typescript
{
  accessToken: "eyJ...",
  refreshToken: "eyJ...",
  user: { sub, email, isEmailVerified, isPhoneVerified }
}
```

### Challenge Required

```typescript
{
  challengeName: "VERIFY_EMAIL",
  session: "uuid",
  challengeParameters: {
    email: "user@example.com",
    codeDeliveryDestination: "u***@example.com"
  },
  userSub: "uuid"
}
```

---

## Configuration

```typescript
AuthModule.forRoot({
  signup: {
    verificationMethod: 'none' | 'email' | 'phone' | 'both',
  },
});
```

---

## Backend Usage

```typescript
// Signup/Login - Returns challenge if verification needed
const result = await authService.signup(dto);
if (result.challengeName) {
  return result; // Challenge response
} else {
  return result; // Tokens
}

// Complete Challenge (Unified API)
const result = await authService.respondToChallenge({
  session: sessionToken,
  type: 'VERIFY_EMAIL',
  code: '123456'
});
```

---

## Frontend Usage

```typescript
async function handleAuth(response: AuthResponseDTO) {
  if (response.challengeName) {
    // Show verification UI
    showVerificationForm(response.challengeName, response.session);
  } else {
    // Store tokens
    storeTokens(response.accessToken, response.refreshToken);
  }
}

// Submit verification code (Unified API - Single Call)
async function verifyEmail(session: string, code: string) {
  const result = await fetch('/auth/respond-challenge', {
    method: 'POST',
    body: JSON.stringify({
      session,
      type: 'VERIFY_EMAIL',
      code
    }),
  });

  await handleAuth(result); // Might return next challenge or tokens
}
```

---

## Database Migration

```sql
CREATE TABLE nauth_challenge_sessions (
  id SERIAL PRIMARY KEY,
  userId INT NOT NULL REFERENCES nauth_users(id) ON DELETE CASCADE,
  challengeName VARCHAR(50) NOT NULL,
  sessionToken VARCHAR(255) UNIQUE NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  isCompleted BOOLEAN DEFAULT false,
  completedAt TIMESTAMP,
  attempts INT DEFAULT 0,
  maxAttempts INT DEFAULT 3,
  metadata JSONB,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_challenge_session_token ON nauth_challenge_sessions(sessionToken);
CREATE INDEX idx_challenge_user_id ON nauth_challenge_sessions(userId);
```

---

## Key Points

- **Challenge sessions expire in 15 minutes**
- **Max 3 attempts per session**
- **Email auto-verified** for social auth (Google, Apple, Facebook)
- **Phone verification enforced** if `verificationMethod: 'both'` or `'phone'`
- **Progressive flow:** Complete one challenge → get next or tokens

---

## Example Scenarios

### Email Verification Required

```
1. User signs up
2. Response: { challengeName: 'VERIFY_EMAIL', session: '...' }
3. User enters code from email
4. POST /auth/respond-challenge { session, type: 'VERIFY_EMAIL', code }
5. Response: { accessToken: '...', refreshToken: '...' }
```

### Both Email + Phone Required

```
1. User signs up with phone
2. Response: { challengeName: 'VERIFY_EMAIL_AND_PHONE', session: '...' }
3. User verifies email
4. Response: { challengeName: 'VERIFY_PHONE', session: '...' }
5. User verifies phone
6. Response: { accessToken: '...', refreshToken: '...' }
```

### Social Login with Phone Verification

```
1. User signs in with Google (email auto-verified)
2. Response: { challengeName: 'VERIFY_PHONE', session: '...' }
3. User adds and verifies phone
4. Response: { accessToken: '...', refreshToken: '...' }
```

---

## Testing

```typescript
// Check for challenge
expect(result.challengeName).toBe('VERIFY_EMAIL');
expect(result.accessToken).toBeUndefined();

// Check for success
expect(result.challengeName).toBeUndefined();
expect(result.accessToken).toBeDefined();
```

---

## Troubleshooting

**Challenge session expired?** → Sessions expire after 15 min. User must restart authentication.

**Too many attempts?** → Max 3 attempts per session. Request new challenge session.

**Challenge not recognized?** → Ensure `challengeName` matches enum values exactly.

---

That's it. Simple verification enforcement before granting access.
