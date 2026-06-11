---
title: Challenge Helpers
description: Utility functions for working with authentication challenges
keywords: [challenge, helpers, utilities, mfa, verification, api]
image: /img/api-social-card.png
---

# Challenge Helpers

**Package:** `@nauth-toolkit/client`
**Type:** Utility Functions

Helper utilities for working with authentication challenges. These functions provide type-safe access to challenge parameters and reduce boilerplate in consumer applications.

```typescript
import {
  getMaskedDestination,
  getMFAMethod,
  getChallengeInstructions,
  requiresPhoneCollection,
  isOTPChallenge,
} from '@nauth-toolkit/client';
```

## Functions

### `getMaskedDestination()`

Get masked destination (email or phone) from challenge parameters.

**Signature:**

```typescript
function getMaskedDestination(challenge: AuthResponse): string | null
```

**Description:**

- For `VERIFY_EMAIL` and `VERIFY_PHONE` challenges: Returns `codeDeliveryDestination` from challenge parameters
- For `MFA_REQUIRED` challenges: Returns `maskedPhone` or `maskedEmail` based on `preferredMethod`
- Returns `null` if no masked destination is available

**Example:**

```typescript
const challenge = await client.login(email, password);

if (challenge.challengeName) {
  const destination = getMaskedDestination(challenge);
  if (destination) {
    console.log(`Code sent to ${destination}`);
    // For VERIFY_EMAIL: "u***r@example.com"
    // For VERIFY_PHONE: "***-***-1234"
    // For MFA_REQUIRED (SMS): "***-***-9393"
    // For MFA_REQUIRED (Email): "m***2@example.com"
  }
}
```

**Behavior for MFA_REQUIRED:**

When `challengeName` is `MFA_REQUIRED`, the function checks `preferredMethod` in challenge parameters:
- If `preferredMethod === 'sms'`: Returns `maskedPhone`
- If `preferredMethod === 'email'`: Returns `maskedEmail`
- Falls back to trying both if method is not specified

### `getMFAMethod()`

Get preferred MFA method from challenge parameters.

**Signature:**

```typescript
function getMFAMethod(challenge: AuthResponse): MFAMethod | undefined
```

**Description:**

Extracts the MFA method from `MFA_REQUIRED` challenge parameters. Checks `preferredMethod` first, then falls back to `method`.

**Example:**

```typescript
const challenge = await client.login(email, password);

if (challenge.challengeName === AuthChallenge.MFA_REQUIRED) {
  const method = getMFAMethod(challenge);
  // method: 'sms' | 'email' | 'totp' | 'backup' | 'passkey' | undefined

  if (method === 'totp') {
    // Show TOTP input
  } else if (method === 'sms' || method === 'email') {
    // Show OTP input with masked destination
    const destination = getMaskedDestination(challenge);
  }
}
```

### `requiresPhoneCollection()`

Check if a challenge requires phone collection (user has no phone number).

**Signature:**

```typescript
function requiresPhoneCollection(challenge: AuthResponse): boolean
```

**Description:**

Returns `true` if the `VERIFY_PHONE` challenge requires the user to provide a phone number first. This happens when the user doesn't have a phone number in their profile (e.g., after social login).

**Important Note:**

The `requiresPhoneCollection` flag is a **UI hint** indicating the user has no phone number. However, the backend **always accepts phone updates** during the `VERIFY_PHONE` challenge, even if the user already has a phone number. This allows users to correct wrong numbers entered during signup.

**Example:**

```typescript
const challenge = await client.login(email, password);

if (challenge.challengeName === AuthChallenge.VERIFY_PHONE) {
  if (requiresPhoneCollection(challenge)) {
    // User has no phone - show phone input form
    // After phone is collected, backend sends verification code
  } else {
    // Phone already exists - show OTP input
    // Optionally: Provide "Change Number" option to allow phone updates
    const destination = getMaskedDestination(challenge);

    // Optional: Allow phone update even when phone exists
    // if (userWantsToChangePhone) {
    //   showPhoneInput(); // Backend will accept and update phone
    // }
  }
}
```

**Phone Update During Challenge:**

Users can update their phone number during the challenge by submitting a new phone number:

```typescript
// Even if user already has a phone, they can update it:
await client.respondToChallenge({
  session: challenge.session!,
  type: 'VERIFY_PHONE',
  phone: '+1999999999', // New/corrected phone number
});
// Backend updates phone, sends SMS to new number, returns challenge for code verification
```

### `getChallengeInstructions()`

Get challenge instructions from challenge parameters.

**Signature:**

```typescript
function getChallengeInstructions(challenge: AuthResponse): string | undefined
```

**Description:**

Extracts the `instructions` field from challenge parameters, if available. Some challenges include user-friendly instructions.

**Example:**

```typescript
const challenge = await client.login(email, password);

if (challenge.challengeName) {
  const instructions = getChallengeInstructions(challenge);
  if (instructions) {
    // Display instructions to user
    // e.g., "You must add a phone number and verify it to continue"
  }
}
```

### `isOTPChallenge()`

Check if challenge is OTP-based (requires code input).

**Signature:**

```typescript
function isOTPChallenge(challenge: AuthResponse): boolean
```

**Description:**

Returns `true` if the challenge requires an OTP code input. This includes:
- `VERIFY_EMAIL` - Email verification code
- `VERIFY_PHONE` - Phone verification code
- `MFA_REQUIRED` - MFA code (SMS, Email, TOTP, or backup codes)

**Example:**

```typescript
const challenge = await client.login(email, password);

if (challenge.challengeName && isOTPChallenge(challenge)) {
  // Show OTP input component
  // Can reuse same component for all OTP-based challenges
}
```

## Complete Example

```typescript
import {
  NAuthClient,
  AuthChallenge,
  getMaskedDestination,
  getMFAMethod,
  requiresPhoneCollection,
  isOTPChallenge,
} from '@nauth-toolkit/client';

const client = new NAuthClient({ /* config */ });

async function handleChallenge(challenge: AuthResponse): Promise<void> {
  if (!challenge.challengeName) {
    // Authentication complete
    return;
  }

  // Check if it's an OTP challenge
  if (isOTPChallenge(challenge)) {
    // Get masked destination for display
    const destination = getMaskedDestination(challenge);
    const method = getMFAMethod(challenge);

    if (challenge.challengeName === AuthChallenge.MFA_REQUIRED) {
      if (method === 'totp') {
        // Show TOTP input
      } else if (method === 'sms' || method === 'email') {
        // Show OTP input with destination
        console.log(`Code sent to ${destination}`);
      }
    } else if (challenge.challengeName === AuthChallenge.VERIFY_PHONE) {
      if (requiresPhoneCollection(challenge)) {
        // Show phone input form
      } else {
        // Show OTP input
        console.log(`Code sent to ${destination}`);
      }
    } else {
      // VERIFY_EMAIL
      console.log(`Code sent to ${destination}`);
    }
  } else if (challenge.challengeName === AuthChallenge.FORCE_CHANGE_PASSWORD) {
    // Show password change form
  } else if (challenge.challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
    // Show MFA setup UI
  }
}
```

## Related Documentation

- [Challenge Handling Guide](../../guides/challenge-handling) - Complete challenge flow guide
- [AuthResponse](./../types/auth-response) - Challenge response structure
- [AuthChallenge](./../types/auth-challenge) - Challenge type enum
- [MFAMethod](./../types/mfa-method) - MFA method types

