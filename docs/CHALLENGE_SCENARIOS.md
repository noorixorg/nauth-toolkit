# Challenge Flow Scenarios

## Challenge Priority Order

1. **FORCE_CHANGE_PASSWORD** (if `user.mustChangePassword = true`)
2. **VERIFY_EMAIL** (if required and not verified)
3. **VERIFY_PHONE** (if required and not verified)
4. **MFA_SETUP_REQUIRED** (if enforcement = REQUIRED/ADAPTIVE and grace period expired)
5. **MFA_REQUIRED** (if MFA enabled and verification needed)

---

## Signup Scenarios

### MFA OPTIONAL

| Verification Method | User State | Flow                                             |
| ------------------- | ---------- | ------------------------------------------------ |
| `none`              | New user   | `Signup → SUCCESS`                               |
| `email`             | New user   | `Signup → VERIFY_EMAIL → SUCCESS`                |
| `phone`             | New user   | `Signup → VERIFY_PHONE → SUCCESS`                |
| `both`              | New user   | `Signup → VERIFY_EMAIL → VERIFY_PHONE → SUCCESS` |

**Note**: MFA OPTIONAL means users can enable MFA voluntarily. No enforcement during signup or login.

---

### MFA REQUIRED

| Verification Method | Grace Period | User State | Flow                                                                                      |
| ------------------- | ------------ | ---------- | ----------------------------------------------------------------------------------------- |
| `none`              | 0 days       | New user   | `Signup → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                                    |
| `none`              | 7 days       | New user   | `Signup → SUCCESS` (MFA setup optional during grace period)                               |
| `email`             | 0 days       | New user   | `Signup → VERIFY_EMAIL → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                     |
| `email`             | 7 days       | New user   | `Signup → VERIFY_EMAIL → SUCCESS` (MFA setup optional during grace period)                |
| `phone`             | 0 days       | New user   | `Signup → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                     |
| `phone`             | 7 days       | New user   | `Signup → VERIFY_PHONE → SUCCESS` (MFA setup optional during grace period)                |
| `both`              | 0 days       | New user   | `Signup → VERIFY_EMAIL → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`      |
| `both`              | 7 days       | New user   | `Signup → VERIFY_EMAIL → VERIFY_PHONE → SUCCESS` (MFA setup optional during grace period) |

**Note**:

- `gracePeriod = 0`: MFA setup enforced immediately after signup
- `gracePeriod > 0`: User can complete signup without MFA setup. MFA setup is optional (if app offers it). On subsequent logins, grace period is checked (see Login Scenarios)

---

### MFA ADAPTIVE

| Verification Method | Grace Period | User State | Flow                                                                                      |
| ------------------- | ------------ | ---------- | ----------------------------------------------------------------------------------------- |
| `none`              | 0 days       | New user   | `Signup → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                                    |
| `none`              | 7 days       | New user   | `Signup → SUCCESS` (MFA setup optional during grace period)                               |
| `email`             | 0 days       | New user   | `Signup → VERIFY_EMAIL → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                     |
| `email`             | 7 days       | New user   | `Signup → VERIFY_EMAIL → SUCCESS` (MFA setup optional during grace period)                |
| `phone`             | 0 days       | New user   | `Signup → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                     |
| `phone`             | 7 days       | New user   | `Signup → VERIFY_PHONE → SUCCESS` (MFA setup optional during grace period)                |
| `both`              | 0 days       | New user   | `Signup → VERIFY_EMAIL → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`      |
| `both`              | 7 days       | New user   | `Signup → VERIFY_EMAIL → VERIFY_PHONE → SUCCESS` (MFA setup optional during grace period) |

**Note**:

- `gracePeriod = 0`: MFA setup enforced immediately after signup
- `gracePeriod > 0`: User can complete signup without MFA setup. MFA setup is optional (if app offers it). On subsequent logins, grace period is checked (see Login Scenarios)
- Verification uses risk-based evaluation (after MFA is set up)

---

## Login Scenarios

### MFA OPTIONAL

| User State                  | Device Trust                                  | Flow                                                     |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| MFA not enabled             | Any                                           | `Login → SUCCESS`                                        |
| MFA enabled                 | Trusted, `bypassMFAForTrustedDevices = true`  | `Login → SUCCESS`                                        |
| MFA enabled                 | Trusted, `bypassMFAForTrustedDevices = false` | `Login → MFA_REQUIRED → SUCCESS`                         |
| MFA enabled                 | Untrusted                                     | `Login → MFA_REQUIRED → SUCCESS`                         |
| `mustChangePassword = true` | Any                                           | `Login → FORCE_CHANGE_PASSWORD → [continue normal flow]` |
| `mfaExempt = true`          | Any                                           | `Login → SUCCESS` (all MFA checks bypassed)              |

