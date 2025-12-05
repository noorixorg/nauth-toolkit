# Adaptive MFA Integration Flow

**Status:** ✅ **COMPLETE** - Phase 5 Integration Done

## Overview

Adaptive MFA is fully integrated into the authentication flow. When `enforcement: 'ADAPTIVE'` is configured, the system automatically evaluates risk factors and determines whether MFA is required, sign-in should be allowed, or sign-in should be blocked.

## Integration Points

### 1. Entry Point: `AuthService.login()`

**Location:** `packages/core/src/services/auth.service.ts` (line 713)

```typescript
// Check if MFA is required for this user and login
const mfaChallenge = await this.challengeHelper.checkMFARequirement(user, clientInfo.deviceToken);
```

**Flow:**
1. User submits login credentials
2. Credentials are validated
3. User is authenticated
4. **Before returning tokens**, `checkMFARequirement()` is called
5. If MFA is required, a challenge response is returned instead of tokens

### 2. Core Integration: `AuthChallengeHelperService.checkMFARequirement()`

**Location:** `packages/core/src/services/auth-challenge-helper.service.ts` (lines 522-594)

This is where adaptive MFA logic is executed:

```typescript
if (enforcement === 'ADAPTIVE') {
  // 1. Check if user is currently blocked
  const blockStatus = await this.adaptiveMFADecisionService.isUserBlocked(user.id);
  if (blockStatus.blocked) {
    throw new NAuthException(SIGNIN_BLOCKED_HIGH_RISK, blockStatus.message);
  }

  // 2. Evaluate risk and make decision
  const decision = await this.adaptiveMFADecisionService.evaluateAdaptiveMFA(user, authMethod);

  // 3. Handle block_signin action
  if (decision.action === 'block_signin') {
    await this.adaptiveMFADecisionService.blockUserSignIn(user, payload);
    throw new NAuthException(SIGNIN_BLOCKED_HIGH_RISK, message);
  }

  // 4. Return MFA requirement based on decision
  return decision.action === 'require_mfa';
}
```

## Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User submits login request                              │
│    POST /auth/login { email, password }                    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AuthService.login()                                      │
│    - Validates credentials                                  │
│    - Authenticates user                                     │
│    - Gets client info (IP, device, location)                │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check pending challenges                                 │
│    - Email verification?                                    │
│    - Phone verification?                                    │
│    - Password change required?                              │
│    If yes → Return challenge response                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. AuthChallengeHelperService.checkMFARequirement()         │
│    - Checks enforcement policy (OPTIONAL/REQUIRED/ADAPTIVE) │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌────────────────────────────────┐
         │ enforcement === 'ADAPTIVE'?   │
         └────────────────────────────────┘
                         │
            ┌─────────────┴─────────────┐
            │                           │
          YES                           NO
            │                           │
            ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ 5a. Adaptive MFA Flow    │  │ 5b. Standard Flow        │
│                          │  │ - OPTIONAL: No MFA       │
│ 1. Check if blocked      │  │ - REQUIRED: Always MFA   │
│ 2. Evaluate risk        │  │                          │
│ 3. Make decision        │  │                          │
└──────────────────────────┘  └──────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. AdaptiveMFADecisionService.evaluateAdaptiveMFA()          │
│                                                              │
│    a. RiskDetectionService.detectRiskFactors()               │
│       - new_device?                                          │
│       - new_ip? (skipped if new_country detected)           │
│       - new_country?                                         │
│       - impossible_travel?                                  │
│       - suspicious_activity?                                │
│                                                              │
│    b. RiskScoringService.calculateRiskScore()               │
│       - Sum weights of detected factors                     │
│       - Classify as low/medium/high                        │
│                                                              │
│    c. Determine action based on riskLevels config           │
│       - low (0-20): action = 'allow'                       │
│       - medium (21-50): action = 'require_mfa'            │
│       - high (51-100): action = 'require_mfa' or           │
│                        'block_signin'                       │
│                                                              │
│    d. Call lifecycle hooks (if notifyUser = true)          │
│       - onAdaptiveMFATriggered()                            │
│                                                              │
│    e. Record audit event                                    │
│                                                              │
│    Returns: { action, riskScore, riskLevel, riskFactors }  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
         ┌──────────────────┐
         │ action value?    │
         └──────────────────┘
            │
    ┌───────┼───────┐
    │       │       │
  'allow'  'require_mfa'  'block_signin'
    │       │       │
    │       │       ▼
    │       │  ┌─────────────────────────────────┐
    │       │  │ Block user sign-in              │
    │       │  │ - Store block in storage        │
    │       │  │ - Call onSignInBlocked hook      │
    │       │  │ - Throw SIGNIN_BLOCKED error     │
    │       │  └─────────────────────────────────┘
    │       │
    │       ▼
    │  ┌─────────────────────────────────┐
    │  │ Return MFA challenge response   │
    │  │ - challengeName: MFA_REQUIRED    │
    │  │ - challengeSession token        │
    │  │ - availableMethods              │
    │  └─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Return tokens (no MFA required)                         │
