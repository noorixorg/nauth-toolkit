import { FlowBuilder, SignupData } from './flow-builders';

/**
 * Backend configuration for filtering scenarios
 */
export type BackendConfig = {
  verificationMethod: 'none' | 'email' | 'phone' | 'both';
  mfaEnabled: boolean;
  mfaEnforcement: 'OPTIONAL' | 'REQUIRED';
};

/**
 * Test scenario definition
 */
export type Scenario = {
  id: string;
  name: string;
  description: string;
  backendConfig: BackendConfig;
  tags: string[];
  execute: (builder: FlowBuilder, data: SignupData) => Promise<void>;
};

/**
 * All test scenarios
 * Phase 1: Basic signup
 * Phase 2: Email verification
 * Phase 3: Phone verification and both verifications
 * Phase 4: MFA method selection
 * Phase 5: TOTP MFA setup
 * Phase 6: SMS MFA setup
 * Phase 7: Email MFA setup
 * Phase 8: Login flows
 * Phase 9: Dashboard MFA Management
 * Phase 10: Complex Scenarios
 * Phase 11: Error Handling & Edge Cases
 */
export const SCENARIOS: Scenario[] = [
  {
    id: 'signup-basic',
    name: 'Signup Basic',
    description: 'Signup without verification or MFA',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@signup', '@basic', '@phase1'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectDashboard();
    },
  },
  {
    id: 'signup-email-verification',
    name: 'Signup with Email Verification',
    description: 'Signup with email verification, no MFA',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@signup', '@email-verification', '@phase2'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectDashboard();
    },
  },
  {
    id: 'signup-phone-verification',
    name: 'Signup with Phone Verification',
    description: 'Signup with phone verification, no MFA',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@signup', '@phone-verification', '@phase3'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectDashboard();
    },
  },
  {
    id: 'signup-both-verification',
    name: 'Signup with Email and Phone Verification',
    description: 'Signup with both email and phone verification, no MFA',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@signup', '@both-verification', '@phase3'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectDashboard();
    },
  },
  {
    id: 'signup-mfa-required-sms',
    name: 'Signup MFA Required - SMS',
    description: 'Signup with required MFA using SMS',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@signup', '@mfa-required', '@sms', '@phase6'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');
    },
  },
  {
    id: 'signup-mfa-required-totp',
    name: 'Signup MFA Required - TOTP',
    description: 'Signup with required MFA using TOTP',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@signup', '@mfa-required', '@totp', '@phase5'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'signup-mfa-optional-totp',
    name: 'Signup MFA Optional - TOTP',
    description:
      'Signup with optional MFA enforcement - user goes to dashboard, then adds TOTP from dashboard',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@signup', '@mfa-optional', '@totp', '@phase5'],
    execute: async (builder, data) => {
      // With OPTIONAL enforcement, signup should go directly to dashboard (no MFA setup required)
      await builder.signup(data);
      await builder.expectDashboard();

      // User can then voluntarily add MFA from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'signup-phone-mfa-required-sms',
    name: 'Signup Phone Verified + MFA Required SMS',
    description: 'Signup with phone verification, then SMS MFA (should auto-complete)',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@signup', '@phone-verification', '@mfa-required', '@sms', '@auto-complete', '@phase6'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Should auto-complete since phone already verified
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');
    },
  },
  {
    id: 'signup-mfa-required-email',
    name: 'Signup MFA Required - Email',
    description: 'Signup with required MFA using Email',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@signup', '@mfa-required', '@email-mfa', '@phase7'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');
    },
  },
  {
    id: 'signup-email-mfa-required-email',
    name: 'Signup Email Verified + MFA Required Email',
    description: 'Signup with email verification, then Email MFA (should auto-complete)',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: [
      '@signup',
      '@email-verification',
      '@mfa-required',
      '@email-mfa',
      '@auto-complete',
      '@phase7',
    ],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Should auto-complete since email already verified
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');
    },
  },
  {
    id: 'login-basic',
    name: 'Login Basic',
    description: 'Login without MFA',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@login', '@basic', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup first
      await builder.signup(data);
      await builder.expectDashboard();

      // Logout
      await builder.logout();

      // Test: Login
      await builder.login(data.email, data.password);
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-mfa-required-totp',
    name: 'Login MFA Required - TOTP',
    description: 'Login with TOTP MFA challenge',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@totp', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with TOTP
      await builder.signup(data);
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');

      // Get userId for TOTP secret lookup
      const userId = await builder.getUserId();

      // Logout
      await builder.logout();

      // IMPORTANT: Wait for new TOTP window before login
      // TOTP setup codes are one-time use and cannot be reused for login.
      // TOTP codes change every 30 seconds (standard).
      // Wait 35 seconds to guarantee we cross into a new 30-second TOTP window
      console.log(
        `[FlowBuilder] Waiting 35s for new TOTP window (setup code is one-time use, codes change every 30s)...`,
      );
      await builder.page.waitForTimeout(35000);

      // Test: Login with TOTP challenge
      await builder.login(data.email, data.password);
      await builder.verifyTotpLogin(userId);
      await builder.expectDashboard();
    },
  },
  {
    id: 'dashboard-add-totp',
    name: 'Dashboard Add TOTP',
    description: 'Add TOTP MFA from dashboard after signup without MFA',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@dashboard', '@add-mfa', '@totp', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup without MFA (MFA disabled or optional)
      await builder.signup(data);
      await builder.expectDashboard();

      // Test: Add TOTP from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'dashboard-add-sms',
    name: 'Dashboard Add SMS',
    description: 'Add SMS MFA from dashboard',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@dashboard', '@add-mfa', '@sms', '@phase9'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectDashboard();

      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');
    },
  },
  {
    id: 'dashboard-add-email',
    name: 'Dashboard Add Email',
    description: 'Add Email MFA from dashboard',
    backendConfig: {
      verificationMethod: 'none',
      mfaEnabled: true,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@dashboard', '@add-mfa', '@email-mfa', '@phase9'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectDashboard();

      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');
    },
  },
  {
    id: 'complete-flow-email-both-totp',
    name: 'Complete Flow: Email Verification + Both MFA (Email + TOTP)',
    description:
      'Signup with email verification, setup Email MFA (auto-complete), then add TOTP from dashboard, logout and login with TOTP',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@complete-flow', '@complex', '@phase10'],
    execute: async (builder, data) => {
      // Signup with email verification + Email MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes since email already verified
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Add TOTP from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');

      // Get userId for TOTP secret lookup
      const userId = await builder.getUserId();

      // Logout
      await builder.logout();

      // IMPORTANT: Wait for new TOTP window before login
      // TOTP setup codes are one-time use and cannot be reused for login.
      // TOTP codes change every 30 seconds (standard).
      // Wait 35 seconds to guarantee we cross into a new 30-second TOTP window
      console.log(
        `[FlowBuilder] Waiting 35s for new TOTP window (setup code is one-time use, codes change every 30s)...`,
      );
      await builder.page.waitForTimeout(35000);

      // Login should prompt for MFA (user can choose which method - we'll use TOTP)
      await builder.login(data.email, data.password);
      await builder.verifyTotpLogin(userId); // User chooses TOTP
      await builder.expectDashboard();
    },
  },
  {
    id: 'complete-flow-phone-sms-totp',
    name: 'Complete Flow: Phone Verification + SMS MFA + TOTP',
    description:
      'Signup with phone verification, setup SMS MFA (auto-complete), then add TOTP from dashboard',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@complete-flow', '@complex', '@phase10'],
    execute: async (builder, data) => {
      // Signup with phone verification + SMS MFA
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Auto-completes since phone already verified
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');

      // Add TOTP from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'complete-flow-both-verification-email-mfa',
    name: 'Complete Flow: Both Verification + Email MFA',
    description:
      'Signup with both email and phone verification, then setup Email MFA (auto-complete)',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@complete-flow', '@complex', '@phase10'],
    execute: async (builder, data) => {
      // Signup with both verifications
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();

      // Setup Email MFA (auto-completes since email already verified)
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');
    },
  },
  {
    id: 'complete-flow-both-verification-sms-mfa',
    name: 'Complete Flow: Both Verification + SMS MFA',
    description:
      'Signup with both email and phone verification, then setup SMS MFA (auto-complete)',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@complete-flow', '@complex', '@phase10'],
    execute: async (builder, data) => {
      // Signup with both verifications
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();

      // Setup SMS MFA (auto-completes since phone already verified)
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');
    },
  },
  {
    id: 'complete-flow-both-verification-totp-mfa',
    name: 'Complete Flow: Both Verification + TOTP MFA',
    description: 'Signup with both email and phone verification, then setup TOTP MFA',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@complete-flow', '@complex', '@phase10'],
    execute: async (builder, data) => {
      // Signup with both verifications
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();

      // Setup TOTP MFA
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'login-both-verification-mfa-required-totp',
    name: 'Login Both Verification MFA Required - TOTP',
    description: 'Signup with both verification + TOTP MFA, then login with TOTP challenge',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@totp', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with both verification + TOTP MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');

      // Get userId for TOTP secret lookup
      const userId = await builder.getUserId();

      // Logout
      await builder.logout();

      // IMPORTANT: Wait for new TOTP window before login
      console.log(
        `[FlowBuilder] Waiting 35s for new TOTP window (setup code is one-time use, codes change every 30s)...`,
      );
      await builder.page.waitForTimeout(35000);

      // Test: Login with TOTP challenge
      await builder.login(data.email, data.password);
      await builder.verifyTotpLogin(userId);
      await builder.expectDashboard();
    },
  },
  {
    id: 'dashboard-both-verification-add-sms',
    name: 'Dashboard Both Verification - Add SMS MFA',
    description: 'Signup with both verification + Email MFA, then add SMS MFA from dashboard',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@dashboard', '@add-mfa', '@sms', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup with both verification + Email MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Test: Add SMS MFA from dashboard (should auto-complete since phone already verified)
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Should auto-complete
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');
    },
  },
  {
    id: 'dashboard-both-verification-add-totp',
    name: 'Dashboard Both Verification - Add TOTP MFA',
    description: 'Signup with both verification + Email MFA, then add TOTP MFA from dashboard',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@dashboard', '@add-mfa', '@totp', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup with both verification + Email MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Test: Add TOTP MFA from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'login-email-verification-mfa-required-sms',
    name: 'Login Email Verification MFA Required - SMS',
    description: 'Signup with email verification + SMS MFA, then login with SMS challenge',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@sms', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with email verification + SMS MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');

      // Logout
      await builder.logout();

      // Test: Login (email still verified, should go to SMS MFA challenge)
      await builder.login(data.email, data.password);
      await builder.verifySmsMfaLogin();
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-email-verification-mfa-required-email',
    name: 'Login Email Verification MFA Required - Email',
    description: 'Signup with email verification + Email MFA, then login with Email MFA challenge',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@email-mfa', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with email verification + Email MFA (auto-complete)
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Logout
      await builder.logout();

      // Test: Login (email still verified, should go to Email MFA challenge)
      await builder.login(data.email, data.password);
      await builder.verifyEmailMfaLogin();
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-email-verification-mfa-required-totp',
    name: 'Login Email Verification MFA Required - TOTP',
    description: 'Signup with email verification + TOTP MFA, then login with TOTP challenge',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@totp', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with email verification + TOTP MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');

      const userId = await builder.getUserId();
      await builder.logout();

      console.log(
        `[FlowBuilder] Waiting 35s for new TOTP window (setup code is one-time use, codes change every 30s)...`,
      );
      await builder.page.waitForTimeout(35000);

      // Test: Login with TOTP challenge
      await builder.login(data.email, data.password);
      await builder.verifyTotpLogin(userId);
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-phone-verification-mfa-required-sms',
    name: 'Login Phone Verification MFA Required - SMS',
    description:
      'Signup with phone verification + SMS MFA (auto-complete), then login with SMS challenge',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@sms', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with phone verification + SMS MFA (auto-complete)
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');

      // Logout
      await builder.logout();

      // Test: Login (phone still verified, should go to SMS MFA challenge)
      await builder.login(data.email, data.password);
      await builder.verifySmsMfaLogin();
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-phone-verification-mfa-required-totp',
    name: 'Login Phone Verification MFA Required - TOTP',
    description: 'Signup with phone verification + TOTP MFA, then login with TOTP challenge',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@totp', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with phone verification + TOTP MFA
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');

      const userId = await builder.getUserId();
      await builder.logout();

      console.log(
        `[FlowBuilder] Waiting 35s for new TOTP window (setup code is one-time use, codes change every 30s)...`,
      );
      await builder.page.waitForTimeout(35000);

      // Test: Login with TOTP challenge
      await builder.login(data.email, data.password);
      await builder.verifyTotpLogin(userId);
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-both-verification-mfa-required-sms',
    name: 'Login Both Verification MFA Required - SMS',
    description:
      'Signup with both verification + SMS MFA (auto-complete), then login with SMS challenge',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@sms', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with both verification + SMS MFA (auto-complete)
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');

      // Logout
      await builder.logout();

      // Test: Login (both still verified, should go to SMS MFA challenge)
      await builder.login(data.email, data.password);
      await builder.verifySmsMfaLogin();
      await builder.expectDashboard();
    },
  },
  {
    id: 'login-both-verification-mfa-required-email',
    name: 'Login Both Verification MFA Required - Email',
    description:
      'Signup with both verification + Email MFA (auto-complete), then login with Email MFA challenge',
    backendConfig: {
      verificationMethod: 'both',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@login', '@mfa-required', '@email-mfa', '@phase8'],
    execute: async (builder, data) => {
      // Setup: Signup with both verification + Email MFA (auto-complete)
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Logout
      await builder.logout();

      // Test: Login (both still verified, should go to Email MFA challenge)
      await builder.login(data.email, data.password);
      await builder.verifyEmailMfaLogin();
      await builder.expectDashboard();
    },
  },
  {
    id: 'dashboard-email-verification-add-sms',
    name: 'Dashboard Email Verification - Add SMS MFA',
    description: 'Signup with email verification + Email MFA, then add SMS MFA from dashboard',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@dashboard', '@add-mfa', '@sms', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup with email verification + Email MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Test: Add SMS MFA from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Phone not verified, needs code
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');
    },
  },
  {
    id: 'dashboard-email-verification-add-totp',
    name: 'Dashboard Email Verification - Add TOTP MFA',
    description: 'Signup with email verification + Email MFA, then add TOTP MFA from dashboard',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@dashboard', '@add-mfa', '@totp', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup with email verification + Email MFA
      await builder.signup(data);
      await builder.expectEmailVerification();
      await builder.verifyEmail();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');

      // Test: Add TOTP MFA from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'dashboard-phone-verification-add-email',
    name: 'Dashboard Phone Verification - Add Email MFA',
    description: 'Signup with phone verification + SMS MFA, then add Email MFA from dashboard',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@dashboard', '@add-mfa', '@email-mfa', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup with phone verification + SMS MFA
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');

      // Test: Add Email MFA from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('email');
      await builder.setupEmailMfa(); // Email not verified, needs code
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('email');
    },
  },
  {
    id: 'dashboard-phone-verification-add-totp',
    name: 'Dashboard Phone Verification - Add TOTP MFA',
    description: 'Signup with phone verification + SMS MFA, then add TOTP MFA from dashboard',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: true,
      mfaEnforcement: 'REQUIRED',
    },
    tags: ['@dashboard', '@add-mfa', '@totp', '@phase9'],
    execute: async (builder, data) => {
      // Setup: Signup with phone verification + SMS MFA
      await builder.signup(data);
      await builder.expectPhoneVerification();
      await builder.verifyPhone();
      await builder.expectMfaSetup();
      await builder.selectMfaMethod('sms');
      await builder.setupSmsMfa(); // Auto-completes
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('sms');

      // Test: Add TOTP MFA from dashboard
      await builder.addMfaFromDashboard();
      await builder.selectMfaMethod('totp');
      await builder.setupTotp();
      await builder.expectDashboard();
      await builder.expectMfaMethodInWidget('totp');
    },
  },
  {
    id: 'test-resend-email-code',
    name: 'Test Resend Email Verification Code',
    description: 'Test resend functionality for email verification',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@edge-case', '@resend', '@phase11'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectEmailVerification();

      // Test resend
      await builder.resendCode();

      // Complete verification with new code
      await builder.verifyEmail();
      await builder.expectDashboard();
    },
  },
  {
    id: 'test-resend-phone-code',
    name: 'Test Resend Phone Verification Code',
    description: 'Test resend functionality for phone verification',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@edge-case', '@resend', '@phase11'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectPhoneVerification();

      // Test resend
      await builder.resendCode();

      // Complete verification with new code
      await builder.verifyPhone();
      await builder.expectDashboard();
    },
  },
  {
    id: 'test-invalid-email-code',
    name: 'Test Invalid Email Verification Code',
    description: 'Test error handling for invalid email verification code',
    backendConfig: {
      verificationMethod: 'email',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@edge-case', '@invalid-code', '@phase11'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectEmailVerification();

      // Enter invalid code
      await builder.enterInvalidCode();
      await builder.expectError();

      // Now enter correct code
      await builder.verifyEmail();
      await builder.expectDashboard();
    },
  },
  {
    id: 'test-invalid-phone-code',
    name: 'Test Invalid Phone Verification Code',
    description: 'Test error handling for invalid phone verification code',
    backendConfig: {
      verificationMethod: 'phone',
      mfaEnabled: false,
      mfaEnforcement: 'OPTIONAL',
    },
    tags: ['@edge-case', '@invalid-code', '@phase11'],
    execute: async (builder, data) => {
      await builder.signup(data);
      await builder.expectPhoneVerification();

      // Enter invalid code
      await builder.enterInvalidCode();
      await builder.expectError();

      // Now enter correct code
      await builder.verifyPhone();
      await builder.expectDashboard();
    },
  },
];

/**
 * Filter scenarios by backend config
 *
 * @param config - Backend configuration to match
 * @returns Array of matching scenarios
 */
export function getScenariosForConfig(config: BackendConfig): Scenario[] {
  return SCENARIOS.filter(
    (s) =>
      s.backendConfig.verificationMethod === config.verificationMethod &&
      s.backendConfig.mfaEnabled === config.mfaEnabled &&
      s.backendConfig.mfaEnforcement === config.mfaEnforcement,
  );
}