**Note**: MFA OPTIONAL means MFA is only required if user has already enabled it.

---

### MFA REQUIRED

| User State                  | Grace Period | Device Trust                                  | Flow                                                     |
| --------------------------- | ------------ | --------------------------------------------- | -------------------------------------------------------- |
| MFA not enabled             | 0 days       | Any                                           | `Login → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`    |
| MFA not enabled             | 7 days       | Any                                           | `Login → SUCCESS` (grace period active)                  |
| MFA enabled                 | Any          | Trusted, `bypassMFAForTrustedDevices = true`  | `Login → SUCCESS`                                        |
| MFA enabled                 | Any          | Trusted, `bypassMFAForTrustedDevices = false` | `Login → MFA_REQUIRED → SUCCESS`                         |
| MFA enabled                 | Any          | Untrusted                                     | `Login → MFA_REQUIRED → SUCCESS`                         |
| `mustChangePassword = true` | Any          | Any                                           | `Login → FORCE_CHANGE_PASSWORD → [continue normal flow]` |
| `mfaExempt = true`          | Any          | Any                                           | `Login → SUCCESS` (all MFA checks bypassed)              |

**Note**:

- `gracePeriod = 0`: MFA setup enforced immediately on login
- `gracePeriod > 0`: User can login without MFA during grace period. After grace period expires, `MFA_SETUP_REQUIRED` triggers on next login
- Grace period is calculated from account creation date (`user.createdAt`)
- If user becomes `mfaExempt` during grace period, MFA setup requirement is permanently bypassed

---

### MFA ADAPTIVE

| User State                  | Grace Period | Device Trust | Risk Level       | Flow                                                     | Response Includes                    |
| --------------------------- | ------------ | ------------ | ---------------- | -------------------------------------------------------- | ------------------------------------ |
| MFA not enabled             | 0 days       | Any          | Any              | `Login → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`    | -                                    |
| MFA not enabled             | 7 days       | Any          | Low              | `Login → SUCCESS` (grace period active, risk logged)     | `gracePeriodEndsAt` (time remaining) |
| MFA not enabled             | 7 days       | Any          | Medium           | `Login → SUCCESS` (grace period active, risk logged)     | `gracePeriodEndsAt`, `riskScore`     |
| MFA not enabled             | 7 days       | Any          | High             | `Login → SUCCESS` (grace period active, risk logged)     | `gracePeriodEndsAt`, `riskScore`     |
| MFA not enabled             | 7 days       | Any          | Very High, Block | `Login → BLOCKED` (blocked despite grace period)         | `blockedUntil`                       |
| MFA enabled                 | Any          | Trusted      | Low (0-20)       | `Login → SUCCESS`                                        | -                                    |
| MFA enabled                 | Any          | Trusted      | Medium (21-50)   | `Login → MFA_REQUIRED → SUCCESS`                         | -                                    |
| MFA enabled                 | Any          | Trusted      | High (51-100)    | `Login → MFA_REQUIRED → SUCCESS`                         | -                                    |
| MFA enabled                 | Any          | Trusted      | Very High, Block | `Login → BLOCKED`                                        | `blockedUntil`                       |
| MFA enabled                 | Any          | Untrusted    | Any              | `Login → MFA_REQUIRED → SUCCESS` (always required)       | -                                    |
| `mustChangePassword = true` | Any          | Any          | Any              | `Login → FORCE_CHANGE_PASSWORD → [continue normal flow]` | -                                    |
| `mfaExempt = true`          | Any          | Any          | Any              | `Login → SUCCESS` (all MFA checks bypassed)              | -                                    |

**Note**:

- Untrusted devices always require MFA (regardless of risk)
- Trusted devices use risk-based evaluation
- Very high risk can block sign-in (even during grace period)
- **Grace period + MFA not enabled**: Risk score is logged but MFA cannot be enforced. Response includes `gracePeriodEndsAt` timestamp
- Grace period applies to MFA setup requirement (calculated from `user.createdAt`)
- If user becomes `mfaExempt` during grace period, MFA setup requirement is permanently bypassed

---

## Social Login Scenarios

### `requireForSocialLogin = false` (Default)

| Verification Method | User State                        | Flow                                                         |
| ------------------- | --------------------------------- | ------------------------------------------------------------ |
| `none`              | New/Existing                      | `Social Login → SUCCESS`                                     |
| `email`             | New/Existing                      | `Social Login → SUCCESS` (email pre-verified by OAuth)       |
| `phone`             | New user, no phone                | `Social Login → VERIFY_PHONE → SUCCESS`                      |
| `phone`             | Existing user, phone not verified | `Social Login → VERIFY_PHONE → SUCCESS`                      |
| `both`              | New user, no phone                | `Social Login → VERIFY_PHONE → SUCCESS` (email pre-verified) |
| `both`              | Existing user, phone not verified | `Social Login → VERIFY_PHONE → SUCCESS` (email pre-verified) |
| Any                 | `mfaExempt = true`                | `Social Login → SUCCESS` (all MFA checks bypassed)           |