│    { accessToken, refreshToken, user }                      │
└─────────────────────────────────────────────────────────────┘
```

## Decision Logic

### Action: `allow`
- **Returns:** `false` (MFA not required)
- **Result:** User receives tokens immediately, no MFA challenge
- **Use Case:** Low risk (trusted device, known location, no suspicious activity)

### Action: `require_mfa`
- **Returns:** `true` (MFA required)
- **Result:** User receives MFA challenge response
- **User must:** Complete MFA verification (TOTP, SMS, Passkey)
- **After MFA:** User receives tokens
- **Use Case:** Medium/high risk (new device, new location, suspicious activity)

### Action: `block_signin`
- **Throws:** `NAuthException` with `SIGNIN_BLOCKED_HIGH_RISK`
- **Result:** Sign-in attempt is rejected
- **User receives:** Error message (configurable)
- **Block stored:** In storage adapter with optional TTL
- **Use Case:** Very high risk (impossible travel, multiple suspicious factors)

## Configuration Required

To enable adaptive MFA:

```typescript
{
  mfa: {
    enabled: true,
    enforcement: 'ADAPTIVE', // 👈 Enable adaptive MFA
    adaptive: {
      triggers: ['new_device', 'new_ip', 'new_country', 'impossible_travel', 'suspicious_activity'],
      riskLevels: {
        low: { maxScore: 20, action: 'allow', notifyUser: false },
        medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
        high: { maxScore: 100, action: 'require_mfa', notifyUser: true },
      },
    },
  },
}
```

## Service Dependencies

The adaptive MFA services are automatically provided by `AuthModule` when:
- `enforcement: 'ADAPTIVE'` is configured
- Services are registered in `packages/nestjs/src/auth.module.ts`

**Required Services:**
- `RiskDetectionService` - Requires SessionRepository, AuthAuditRepository
- `RiskScoringService` - No additional dependencies
- `AdaptiveMFADecisionService` - Requires all above + StorageAdapter, ClientInfoService, AuthAuditService

## Lifecycle Hooks

### `onAdaptiveMFATriggered`
**Called when:** Risk is detected and `notifyUser: true` in risk level config
**Payload includes:**
- User info (sub, email, username, phone)
- Risk assessment (score, level, factors)
- Action that will be taken
- Client context (IP, location, device)
- Auth method and timestamp

**Can override:** Return `false` to allow sign-in despite risk

### `onSignInBlocked`
**Called when:** Action is `block_signin`
**Payload includes:** Same as `onAdaptiveMFATriggered` plus:
- Block duration (if temporary)
- Block expiration time
- Custom message

**Use cases:**
- Send security alerts to user
- Log to SIEM system
- Trigger fraud investigation workflow

## Audit Trail Integration

All adaptive MFA decisions are automatically recorded in the audit trail:

```typescript
{
  userId: user.id,
  eventType: AuthAuditEventType.LOGIN_SUCCESS,
  eventStatus: action === 'block_signin' ? 'FAILURE' : 'INFO',
  riskFactor: riskScore, // 0-100
  riskFactors: ['new_device', 'new_country'], // Array of detected factors
  adaptiveMfaTriggered: action !== 'allow', // Boolean
  description: 'Adaptive MFA: require_mfa (score: 35, level: medium)',
  // ... full client context
}
```

## Testing the Integration

To verify adaptive MFA is working:

1. **Enable adaptive MFA:**
   ```typescript
   mfa: { enforcement: 'ADAPTIVE', adaptive: { ... } }
   ```

2. **Login from new device/IP:**
   - Should trigger MFA challenge
   - Check logs for: `ADAPTIVE MFA decision: user=..., score=..., level=..., action=...`

3. **Login from known device/location:**
   - Should allow immediate sign-in (no MFA)
   - Check logs for: `action=allow, requiresMFA=false`

4. **Check audit trail:**
   ```sql
   SELECT riskFactor, riskFactors, adaptiveMfaTriggered
   FROM auth_audit
   WHERE userId = ?
   ORDER BY createdAt DESC;
   ```

## Summary

✅ **Phase 5 Integration Complete:**
- ✅ Integrated into `AuthChallengeHelperService.checkMFARequirement()`
- ✅ Called automatically during login flow
- ✅ Handles all three actions (allow, require_mfa, block_signin)
- ✅ Records decisions in audit trail
- ✅ Calls lifecycle hooks for notifications
- ✅ No manual intervention needed - fully automatic

**Trigger:** Automatically triggered when `enforcement: 'ADAPTIVE'` and user successfully authenticates during login.

