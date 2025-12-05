# Refresh Token Flow & Session Management

## Overview

Once users authenticate (via email/password or social login), they receive:

- **Access Token**: Short-lived (30s in your config) - used for API requests
- **Refresh Token**: Long-lived (1 day in your config) - used to get new access tokens
- **Session**: Database record tracking the authentication (30 days expiry)

## How It Works

### Initial Authentication

```
User signs in with Google
↓
Backend verifies Google token
↓
Backend creates Session (expires in 30 days)
↓
Backend generates JWT tokens:
  - Access Token (expires in 30s)
  - Refresh Token (expires in 1 day)
↓
Frontend stores both tokens
```

### Daily Usage

```
Access token expires after 30s
↓
Frontend automatically calls /auth/refresh
↓
Backend validates refresh token
↓
Backend generates NEW tokens:
  - New Access Token (30s)
  - New Refresh Token (1 day) [Token Rotation]
↓
Old refresh token is blacklisted
↓
Frontend stores new tokens
```

### Important Points

1. **Users DON'T need to sign in with Google again** as long as:
   - Their refresh token is valid (within 1 day of last refresh)
   - Their session is valid (within 30 days of initial login)
   - They haven't logged out

2. **Token Rotation**: Each refresh gives you a NEW refresh token (1 day expiry from now)
   - If user refreshes every day, they can stay logged in for 30 days
   - If user doesn't use the app for 1 day, their refresh token expires → must re-authenticate

3. **Session Expiry**: The 30-day session is a hard limit
   - Even with active refresh, after 30 days users must re-authenticate
   - This is for security - forces periodic re-authentication

4. **Logout**: Revokes the session immediately
   - All tokens become invalid
   - User must re-authenticate (social login or email/password)

## Your Configuration

```typescript
jwt: {
  accessToken: {
    expiresIn: '30s',  // Very short for testing
  },
  refreshToken: {
    expiresIn: '1d',   // 1 day
    rotation: true,     // New refresh token on each use
  },
}

// Session expires in 30 days (hardcoded in session creation)
```

## Typical Production Settings

```typescript
jwt: {
  accessToken: {
    expiresIn: '15m',  // 15 minutes
  },
  refreshToken: {
    expiresIn: '30d',  // 30 days
    rotation: true,
  },
}

// Session: 90 days
```

## Example Timeline

**Day 0 - User logs in with Google:**

- Session created (expires Day 30)
- Access token (expires in 30s)
- Refresh token (expires Day 1)

**Day 0 - After 30 seconds:**

- Access token expired
- Frontend calls /refresh with refresh token
- New access token (expires in 30s)
- New refresh token (expires Day 1)
- Old refresh token blacklisted

**Day 1 - User opens app:**

- Last refresh token still valid (24 hours haven't passed)
- Frontend calls /refresh
- New tokens issued
- Refresh token now expires Day 2

**Day 30 - Session expires:**

- Even if user has valid refresh token
- Session is expired
- User must re-authenticate with Google

**User doesn't use app for 2 days:**

- Refresh token expired (> 1 day since last refresh)
- Access token expired
- User must re-authenticate with Google

## Security Benefits

1. **Short-lived access tokens** (30s): Minimizes damage if token is stolen
2. **Token rotation**: Old refresh tokens can't be reused (prevents replay attacks)
3. **Session tracking**: Can revoke all user sessions from admin panel
4. **Reuse detection**: If old refresh token is used, all sessions revoked (security breach)

## Recommended for Production

For better UX in production:

- Access token: `15m` (15 minutes)
- Refresh token: `30d` (30 days)
- Session: 90 days

This means users can stay logged in for 90 days with minimal token refreshes, but must re-authenticate every 90 days for security.