**Note**: MFA is completely skipped for social login when `requireForSocialLogin = false`.

---

### `requireForSocialLogin = true`

#### MFA OPTIONAL

| Verification Method | User State         | Flow                                                   |
| ------------------- | ------------------ | ------------------------------------------------------ |
| `none`              | MFA not enabled    | `Social Login → SUCCESS`                               |
| `none`              | MFA enabled        | `Social Login → MFA_REQUIRED → SUCCESS`                |
| `phone`             | MFA not enabled    | `Social Login → VERIFY_PHONE → SUCCESS`                |
| `phone`             | MFA enabled        | `Social Login → VERIFY_PHONE → MFA_REQUIRED → SUCCESS` |
| Any                 | `mfaExempt = true` | `Social Login → SUCCESS` (all MFA checks bypassed)     |

#### MFA REQUIRED

| Verification Method | Grace Period | User State         | Flow                                                                              |
| ------------------- | ------------ | ------------------ | --------------------------------------------------------------------------------- |
| `none`              | 0 days       | MFA not enabled    | `Social Login → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                      |
| `none`              | 7 days       | MFA not enabled    | `Social Login → SUCCESS` (grace period active)                                    |
| `none`              | Any          | MFA enabled        | `Social Login → MFA_REQUIRED → SUCCESS`                                           |
| `phone`             | 0 days       | MFA not enabled    | `Social Login → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`       |
| `phone`             | 7 days       | MFA not enabled    | `Social Login → VERIFY_PHONE → SUCCESS` (grace period active, MFA setup optional) |
| `phone`             | Any          | MFA enabled        | `Social Login → VERIFY_PHONE → MFA_REQUIRED → SUCCESS`                            |
| Any                 | Any          | `mfaExempt = true` | `Social Login → SUCCESS` (all MFA checks bypassed)                                |

#### MFA ADAPTIVE

| Verification Method | Grace Period | User State         | Device Trust | Risk Level  | Flow                                                                                          |
| ------------------- | ------------ | ------------------ | ------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `none`              | 0 days       | MFA not enabled    | Any          | Any         | `Social Login → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                                  |
| `none`              | 7 days       | MFA not enabled    | Any          | Any         | `Social Login → SUCCESS` (grace period active, MFA setup optional, risk logged if applicable) |
| `none`              | Any          | MFA enabled        | Trusted      | Low         | `Social Login → SUCCESS`                                                                      |
| `none`              | Any          | MFA enabled        | Trusted      | Medium/High | `Social Login → MFA_REQUIRED → SUCCESS`                                                       |
| `none`              | Any          | MFA enabled        | Untrusted    | Any         | `Social Login → MFA_REQUIRED → SUCCESS`                                                       |
| `phone`             | 0 days       | MFA not enabled    | Any          | Any         | `Social Login → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS`                   |
| `phone`             | 7 days       | MFA not enabled    | Any          | Any         | `Social Login → VERIFY_PHONE → SUCCESS` (grace period active)                                 |
| `phone`             | Any          | MFA enabled        | Trusted      | Low         | `Social Login → VERIFY_PHONE → SUCCESS`                                                       |
| `phone`             | Any          | MFA enabled        | Trusted      | Medium/High | `Social Login → VERIFY_PHONE → MFA_REQUIRED → SUCCESS`                                        |
| `phone`             | Any          | MFA enabled        | Untrusted    | Any         | `Social Login → VERIFY_PHONE → MFA_REQUIRED → SUCCESS`                                        |
| Any                 | Any          | `mfaExempt = true` | Any          | Any         | `Social Login → SUCCESS` (all MFA checks bypassed)                                            |

---

## Grace Period Behavior

### During Signup

- `gracePeriod = 0`: MFA setup is required immediately after verification challenges complete
- `gracePeriod > 0`: User can complete signup without MFA setup. MFA setup is optional (consumer app can offer it, but not required as part of challenge flow)

### During Login

- `gracePeriod = 0`: MFA setup is required immediately if user hasn't set up MFA
- `gracePeriod > 0`:
  - If grace period is still active (based on `user.createdAt`): User can login without MFA setup
  - If grace period has expired: `MFA_SETUP_REQUIRED` triggers on login
  - Grace period check happens on every login attempt
  - **ADAPTIVE mode**: If grace period is active and MFA not enabled, risk score is logged but MFA cannot be enforced. Response includes `gracePeriodEndsAt` timestamp
  - **Response field**: Login response includes `gracePeriodEndsAt` (timestamp) when grace period is active, allowing frontend to show countdown

