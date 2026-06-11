# MFA Flow Scenarios

This document outlines the expected behavior for different authentication configuration scenarios with comprehensive state diagrams.

## Configuration Options

### Verification Methods

- `none`: No email or phone verification required
- `email`: Email verification required
- `phone`: Phone verification required
- `both`: Both email and phone verification required

### MFA Enforcement

- `OPTIONAL`: MFA setup is optional, but if user enables it, MFA is required on login
- `REQUIRED`: All users must setup MFA (can be disabled if `mfa.enabled: false`)
- `ADAPTIVE`: MFA required based on risk factors (currently behaves like REQUIRED)
- `DISABLED`: MFA is completely disabled (`mfa.enabled: false`) - only email/phone verification and password change challenges apply

## Comprehensive State Diagrams

### 1. Unauthenticated Flow (Signup)

```mermaid
stateDiagram-v2
    [*] --> Signup: User signs up

    state "Verification Phase" as VerificationPhase {
        state "Email Verification" as EmailVerificationGroup {
            EmailVerification
            ResendEmailCode
            EmailVerification --> ResendEmailCode: Click resend
            ResendEmailCode --> EmailVerification: Code sent
        }

        state "Phone Verification" as PhoneVerificationGroup {
            PhoneVerification
            ResendPhoneCode
            PhoneVerification --> ResendPhoneCode: Click resend
            ResendPhoneCode --> PhoneVerification: Code sent
        }

        Signup --> EmailVerificationGroup: verificationMethod email/both
        Signup --> PhoneVerificationGroup: verificationMethod phone
        Signup --> MfaSelector: verificationMethod none

        EmailVerificationGroup --> PhoneVerificationGroup: verificationMethod both
        EmailVerificationGroup --> MfaSelector: Email verified MFA required
        EmailVerificationGroup --> Dashboard: Email verified no MFA

        PhoneVerificationGroup --> MfaSelector: Phone verified MFA required
        PhoneVerificationGroup --> Dashboard: Phone verified no MFA
    }

    state "MFA Setup Phase" as MfaPhase {
        state "Direct MFA Methods" as DirectMethods {
            TOTPSetup
            PasskeySetup
            TOTPSetup --> MfaSelector: Back
            TOTPSetup --> Dashboard: Complete
            PasskeySetup --> MfaSelector: Back
            PasskeySetup --> Dashboard: Complete
        }

        state "SMS MFA Flow" as SMSFlow {
            SMSSetup
            AutoCompletedSuccessSMS
            state "SMS OTP Verification" as SMSOTP {
                OTPVerifySMS
                ResendSMSCode
                OTPVerifySMS --> ResendSMSCode: Click resend
                ResendSMSCode --> OTPVerifySMS: New code + toast
            }
            SMSSetup --> AutoCompletedSuccessSMS: Phone verified
            SMSSetup --> SMSOTP: Phone not verified
            SMSOTP --> MfaSelector: Back
            SMSOTP --> Dashboard: Verified
            AutoCompletedSuccessSMS --> Dashboard: Continue
        }

        state "Email MFA Flow" as EmailFlow {
            EmailMFASetup
            AutoCompletedSuccessEmail
            state "Email OTP Verification" as EmailOTP {
                OTPVerifyEmail
                ResendEmailMFACode
                OTPVerifyEmail --> ResendEmailMFACode: Click resend
                ResendEmailMFACode --> OTPVerifyEmail: New code + toast
            }
            EmailMFASetup --> AutoCompletedSuccessEmail: Email verified
            EmailMFASetup --> EmailOTP: Email not verified
            EmailOTP --> MfaSelector: Back
            EmailOTP --> Dashboard: Verified
            AutoCompletedSuccessEmail --> Dashboard: Continue
        }

        MfaSelector --> DirectMethods: Select TOTP/Passkey
        MfaSelector --> SMSFlow: Select SMS
        MfaSelector --> EmailFlow: Select Email
        MfaSelector --> Dashboard: Skip (optional)
    }

    Dashboard --> [*]
```

### 2. Login Flow (Authenticated)

