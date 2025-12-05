---
title: Social Login
description: Let users sign in with Google, Apple, Facebook, and more
sidebar_position: 1
---

# Social Login

Allow users to sign in with their existing social accounts. nauth-toolkit handles OAuth flows, token exchange, and account linking automatically.

For complete social authentication configuration options, see the [Configuration guide](/docs/concepts/configuration#social-authentication).

:::info Currently Supported

- Google OAuth 2.0
- Apple Sign In
- Facebook Login
- **Native Mobile Support** (via Capacitor)

**Coming Soon:** GitHub, Microsoft, Twitter/X, LinkedIn
:::

## Why Use Social Login?

**Benefits for users:**

- No password to remember
- Faster signup (pre-filled profile data)
- Trust in established identity providers

**Benefits for you:**

- Higher conversion rates (less friction)
- Verified email addresses (from providers)
- Reduced support burden (no password resets for social users)

:::tip Account Linking
Users can link multiple social providers to one account. For example, they can sign in with Google or Apple and reach the same account.
:::

## How It Works

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="user" label="User Experience" default>

1. User clicks "Sign in with Google" on your login page
2. They're redirected to Google's login page
3. They authorize your app to access their basic profile
4. Google redirects back to your app with an authorization code
5. Your backend exchanges the code for user info
6. User is logged in with a new account (or matched to existing account)

The entire flow takes seconds and requires no password entry.

  </TabItem>
  <TabItem value="dev" label="Developer Integration">

**Step 1: Install the provider package**

```bash
yarn add @nauth-toolkit/social-google
```

**Step 2: Configure your OAuth credentials**

```typescript
import { GoogleOAuthProvider } from '@nauth-toolkit/social-google';

const config = {
  socialProviders: {
    google: new GoogleOAuthProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: 'https://yourdomain.com/auth/google/callback',
    }),
  },
};
```

**Step 3: Add routes to your controller**

```typescript
@Get('auth/google')
initiateGoogleLogin() {
  return this.authService.getSocialLoginUrl('google');
}

@Get('auth/google/callback')
async handleGoogleCallback(@Query('code') code: string) {
  return this.authService.handleSocialCallback('google', code);
}
```

That's it. nauth-toolkit handles token exchange, profile fetching, and account creation.

  </TabItem>
</Tabs>

## Provider-Specific Setup

Each provider requires OAuth app registration. Here's where to get credentials:

<details>
<summary>Google OAuth Setup</summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google+ API"
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set authorized redirect URI: `https://yourdomain.com/auth/google/callback`
6. Copy your **Client ID** and **Client Secret**

**Scopes requested:**

- `openid` - Basic authentication
- `email` - User's email address
- `profile` - Name and profile picture

</details>

<details>
<summary>Apple Sign In Setup</summary>

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. **Certificates, Identifiers & Profiles** → **Identifiers** → Create "Services ID"
3. Configure Sign in with Apple
4. Set return URL: `https://yourdomain.com/auth/apple/callback`
5. Generate a private key and download it
6. Configure with Team ID, Key ID, Client ID, and private key

**Scopes requested:**

- `name` - User's first and last name (optional)
- `email` - User's email address (optional, may be proxied by Apple)

:::note Apple Privacy Features
Apple may provide a private relay email (`random@privaterelay.appleid.com`). Users can choose to hide their real email. Your app must handle both real and relay emails.
:::

</details>

<details>
<summary>Facebook Login Setup</summary>

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app (Consumer type)
3. Add **Facebook Login** product
4. Set valid OAuth redirect URI: `https://yourdomain.com/auth/facebook/callback`
5. Copy your **App ID** and **App Secret**

**Permissions requested:**

- `public_profile` - Basic profile information
- `email` - Email address (must be requested explicitly)

</details>

## Challenge System Integration

Social login integrates seamlessly with the nauth-toolkit challenge system (e.g., for phone verification).

### Email Verification

Social users **skip email verification** because their email is already verified by the provider (Google, Apple, etc.).

### Phone Verification

Social providers do **not** provide phone numbers. If your app requires phone verification:

1. User signs in with Google
2. System checks for phone number
3. If missing, system returns `VERIFY_PHONE` challenge
4. Your frontend must prompt user to enter their phone number
5. User verifies phone via SMS
6. Login completes

```typescript
// Example response when phone is missing
{
  "challengeName": "VERIFY_PHONE",
  "session": "challenge-session-token",
  "challengeParameters": {
    "requiresPhoneCollection": true
  }
}
```

## Native Mobile Support (Capacitor)

nauth-toolkit supports native social login on iOS and Android using Capacitor. This provides a better user experience than web-based redirects.

**Architecture:**

1. Mobile app uses native SDK to get ID Token
2. Mobile app sends ID Token to backend
3. Backend verifies ID Token with provider
4. Backend issues JWT session

**Example (Frontend):**

```typescript
import { SocialLogin } from '@capgo/capacitor-social-login';

// 1. Get token from native SDK
const result = await SocialLogin.login({
  provider: 'google',
  options: { scopes: ['email', 'profile'] },
});

// 2. Send to backend
const response = await fetch(`${API_URL}/auth/social/google/verify`, {
  method: 'POST',
  body: JSON.stringify({
    idToken: result.result.idToken,
  }),
});
```

**Example (Backend):**

```typescript
@Post('auth/social/:provider/verify')
async verifyNativeToken(@Param('provider') provider, @Body() dto) {
  // Verifies ID token and creates session
  return this.socialAuthService.verifyNativeToken(provider, dto);
}
```

## Account Linking

Users can link multiple social providers to the same account.

**Automatic linking by email:**

If a user signs in with Google using `user@example.com`, and later signs in with Apple using the same email, nauth-toolkit automatically links these to the same account (if configured to do so).

```typescript
const config = {
  socialProviders: {
    linkAccountsByEmail: true, // Default: true
  },
};
```

:::warning Verified Emails Only
Automatic linking only works if the email is verified by the provider. This prevents account takeover attacks.
:::

**Manual linking:**

Users can manually link additional providers from their account settings:

```typescript
// User is already logged in with Google
// They want to add Apple
const linkUrl = await authService.getSocialLinkUrl('apple', userId);
// Redirect user to linkUrl
// After OAuth flow, Apple is linked to their account
```

## Handling Profile Data

When a user signs in with a social provider, you receive their profile data:

```typescript
{
  provider: 'google',
  providerId: '1234567890', // Google's unique ID for this user
  email: 'user@example.com',
  emailVerified: true,
  firstName: 'John',
  lastName: 'Doe',
  profilePicture: 'https://lh3.googleusercontent.com/...',
}
```

**What nauth-toolkit does:**

1. Creates a user record (if first time)
2. Stores the provider ID for future logins
3. Updates profile data (name, picture) if changed
4. Generates JWT tokens just like email/password login

:::tip No Password Required
Social login users don't have a password. If they want to add a password later (to enable direct login), use the `setPassword` service method.
:::

## Security Considerations

<Tabs>
  <TabItem value="state" label="CSRF Protection" default>

All OAuth flows include a `state` parameter to prevent CSRF attacks. nauth-toolkit generates a cryptographically random state token for each login attempt and validates it on callback.

**This protects against:**
• Attackers initiating OAuth flows on behalf of victims
• Session fixation attacks

  </TabItem>
  <TabItem value="token" label="Token Validation">

nauth-toolkit validates all tokens received from providers:
• Signature verification (for JWTs like Apple's)
• Audience and issuer claims
• Expiration time
• Nonce (where applicable)

**You don't need to implement these checks yourself.** The provider packages handle all validation.

  </TabItem>
  <TabItem value="linking" label="Account Linking Safety">

Automatic linking by email only works if:

1. The email is verified by the provider
2. Your configuration enables it

**Example attack scenario prevented:**
• Attacker creates a Facebook account with victim's email (unverified)
• Attacker tries to sign in to your app with Facebook
• nauth-toolkit rejects because Facebook hasn't verified the email
• Victim's account is safe

  </TabItem>
</Tabs>

## Error Handling

Social login can fail for various reasons. nauth-toolkit provides detailed error information:

| Error Code                 | Reason                      | What To Do                                   |
| -------------------------- | --------------------------- | -------------------------------------------- |
| `OAUTH_CALLBACK_ERROR`     | User denied authorization   | Show message: "Authorization was cancelled"  |
| `OAUTH_STATE_MISMATCH`     | CSRF token mismatch         | Retry the flow, possible security issue      |
| `OAUTH_PROVIDER_ERROR`     | Provider returned an error  | Log and show generic error to user           |
| `OAUTH_EMAIL_NOT_VERIFIED` | Provider email not verified | Ask user to verify email with provider first |
| `OAUTH_ACCOUNT_DISABLED`   | User account is disabled    | Contact support                              |

```typescript
try {
  const result = await authService.handleSocialCallback('google', code);
  return result;
} catch (error) {
  if (error.code === 'OAUTH_CALLBACK_ERROR') {
    return { error: 'Authorization was cancelled. Please try again.' };
  }
  // Handle other errors
}
```

## Next Steps

- [MFA](/docs/features/mfa) - Add two-factor authentication
- [Token Delivery](/docs/features/token-delivery) - Choose how to send tokens (JSON, cookies, hybrid)
- [Core Services](/docs/api/core/services/overview) - Learn about all available services