### Grace Period Exemption

- If user becomes `mfaExempt = true` during grace period, MFA setup requirement is permanently bypassed
- Exemption can be granted at any time (during or after grace period)
- Once exempt, user never needs to set up MFA (unless exemption is revoked)

---

## Special Cases

### Phone Collection During Verification

| Scenario                                               | Flow                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| User has no phone, `verificationMethod = 'phone'`      | `VERIFY_PHONE (collect phone) → VERIFY_PHONE (verify code) → [continue]`                |
| User has no phone, `verificationMethod = 'both'`       | `VERIFY_EMAIL → VERIFY_PHONE (collect phone) → VERIFY_PHONE (verify code) → [continue]` |
| Social login, no phone, `verificationMethod = 'phone'` | `VERIFY_PHONE (collect phone) → VERIFY_PHONE (verify code) → SUCCESS`                   |

---

### Phone Verification via MFA SMS

| Scenario                                             | Behavior                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `verificationMethod = 'none'`, User sets up SMS MFA  | SMS MFA verification automatically verifies phone number in directory |
| `verificationMethod = 'email'`, User sets up SMS MFA | SMS MFA verification automatically verifies phone number in directory |
| User completes SMS MFA verification                  | `user.isPhoneVerified = true` (phone verified through MFA)            |

**Note**: When phone verification is disabled (`verificationMethod = 'none'` or `'email'`), but user sets up SMS MFA, completing SMS MFA verification will mark the phone as verified in the user directory.

---

### Phone Already Verified - SMS MFA Setup

| Scenario                                                                           | Behavior                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Phone already verified, user sets up SMS MFA                                       | MFA setup auto-completes (no SMS challenge). User will be required to use SMS verification on **next login** (based on flow settings) |
| Phone verified via `VERIFY_PHONE`, user immediately sets SMS MFA                   | MFA setup auto-completes (no SMS challenge). Improves UX - avoids asking for SMS code immediately after phone verification            |
| Phone verified, SMS MFA setup, next login with `enforcement = REQUIRED`            | `Login → MFA_REQUIRED` (SMS verification required)                                                                                    |
| Phone verified, SMS MFA setup, next login with `enforcement = ADAPTIVE`, low risk  | `Login → SUCCESS` (no MFA required)                                                                                                   |
| Phone verified, SMS MFA setup, next login with `enforcement = ADAPTIVE`, high risk | `Login → MFA_REQUIRED` (SMS verification required)                                                                                    |

**Note**: If phone is already verified when user sets up SMS MFA, the setup challenge auto-completes. This improves UX by avoiding redundant SMS verification immediately after phone verification. User will be required to use SMS MFA on subsequent logins based on enforcement settings.

---

## Device Trust Behavior

| Config                               | Behavior                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| `rememberDevices = 'never'`          | No device trust feature. MFA always required (if enabled).        |
| `rememberDevices = 'always'`         | Devices automatically trusted after successful login.             |
| `rememberDevices = 'user_opt_in'`    | User must explicitly call trust-device endpoint.                  |
| `bypassMFAForTrustedDevices = true`  | Trusted devices can skip MFA (except ADAPTIVE untrusted devices). |
| `bypassMFAForTrustedDevices = false` | MFA still required even for trusted devices.                      |

**Note**: ADAPTIVE mode always requires MFA for untrusted devices, regardless of `bypassMFAForTrustedDevices` setting.

---

## Challenge Completion Flow

After completing any challenge, flow re-evaluates from priority 1:

| Completed Challenge     | Re-evaluation Flow                                                               |
| ----------------------- | -------------------------------------------------------------------------------- |
| `FORCE_CHANGE_PASSWORD` | Check: VERIFY_EMAIL → VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS |
| `VERIFY_EMAIL`          | Check: VERIFY_PHONE → MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS                |
| `VERIFY_PHONE`          | Check: MFA_SETUP_REQUIRED → MFA_REQUIRED → SUCCESS                               |
| `MFA_SETUP_REQUIRED`    | Check: MFA_REQUIRED → SUCCESS                                                    |
| `MFA_REQUIRED`          | SUCCESS                                                                          |

---

## Summary: All Possible Challenge Sequences

1. `FORCE_CHANGE_PASSWORD` → [re-evaluate]
2. `VERIFY_EMAIL` → [re-evaluate]
3. `VERIFY_PHONE` → [re-evaluate]
4. `MFA_SETUP_REQUIRED` → [re-evaluate]
5. `MFA_REQUIRED` → SUCCESS
6. `SUCCESS` (no challenges)

**Note**: After each challenge completion, flow re-evaluates from step 1.