```mermaid
stateDiagram-v2
    [*] --> Login: User logs in

    state "Verification Phase" as LoginVerification {
        state "Email Verification" as EmailVerificationLoginGroup {
            EmailVerificationLogin
            ResendEmailCodeLogin
            EmailVerificationLogin --> ResendEmailCodeLogin: Click resend
            ResendEmailCodeLogin --> EmailVerificationLogin: Code sent
        }

        state "Phone Verification" as PhoneVerificationLoginGroup {
            PhoneVerificationLogin
            ResendPhoneCodeLogin
            PhoneVerificationLogin --> ResendPhoneCodeLogin: Click resend
            ResendPhoneCodeLogin --> PhoneVerificationLogin: Code sent
        }

        Login --> EmailVerificationLoginGroup: Email invalidated
        Login --> PhoneVerificationLoginGroup: Phone invalidated
        Login --> MfaSetupRequired: MFA required but not setup
        Login --> MfaRequired: MFA enabled
        Login --> Dashboard: All verified no MFA

        EmailVerificationLoginGroup --> PhoneVerificationLoginGroup: Phone invalidated
        EmailVerificationLoginGroup --> MfaSetupRequired: MFA required but not setup
        EmailVerificationLoginGroup --> MfaRequired: MFA enabled
        EmailVerificationLoginGroup --> Dashboard: No MFA

        PhoneVerificationLoginGroup --> MfaSetupRequired: MFA required but not setup
        PhoneVerificationLoginGroup --> MfaRequired: MFA enabled
        PhoneVerificationLoginGroup --> Dashboard: No MFA
    }

    state "MFA Setup Required" as MfaSetupRequiredState {
        MfaSetupRequired
    }

    state "MFA Verification Phase" as MfaVerification {
        state "Direct MFA Methods" as DirectVerifyMethods {
            TOTPVerify
            PasskeyVerify
            TOTPVerify --> MfaSelectorLogin: Back
            TOTPVerify --> Dashboard: Verified
            PasskeyVerify --> MfaSelectorLogin: Back
            PasskeyVerify --> Dashboard: Verified
        }

        state "SMS Verification" as SMSVerifyGroup {
            SMSVerify
            ResendSMSCodeLogin
            SMSVerify --> ResendSMSCodeLogin: Click resend
            ResendSMSCodeLogin --> SMSVerify: New code + toast
            SMSVerify --> MfaSelectorLogin: Back
            SMSVerify --> Dashboard: Verified
        }

        state "Email Verification" as EmailVerifyGroup {
            EmailMFAVerify
            ResendEmailMFACodeLogin
            EmailMFAVerify --> ResendEmailMFACodeLogin: Click resend
            ResendEmailMFACodeLogin --> EmailMFAVerify: New code + toast
            EmailMFAVerify --> MfaSelectorLogin: Back
            EmailMFAVerify --> Dashboard: Verified
        }

        MfaRequired --> DirectVerifyMethods: Preferred TOTP/Passkey
        MfaRequired --> SMSVerifyGroup: Preferred SMS (code sent)
        MfaRequired --> EmailVerifyGroup: Preferred Email (code sent)
        MfaRequired --> MfaSelectorLogin: No preferred

        MfaSelectorLogin --> DirectVerifyMethods: Select TOTP/Passkey
        MfaSelectorLogin --> SMSVerifyGroup: Select SMS (code sent)
        MfaSelectorLogin --> EmailVerifyGroup: Select Email (code sent)
    }

    MfaSetupRequiredState --> Dashboard: Setup complete

    Dashboard --> [*]
```

### 3. Dashboard Flow (Manual Authenticated - Adding MFA)

```mermaid
stateDiagram-v2
    [*] --> Dashboard: User on dashboard

    state "MFA Enrollment Phase" as DashboardMfa {
        state "Direct MFA Methods" as DirectMethodsDashboard {
            TOTPSetupDashboard
            PasskeySetupDashboard
            TOTPSetupDashboard --> MfaSelectorDashboard: Back
            TOTPSetupDashboard --> Dashboard: Complete
            PasskeySetupDashboard --> MfaSelectorDashboard: Back
            PasskeySetupDashboard --> Dashboard: Complete
        }

        state "SMS MFA Flow" as SMSFlowDashboard {
            SMSSetupDashboard
            AutoCompletedSuccessSMSDashboard
            state "SMS OTP Verification" as SMSOTPDashboard {
                OTPVerifySMSDashboard
                ResendSMSCodeDashboard
                OTPVerifySMSDashboard --> ResendSMSCodeDashboard: Click resend
                ResendSMSCodeDashboard --> OTPVerifySMSDashboard: New code + toast
            }
            SMSSetupDashboard --> AutoCompletedSuccessSMSDashboard: Phone verified
            SMSSetupDashboard --> SMSOTPDashboard: Phone not verified
            SMSOTPDashboard --> MfaSelectorDashboard: Back
            SMSOTPDashboard --> Dashboard: Verified
            AutoCompletedSuccessSMSDashboard --> Dashboard: Continue
        }

        state "Email MFA Flow" as EmailFlowDashboard {
            EmailMFASetupDashboard
            AutoCompletedSuccessEmailDashboard
            state "Email OTP Verification" as EmailOTPDashboard {
                OTPVerifyEmailDashboard
                ResendEmailMFACodeDashboard
                OTPVerifyEmailDashboard --> ResendEmailMFACodeDashboard: Click resend
                ResendEmailMFACodeDashboard --> OTPVerifyEmailDashboard: New code + toast
            }
            EmailMFASetupDashboard --> AutoCompletedSuccessEmailDashboard: Email verified
            EmailMFASetupDashboard --> EmailOTPDashboard: Email not verified
            EmailOTPDashboard --> MfaSelectorDashboard: Back
            EmailOTPDashboard --> Dashboard: Verified
            AutoCompletedSuccessEmailDashboard --> Dashboard: Continue
        }

        Dashboard --> MfaSelectorDashboard: Add MFA Method

        MfaSelectorDashboard --> DirectMethodsDashboard: Select TOTP/Passkey
        MfaSelectorDashboard --> SMSFlowDashboard: Select SMS
        MfaSelectorDashboard --> EmailFlowDashboard: Select Email
        MfaSelectorDashboard --> Dashboard: Back
    }

    Dashboard --> [*]
```

