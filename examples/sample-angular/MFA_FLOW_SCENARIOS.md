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

- **Entry**: After signup when email verification required, or login when email invalidated
- **Actions**:
  - Code sent automatically
  - Toast notification (simulation mode)
  - Resend code available (60s cooldown)
- **Exit**:
  - Email verified → Next challenge (Phone/MFA) or Dashboard
  - Back → Login (if during login)

### Phone Verification State

- **Entry**: After signup when phone verification required, or login when phone invalidated
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

| verificationMethod | MFA Enforcement | Signup Flow                                              | Login Flow                                                        |
| ------------------ | --------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `none`             | `OPTIONAL`      | → Dashboard (MFA optional)                               | → Dashboard (if no MFA) or MFA Required                           |
| `none`             | `REQUIRED`      | → MFA Selector → Dashboard                               | → MFA Required → Dashboard                                        |
| `email`            | `OPTIONAL`      | → Email Verify → Dashboard (MFA optional)                | → Email Verify (if invalidated) → Dashboard or MFA Required       |
| `email`            | `REQUIRED`      | → Email Verify → MFA Selector → Dashboard                | → Email Verify (if invalidated) → MFA Required → Dashboard        |
| `phone`            | `OPTIONAL`      | → Phone Verify → Dashboard (MFA optional)                | → Phone Verify (if invalidated) → Dashboard or MFA Required       |
| `phone`            | `REQUIRED`      | → Phone Verify → MFA Selector → Dashboard                | → Phone Verify (if invalidated) → MFA Required → Dashboard        |
| `both`             | `OPTIONAL`      | → Email Verify → Phone Verify → Dashboard (MFA optional) | → Email/Phone Verify (if invalidated) → Dashboard or MFA Required |
| `both`             | `REQUIRED`      | → Email Verify → Phone Verify → MFA Selector → Dashboard | → Email/Phone Verify (if invalidated) → MFA Required → Dashboard  |

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