### 4. MFA Disabled Flow (Signup) - `mfa.enabled: false`

```mermaid
stateDiagram-v2
    [*] --> Signup: User signs up

    state "Verification Phase" as VerificationPhase {
        state "Email Verification" as EmailVerification {
            EmailVerificationState
            ResendEmailCode
            EmailVerificationState --> ResendEmailCode: Click resend
            ResendEmailCode --> EmailVerificationState: Code sent
        }

        state "Phone Verification" as PhoneVerification {
            PhoneVerificationState
            ResendPhoneCode
            PhoneVerificationState --> ResendPhoneCode: Click resend
            ResendPhoneCode --> PhoneVerificationState: Code sent
        }

        Signup --> EmailVerification: verificationMethod email/both
        Signup --> PhoneVerification: verificationMethod phone
        Signup --> Dashboard: No verification required

        EmailVerification --> PhoneVerification: verificationMethod both
        EmailVerification --> Dashboard: Email verified

        PhoneVerification --> Dashboard: Phone verified
    }

    Dashboard --> [*]
```

### 5. MFA Disabled Flow (Login) - `mfa.enabled: false`

```mermaid
stateDiagram-v2
    [*] --> Login: User logs in

    state "Challenge Phase" as LoginChallenge {
        state "Password Change Challenge" as PasswordChangeChallenge {
            MustChangePassword
            PasswordChangeForm
            MustChangePassword --> PasswordChangeForm: User must change password
            PasswordChangeForm --> MustChangePassword: Validation error
            PasswordChangeForm --> EmailVerificationLogin: Password changed
            PasswordChangeForm --> PhoneVerificationLogin: Password changed
            PasswordChangeForm --> Dashboard: Password changed
        }

        state "Email Verification" as EmailVerificationLogin {
            EmailVerificationLoginState
            ResendEmailCodeLogin
            EmailVerificationLoginState --> ResendEmailCodeLogin: Click resend
            ResendEmailCodeLogin --> EmailVerificationLoginState: Code sent
        }

        state "Phone Verification" as PhoneVerificationLogin {
            PhoneVerificationLoginState
            ResendPhoneCodeLogin
            PhoneVerificationLoginState --> ResendPhoneCodeLogin: Click resend
            ResendPhoneCodeLogin --> PhoneVerificationLoginState: Code sent
        }

        Login --> PasswordChangeChallenge: Password change required
        Login --> EmailVerificationLogin: Email invalidated
        Login --> PhoneVerificationLogin: Phone invalidated
        Login --> Dashboard: All verified

        PasswordChangeChallenge --> EmailVerificationLogin: Email invalidated
        PasswordChangeChallenge --> PhoneVerificationLogin: Phone invalidated
        PasswordChangeChallenge --> Dashboard: No verification required

        EmailVerificationLogin --> PhoneVerificationLogin: Phone invalidated
        EmailVerificationLogin --> Dashboard: Email verified

        PhoneVerificationLogin --> Dashboard: Phone verified
    }

    Dashboard --> [*]
```

### 6. Social Authentication Flow (OAuth - Google/Apple/Facebook)

**Note:** Social signup and login use the **same flow** - both go through the challenge system identically. Social users don't have passwords, so password change challenges don't apply.

```mermaid
stateDiagram-v2
    [*] --> SocialAuth: User signs up/logs in via OAuth

    state "Challenge Phase" as SocialChallengePhase {
        state "Phone Collection" as PhoneCollection {
            PhoneEntryForm
            PhoneEntryForm --> PhoneVerificationSocial: Phone submitted via API
        }

        state "Phone Verification" as PhoneVerificationSocial {
            PhoneVerificationSocialState
            ResendPhoneCodeSocial
            PhoneVerificationSocialState --> ResendPhoneCodeSocial: Click resend
            ResendPhoneCodeSocial --> PhoneVerificationSocialState: Code sent
        }

        SocialAuth --> PhoneCollection: verificationMethod phone/both (no phone)
        SocialAuth --> PhoneVerificationSocial: verificationMethod phone/both (has phone, not verified)
        SocialAuth --> Dashboard: verificationMethod none/email or all verified

        PhoneCollection --> PhoneVerificationSocial: Phone added (SMS sent automatically)
        PhoneVerificationSocial --> Dashboard: Phone verified
    }

    Dashboard --> [*]
```

**Key Points:**

- **Same flow for signup and login** - both use the challenge system identically
- Email is **auto-verified** from OAuth provider (no email verification challenge)
- **No password change challenges** - Social users don't have passwords stored
- If phone verification required and user has NO phone → Phone Collection form first
- If phone verification required and user HAS phone but not verified → Phone Verification directly
- Phone collection must happen before phone verification when phone is missing

**API Flow:**

1. **Initial Challenge**: `POST /auth/social/{provider}/verify` or `POST /auth/social/{provider}/callback` returns:

   ```json
   {
     "challengeName": "VERIFY_PHONE",
     "session": "challenge-session-token",
     "challengeParameters": {
       "requiresPhoneCollection": "true",
       "instructions": "You must add a phone number and verify it to continue"
     },
     "userSub": "user-uuid"
   }
   ```

2. **Phone Collection** (if `requiresPhoneCollection: 'true'`): `POST /auth/respond-challenge`

   ```json
   {
     "session": "challenge-session-token",
     "type": "VERIFY_PHONE",
     "phone": "+1234567890"
   }
   ```

   - Backend updates user phone, sends SMS code automatically
   - Returns same `VERIFY_PHONE` challenge (now with phone set, no `requiresPhoneCollection`)

3. **Phone Verification**: `POST /auth/respond-challenge`

   ```json
   {
     "session": "challenge-session-token",
     "type": "VERIFY_PHONE",
     "code": "123456"
   }
   ```

   - Backend verifies code, completes challenge
   - Returns tokens or next challenge

## Detailed Flow Scenarios

### Signup Flow Scenarios

#### Scenario 1: `verificationMethod: 'none'` + `MFA enforcement: REQUIRED`

1. User signs up → MFA Selector (no email/phone verification)
2. User selects MFA method → Setup/Verify → Dashboard

#### Scenario 2: `verificationMethod: 'none'` + `MFA enforcement: OPTIONAL`

1. User signs up → MFA Selector (optional, can skip)
2. User can skip MFA → Dashboard directly
3. OR User selects MFA method → Setup/Verify → Dashboard

#### Scenario 3: `verificationMethod: 'email'` + `MFA enforcement: REQUIRED`

1. User signs up → Email Verification → MFA Selector → Setup/Verify → Dashboard

#### Scenario 4: `verificationMethod: 'email'` + `MFA enforcement: OPTIONAL`

1. User signs up → Email Verification → MFA Selector (optional) → Dashboard

#### Scenario 5: `verificationMethod: 'phone'` + `MFA enforcement: REQUIRED`

1. User signs up → Phone Verification → MFA Selector → Setup/Verify → Dashboard

#### Scenario 6: `verificationMethod: 'both'` + `MFA enforcement: REQUIRED`

1. User signs up → Email Verification → Phone Verification → MFA Selector → Setup/Verify → Dashboard

### MFA Disabled Flow Scenarios (`mfa.enabled: false`)

#### Scenario 1: `verificationMethod: 'none'` + `mfa.enabled: false`

1. User signs up → Dashboard (no verification, no MFA)
2. **Login**: User logs in → Dashboard (no challenges)

#### Scenario 2: `verificationMethod: 'email'` + `mfa.enabled: false`

1. User signs up → Email Verification → Dashboard
2. **Login**:
   - If email verified → Dashboard
   - If email invalidated → Email Verification → Dashboard

#### Scenario 3: `verificationMethod: 'phone'` + `mfa.enabled: false`

1. User signs up → Phone Verification → Dashboard
2. **Login**:
   - If phone verified → Dashboard
   - If phone invalidated → Phone Verification → Dashboard

#### Scenario 4: `verificationMethod: 'both'` + `mfa.enabled: false`

1. User signs up → Email Verification → Phone Verification → Dashboard
2. **Login**:
   - If both verified → Dashboard
   - If email invalidated → Email Verification → (Phone if invalidated) → Dashboard
   - If phone invalidated → Phone Verification → Dashboard

#### Scenario 5: Password Change Required During Login (`mfa.enabled: false`)

1. User logs in → Must Change Password → Password Change Form → Dashboard
2. **Triggers when**:
   - Password expired
   - Admin forced password reset
   - Security policy requires password change
   - User account flagged for password reset
3. **Priority**: Password change comes FIRST (priority 1), before any verification challenges
4. **Note**: Password change challenge does NOT occur during signup - users set their password during signup, so there's nothing to change

#### Scenario 6: Combined Challenges - Password Change + Email (`mfa.enabled: false`)

1. User logs in → Must Change Password → Password Change Form → Email Verification → Dashboard
2. **Sequence**: Password change must complete FIRST (priority 1), then email verification (priority 2)

#### Scenario 7: Combined Challenges - Password Change + Phone (`mfa.enabled: false`)

1. User logs in → Must Change Password → Password Change Form → Phone Verification → Dashboard
2. **Sequence**: Password change must complete FIRST (priority 1), then phone verification (priority 4)

#### Scenario 8: Combined Challenges - Password Change + Email + Phone (`mfa.enabled: false`)

1. User logs in → Must Change Password → Password Change Form → Email Verification → Phone Verification → Dashboard
2. **Sequence**: Password change FIRST (priority 1), then email verification (priority 2), then phone verification (priority 4)

### Social Authentication Flow Scenarios

**Note:** Social signup and login use the **same flow** - both go through the challenge system identically. The scenarios below apply to both signup and login.

#### Social Auth Scenario 1: `verificationMethod: 'none'` or `'email'`

1. User signs up/logs in via Google/Apple/Facebook → Email auto-verified → Dashboard
2. **No challenges** - Email is automatically verified from OAuth provider
3. **API**: `POST /auth/social/{provider}/verify` returns tokens directly

#### Social Auth Scenario 2: `verificationMethod: 'phone'` (User has NO phone)

1. User signs up/logs in via Google/Apple/Facebook → Email auto-verified → `VERIFY_PHONE` challenge with `requiresPhoneCollection: 'true'`
2. **Step 1 - Phone Collection**: `POST /auth/respond-challenge` with `{ type: 'VERIFY_PHONE', phone: '+1234567890' }`
   - Backend updates user phone, sends SMS code automatically
   - Returns same `VERIFY_PHONE` challenge (phone now set)
3. **Step 2 - Phone Verification**: `POST /auth/respond-challenge` with `{ type: 'VERIFY_PHONE', code: '123456' }`
   - Backend verifies code, returns tokens or next challenge
4. **UI Flow**: Phone entry form must be shown FIRST, then verification code entry

#### Social Auth Scenario 3: `verificationMethod: 'phone'` (User HAS phone, not verified)

1. User signs up/logs in via Google/Apple/Facebook → Email auto-verified → `VERIFY_PHONE` challenge (no `requiresPhoneCollection`)
2. **Phone Verification**: `POST /auth/respond-challenge` with `{ type: 'VERIFY_PHONE', code: '123456' }`
3. **Note**: User already has phone (e.g., from password signup, then linked social account), so goes directly to verification

#### Social Auth Scenario 4: `verificationMethod: 'both'` (User has NO phone)

1. User signs up/logs in via Google/Apple/Facebook → Email auto-verified → `VERIFY_PHONE` challenge with `requiresPhoneCollection: 'true'`
2. **Same flow as Scenario 2** - Phone collection then verification
3. **Note**: Email is auto-verified, so only phone collection/verification is needed
4. **Note**: Social users don't have passwords, so password change challenges don't apply

### Login Flow Scenarios

#### Scenario 1: User with MFA Enabled (Preferred Method Set)

1. User logs in → MFA Required → System checks preferred method
2. **If SMS preferred**: → SMS Verify (code sent automatically with toast) → User can verify or go back to selector
3. **If Email preferred**: → Email Verify (code sent automatically with toast) → User can verify or go back to selector
4. **If TOTP preferred**: → TOTP Verify → User can verify or go back to selector
5. **If Passkey preferred**: → Passkey Verify → User can verify or go back to selector
6. After verification → Dashboard

#### Scenario 1b: User with MFA Enabled (No Preferred Method)

1. User logs in → MFA Required → MFA Selector → User selects method → Verify → Dashboard

#### Scenario 1c: MFA Setup Required During Login

1. User logs in → MFA Setup Required (same flow as Signup MFA Setup)
2. **Triggers when**:
   - User skipped MFA during signup (OPTIONAL) but MFA is now required
   - MFA enforcement changed to REQUIRED after user signed up
   - MFA was enabled later (system-wide or user-level)
3. User completes MFA setup → Dashboard
4. **Next Login**: User will be prompted for MFA verification

#### Scenario 2: User with Invalidated Email

1. User logs in → Email Verification → Check MFA → Dashboard or MFA Required or MFA Setup Required

#### Scenario 3: User with Invalidated Phone

1. User logs in → Phone Verification → Check MFA → Dashboard or MFA Required or MFA Setup Required

#### Scenario 4: User with Both Email and Phone Invalidated

1. User logs in → Email Verification → Phone Verification → Check MFA → Dashboard or MFA Required or MFA Setup Required

#### Scenario 5: User with Invalidated Email + MFA Enabled

1. User logs in → Email Verification → MFA Required → Verify → Dashboard

#### Scenario 6: User with Invalidated Email + MFA Setup Required

1. User logs in → Email Verification → MFA Setup Required → Setup → Dashboard

### Dashboard Flow Scenarios

#### Scenario 1: User Adds MFA (MFA Optional)

1. User on Dashboard → Add MFA Method → Select method → Setup/Verify → Dashboard
2. **Next Login**: User will be prompted for MFA verification

#### Scenario 2: User Adds Additional MFA Method

1. User already has MFA → Add another method → Setup/Verify → Dashboard

## State Descriptions

### Signup State

- **Entry**: User completes signup form
- **Actions**: System determines verification requirements based on `verificationMethod`
- **Exit**:
  - `verificationMethod: 'email'` → Email Verification
  - `verificationMethod: 'phone'` → Phone Verification
  - `verificationMethod: 'both'` → Email Verification (then Phone)
  - `verificationMethod: 'none'` → MFA Selector or Dashboard

### Email Verification State

- **Entry**: After signup when email verification required, or login when email invalidated. **Note**: Password change (if required) must complete first (Priority 1) before email verification (Priority 2)
- **Actions**:
  - Code sent automatically
  - Toast notification (simulation mode)
  - Resend code available (60s cooldown)
- **Exit**:
  - Email verified → Next challenge (Phone/MFA) or Dashboard
  - Back → Login (if during login)

### Phone Collection State

- **Entry**:
  - **Social auth only** - When phone verification is required but user has NO phone number
  - After social signup/login when `verificationMethod: 'phone'` or `'both'` and user.phone is null
  - Triggered when challenge response includes `requiresPhoneCollection: 'true'`
  - **Note**: Social OAuth providers (Google, Apple, Facebook) don't provide phone numbers
- **Actions**:
  - Phone number input form (E.164 format: +[country][number])
  - Country code selector
  - Phone format validation
  - Submit button to add phone
- **API**: `POST /auth/respond-challenge`

  ```json
  {
    "session": "challenge-session-token",
    "type": "VERIFY_PHONE",
    "phone": "+1234567890"
  }
  ```

  - Backend updates user phone, sends SMS code automatically
  - Returns same `VERIFY_PHONE` challenge (phone now set, SMS sent)

- **Exit**:
  - Phone submitted → Phone Verification (code sent automatically)
  - **Note**: Phone collection must happen BEFORE phone verification when phone is missing
  - **Same API endpoint** used for both signup and login - no authentication required (uses challenge session token)

### Phone Verification State

- **Entry**: After signup when phone verification required, or login when phone invalidated. **Note**: For password-based auth, password change (if required) must complete first (Priority 1), then email verification (Priority 2) before phone verification (Priority 4). For social auth, phone collection (if needed) comes before verification. Social users don't have password change challenges.
- **Actions**:
  - Code sent automatically
  - Toast notification (simulation mode)
  - Resend code available (60s cooldown)
- **Exit**:
  - Phone verified → Next challenge (MFA) or Dashboard
  - Back → Login (if during login)

### MFA Selector State

- **Entry**:
  - After verification (if MFA required)
  - Directly after signup (if no verification and MFA required)
  - From any MFA setup screen (back navigation)
- **Actions**:
  - Shows available MFA methods
  - User can select any method
  - Navigation: "Back to Login" (signup/login) or "Back to Dashboard" (dashboard)
- **Exit**:
  - Selected method → Corresponding setup/verify screen
  - Skip (if optional) → Dashboard
  - Back → Previous screen

### MFA Required State (Login Only)

- **Entry**: After login when user has MFA enabled
- **Actions**:
  - System checks user's preferred MFA method
  - If preferred method exists → Directly transitions to that method's verification
  - If SMS/Email preferred → Code sent automatically with toast notification
  - If no preferred method or user wants to change → Transitions to MFA Selector
- **Exit**:
  - Preferred method exists → Directly to that method's verification screen
  - No preferred or user chooses another → MFA Selector

### MFA Setup Required State (Login Only)

- **Entry**: After login when MFA is required but user hasn't set up MFA yet
- **Triggers**:
  - User skipped MFA during signup (when MFA was OPTIONAL) but MFA is now required
  - MFA enforcement changed to REQUIRED after user signed up
  - MFA was enabled later (system-wide or user-level)
- **Actions**:
  - Same flow as Signup MFA Setup Phase (see Signup Flow diagram)
  - User must complete MFA setup before accessing dashboard
- **Exit**:
  - Setup complete → Dashboard
  - **Note**: This uses the same MFA setup flow as signup, so refer to Signup Flow diagram for detailed states

### TOTP Setup/Verify State

- **Entry**: User selects TOTP from MFA selector
- **Actions**:
  - Setup: QR code, manual entry key, code input
  - Verify (login): Code input only
  - Back navigation available
- **Exit**:
  - Verified → Dashboard
  - Back → MFA Selector

### Passkey Setup/Verify State

- **Entry**: User selects Passkey from MFA selector
- **Actions**:
  - Setup: WebAuthn registration prompt
  - Verify (login): WebAuthn authentication prompt
  - Back navigation available
- **Exit**:
  - Verified → Dashboard
  - Back → MFA Selector

### SMS Setup/Verify State

- **Entry**: User selects SMS from MFA selector (signup or dashboard)
- **Actions**:
  - Check if phone already verified
  - If verified → Auto-completed Success state
  - If not verified → Code sent automatically with toast notification (simulation mode)
  - Transitions to OTP Verify state (if not verified)
- **Exit**:
  - Already verified → Auto-completed Success
  - Not verified → OTP Verify state

### Email MFA Setup/Verify State

- **Entry**: User selects Email from MFA selector
- **Actions**:
  - Check if email already verified
  - If verified → Auto-completed Success state
  - If not verified → Code sent, transitions to OTP Verify state
- **Exit**:
  - Already verified → Auto-completed Success
  - Not verified → OTP Verify state

### OTP Verify State

- **Entry**:
  - After SMS/Email setup (code sent) - signup/dashboard flow
  - Preferred SMS/Email method selected - login flow (code sent automatically)
  - User selects SMS/Email from MFA selector - login flow
  - After resend code action
- **Actions**:
  - 6-digit OTP input field
  - Resend Code button (60s cooldown timer)
  - Back navigation available (goes to MFA Selector to choose another method, or Dashboard for dashboard flow)
  - Toast notification shows code (simulation mode)
  - **Resend always triggers toast**: When user clicks resend, new code is sent AND toast notification appears
- **Exit**:
  - Code verified → Dashboard
  - Back → MFA Selector (user can choose another method) or Dashboard (dashboard flow)
  - Resend → Same state (new code sent + toast shown)

### Auto-Completed Success State

- **Entry**:
  - Email MFA selected and email already verified
  - SMS MFA selected and phone already verified
- **Actions**:
  - Success message displayed
  - "Your [email/phone] is already verified. MFA successfully setup."
  - Continue button
- **Exit**: Continue → Dashboard
- **Note**: Two separate states exist: `AutoCompletedSuccessSMS` and `AutoCompletedSuccessEmail` for clarity in the diagram

### Must Change Password State

- **Entry**:
  - **FIRST** (Priority 1) - Before any verification challenges
  - **Login only** - Does NOT occur during signup (users set password during signup)
  - Admin forced password reset
  - Password expired
  - Security policy requires password change
  - User account flagged for password reset
- **Actions**:
  - Displays message explaining password change requirement
  - "You must change your password before continuing"
  - Continue button to proceed to password change form
- **Exit**:
  - Continue → Password Change Form
  - **Note**: This is a mandatory challenge that cannot be skipped. Has highest priority (1) and must complete before email/phone verification challenges. Only occurs during login, never during signup.

### Password Change Form State

- **Entry**: After Must Change Password state
- **Actions**:
  - Current password field (if required by policy)
  - New password field with strength indicator
  - Confirm new password field
  - Password requirements displayed
  - Submit button
  - Validation on form fields
- **Exit**:
  - Password changed successfully → Dashboard
  - Validation error → Same state (error message displayed)
  - **Note**: User cannot proceed to dashboard until password is successfully changed

## Common Behaviors

### Resend Code Functionality

- Works for SMS and Email methods
- Button disabled during 60-second countdown timer
- **Always shows toast**: When user clicks resend, new code is sent AND toast notification appears (simulation mode)
- Old toast dismissed before showing new one
- This is a critical requirement - resend must always trigger toast notification

### Navigation

- Users can navigate back and forth between MFA methods
- "Back to Login" appears during signup/login flow
- "Back to Dashboard" appears during authenticated flow
- "Back to Method Selection" appears when setting up a specific method

### Toast Notifications (Simulation Mode)

- Toast appears automatically when code is sent
- Toast shows verification code for SMS/Email methods
- Toast dismissed when new code is sent (replaces old toast)
- Toast delay: 500ms to allow code to be saved to database

### Error Handling

- Invalid codes show error message
- Expired sessions redirect appropriately
- Network errors handled gracefully

## Configuration Matrix

| verificationMethod | MFA Enforcement | Signup Flow                                              | Login Flow                                                           |
| ------------------ | --------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `none`             | `OPTIONAL`      | → Dashboard (MFA optional)                               | → Dashboard (if no MFA) or MFA Required                              |
| `none`             | `REQUIRED`      | → MFA Selector → Dashboard                               | → MFA Required → Dashboard                                           |
| `none`             | `DISABLED`      | → Dashboard (no MFA)                                     | → Dashboard (no MFA) or Password Change (if required)                |
| `email`            | `OPTIONAL`      | → Email Verify → Dashboard (MFA optional)                | → Email Verify (if invalidated) → Dashboard or MFA Required          |
| `email`            | `REQUIRED`      | → Email Verify → MFA Selector → Dashboard                | → Email Verify (if invalidated) → MFA Required → Dashboard           |
| `email`            | `DISABLED`      | → Email Verify → Dashboard                               | → Email Verify (if invalidated) → Dashboard or Password Change       |
| `phone`            | `OPTIONAL`      | → Phone Verify → Dashboard (MFA optional)                | → Phone Verify (if invalidated) → Dashboard or MFA Required          |
| `phone`            | `REQUIRED`      | → Phone Verify → MFA Selector → Dashboard                | → Phone Verify (if invalidated) → MFA Required → Dashboard           |
| `phone`            | `DISABLED`      | → Phone Verify → Dashboard                               | → Phone Verify (if invalidated) → Dashboard or Password Change       |
| `both`             | `OPTIONAL`      | → Email Verify → Phone Verify → Dashboard (MFA optional) | → Email/Phone Verify (if invalidated) → Dashboard or MFA Required    |
| `both`             | `REQUIRED`      | → Email Verify → Phone Verify → MFA Selector → Dashboard | → Email/Phone Verify (if invalidated) → MFA Required → Dashboard     |
| `both`             | `DISABLED`      | → Email Verify → Phone Verify → Dashboard                | → Email/Phone Verify (if invalidated) → Dashboard or Password Change |

## Notes

- All flows support going back and changing MFA method selection
- Resend code works consistently across all scenarios
- Toast notifications only appear in simulation mode (test mode)
- Authenticated flows (dashboard) do not have challenge sessions, so toast may not work (test controller limitation)
- Auto-completed setups (already verified phone/email) show success screen instead of code entry
- Login flows can trigger email/phone verification if credentials were invalidated
- Verification challenges during login are separate from MFA challenges
- Multiple verification challenges can occur sequentially (email → phone → MFA)
- MFA OPTIONAL: User can skip MFA setup during signup, but if they enable it later on dashboard, MFA will be required on subsequent logins
- MFA REQUIRED: User must setup MFA during signup (or within grace period)
- MFA can be disabled entirely with `mfa.enabled: false`
- **MFA DISABLED**: When `mfa.enabled: false`, no MFA challenges occur. Only email/phone verification and password change challenges apply
- **Password Change Challenge**: **Login only** - Does NOT occur during signup (users set their password during signup). Mandatory when triggered and cannot be skipped
- **Challenge Order** (Priority-based, from `auth-flow-state-definitions.ts`): When multiple challenges are required during login, the order is: **Password Change (Priority 1)** → Email Verification (Priority 2) → Phone Verification (Priority 4) → Dashboard (MFA challenges only apply when MFA is enabled)
- Password change challenge has the highest priority (1) and must be completed before any verification challenges
- Password change challenge can be triggered by: expired password, admin forced reset, security policy, or account flag
- **Social Authentication (OAuth)**:
  - **Signup and login use the SAME flow** - both go through the challenge system identically
  - **Social users don't have passwords** - password change challenges don't apply to social auth users
  - Email is **automatically verified** from OAuth provider (Google, Apple, Facebook) - no email verification challenge
  - Social OAuth providers **do NOT provide phone numbers** during signup/login
  - **Phone Collection API** (when `requiresPhoneCollection: 'true'`): `POST /auth/respond-challenge` with `{ type: 'VERIFY_PHONE', phone: '+1234567890' }`
    - User is **unauthenticated** - uses challenge session token (not auth token)
    - Backend updates user phone, sends SMS code automatically
    - Returns same `VERIFY_PHONE` challenge (phone now set)
  - **Phone Verification API**: `POST /auth/respond-challenge` with `{ type: 'VERIFY_PHONE', code: '123456' }`
    - Backend verifies code, completes challenge
    - Returns tokens or next challenge
  - If phone verification is required (`verificationMethod: 'phone'` or `'both'`) and user has NO phone:
    - UI must show **Phone Collection form FIRST** (user enters phone number)
    - After phone is added via API, system sends verification code automatically
    - UI then shows **Phone Verification form** (user enters code)
  - If phone verification is required and user HAS phone (e.g., from previous signup or account linking):
    - UI goes directly to **Phone Verification** (no collection needed)
  - Phone collection state (Priority 3) comes before phone verification (Priority 4) when phone is missing
