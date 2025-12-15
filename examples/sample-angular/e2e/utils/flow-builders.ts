/* eslint-disable */

import { Page, expect } from '@playwright/test';

/**
 * Flow helpers for interacting with backend test API
 * Note: Verification codes are extracted from toast on screen, not from API
 */
export type FlowHelpers = {
  getTotpSecret: (userId: string) => Promise<string>;
  generateTotpCode: (secret: string) => string;
};

/**
 * User data for signup
 */
export type SignupData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
};

/**
 * MFA method types
 */
export type MfaMethod = 'totp' | 'sms' | 'email' | 'passkey';

/**
 * FlowBuilder encapsulates UI interactions for authentication flows
 * Uses fluent API for chaining operations
 *
 * @example
 * ```typescript
 * const builder = new FlowBuilder(page, helpers);
 * await builder.signup(data).expectDashboard();
 * ```
 */
export class FlowBuilder {
  constructor(
    readonly page: Page,
    private helpers: FlowHelpers,
  ) {}

  /**
   * Performs signup with provided user data
   * Fills all form fields and submits
   *
   * @param data - User signup data
   * @returns FlowBuilder instance for chaining
   */
  async signup(data: SignupData): Promise<this> {
    console.log(`[FlowBuilder] Starting signup for ${data.email}`);

    try {
      // Get baseURL from page context or use default
      const baseURL = process.env.FRONTEND_URL || 'https://angular.dev1.noorix.com';
      const signupUrl = `${baseURL}/signup`;

      console.log(`[FlowBuilder] Navigating to: ${signupUrl}`);
      // Use 'load' instead of 'networkidle' for more reliable navigation
      await this.page.goto(signupUrl, { waitUntil: 'load', timeout: 30000 });

      // Wait for form to be visible
      await this.page.waitForSelector('form.auth-form', { timeout: 10000 });

      await this.page.fill('#firstName', data.firstName);
      await this.page.fill('#lastName', data.lastName);
      await this.page.fill('#email', data.email);
      await this.page.locator('#phone input').fill(data.phone);
      await this.page.locator('#password input').fill(data.password);
      await this.page.locator('#confirmPassword input').fill(data.password);

      // Wait for any Vite error overlay to disappear or dismiss it
      const errorOverlay = this.page.locator('vite-error-overlay');
      const overlayVisible = await errorOverlay.isVisible().catch(() => false);
      if (overlayVisible) {
        console.log(`[FlowBuilder] Vite error overlay detected, attempting to dismiss...`);
        // Try to close the overlay by clicking the close button or pressing Escape
        const closeButton = errorOverlay.locator('button[aria-label="close"], button:has-text("×"), button:has-text("Close")');
        const hasCloseButton = await closeButton.count().catch(() => 0);
        if (hasCloseButton > 0) {
          await closeButton.first().click({ timeout: 2000 }).catch(() => {});
        } else {
          // Try pressing Escape key
          await this.page.keyboard.press('Escape');
        }
        // Wait for overlay to disappear
        await errorOverlay.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }

      await this.page.locator('p-button[type="submit"] button').click();

      console.log(`[FlowBuilder] Signup form submitted`);
      
      // Wait for navigation to verification page or dashboard
      // Use a longer timeout to allow for backend processing
      try {
        await this.page.waitForURL(
          /\/auth\/challenge\/(verify-email|verify-phone)|dashboard/,
          { timeout: 15000 }
        );
        console.log(`[FlowBuilder] Navigation successful to: ${this.page.url()}`);
      } catch (error) {
        // Check if we're still on signup page and look for actual error messages
        const currentUrl = this.page.url();
        if (currentUrl.includes('/signup')) {
          // Look for error messages (not info messages)
          // Error messages typically have error classes or are in error containers
          const errorSelectors = [
            '.p-inline-message.p-inline-message-error',
            '.p-message.p-message-error',
            '[role="alert"].p-inline-message-error',
            '.text-red-500',
            '.error-message',
          ];
          
          let actualError = null;
          for (const selector of errorSelectors) {
            const errorElement = this.page.locator(selector).first();
            const isVisible = await errorElement.isVisible().catch(() => false);
            if (isVisible) {
              actualError = await errorElement.textContent().catch(() => null);
              if (actualError && !actualError.includes('Demo Application')) {
                break;
              }
            }
          }
          
          if (actualError && !actualError.includes('Demo Application')) {
            console.error(`[FlowBuilder] Error on signup page: ${actualError}`);
            throw new Error(`Signup failed: ${actualError}`);
          }
          
          // If no actual error found, wait a bit more and check URL again
          await this.page.waitForTimeout(2000);
          const finalUrl = this.page.url();
          if (!finalUrl.includes('/signup')) {
            console.log(`[FlowBuilder] Navigation completed to: ${finalUrl}`);
            return this;
          }
          
          // Still on signup page - this might be a timeout issue
          console.error(`[FlowBuilder] Still on signup page after submission. Current URL: ${finalUrl}`);
          throw new Error('Signup form submission did not navigate to expected page');
        }
        // If we navigated successfully, don't throw
        if (!currentUrl.includes('/signup')) {
          return this;
        }
        throw error;
      }
    } catch (error) {
      console.error(`[FlowBuilder] Signup failed:`, error);
      // Log current URL and page content for debugging
      const currentUrl = this.page.url();
      console.error(`[FlowBuilder] Current URL after error: ${currentUrl}`);
      const pageContent = await this.page.content().catch(() => 'Unable to get page content');
      console.error(`[FlowBuilder] Page title: ${await this.page.title().catch(() => 'Unknown')}`);
      throw error;
    }

    return this;
  }

  /**
   * Handles email verification challenge
   * Extracts code from toast notification on screen and submits
   *
   * @param _sessionId - Optional challenge session ID (not used - code extracted from toast)
   * @returns FlowBuilder instance for chaining
   */
  async verifyEmail(_sessionId?: string): Promise<this> {
    console.log(`[FlowBuilder] Starting email verification`);

    // Wait for navigation after signup - could go to verification or dashboard
    await this.page.waitForURL(/\/(auth\/challenge\/verify-email|dashboard)/, { timeout: 15000 });

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after signup: ${currentUrl}`);

    // If already on dashboard, verification was skipped (shouldn't happen with email verification enabled)
    if (currentUrl.includes('/dashboard')) {
      console.log(`[FlowBuilder] Already on dashboard - email verification was skipped`);
      return this;
    }

    // Wait for verification form to be visible
    await this.page.waitForSelector('form', { timeout: 10000 });

    // Wait for OTP input to be visible
    await this.page.waitForSelector('p-inputotp', { timeout: 10000 });

    // Wait for toast to appear on screen - this tests that toast actually shows
    // Toast appears after backend generates code (typically 500-1500ms delay)
    console.log(`[FlowBuilder] Waiting for email verification toast to appear...`);

    // Wait for toast container to be visible
    const toastContainer = this.page.locator('p-toast[key="email"]');
    await toastContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for code display element inside toast
    const codeDisplay = toastContainer.locator('.code-display');
    await codeDisplay.waitFor({ state: 'visible', timeout: 5000 });

    // Extract code from toast on screen
    const code = await codeDisplay.textContent();
    if (!code || code.trim().length === 0) {
      throw new Error('Failed to extract email verification code from toast');
    }

    const trimmedCode = code.trim();
    console.log(`[FlowBuilder] Extracted email code from toast: ${trimmedCode}`);

    // Find OTP input - PrimeNG p-inputOtp component
    const otpInput = this.page.locator('p-inputotp input').first();
    await otpInput.fill(code);

    // Submit - button text is "Verify Code"
    await this.page.locator('button:has-text("Verify Code")').click();

    console.log(`[FlowBuilder] Email verification submitted`);
    return this;
  }

  /**
   * Handles phone/SMS verification challenge
   * Extracts code from toast notification on screen and submits
   *
   * @param _sessionId - Optional challenge session ID (not used - code extracted from toast)
   * @returns FlowBuilder instance for chaining
   */
  async verifyPhone(_sessionId?: string): Promise<this> {
    console.log(`[FlowBuilder] Starting phone verification`);

    // Wait for navigation after signup - could go to verification or dashboard
    await this.page.waitForURL(/\/(auth\/challenge\/verify-phone|dashboard)/, { timeout: 15000 });

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after signup: ${currentUrl}`);

    // If already on dashboard, verification was skipped
    if (currentUrl.includes('/dashboard')) {
      console.log(`[FlowBuilder] Already on dashboard - phone verification was skipped`);
      return this;
    }

    // Wait for verification form to be visible
    await this.page.waitForSelector('form', { timeout: 10000 });

    // Wait for toast to appear on screen - this tests that toast actually shows
    console.log(`[FlowBuilder] Waiting for SMS verification toast to appear...`);

    // Wait for toast container to be visible
    const toastContainer = this.page.locator('p-toast[key="sms"]');
    await toastContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for code display element inside toast
    const codeDisplay = toastContainer.locator('.code-display');
    await codeDisplay.waitFor({ state: 'visible', timeout: 5000 });

    // Extract code from toast on screen
    const code = await codeDisplay.textContent();
    if (!code || code.trim().length === 0) {
      throw new Error('Failed to extract SMS verification code from toast');
    }

    const trimmedCode = code.trim();
    console.log(`[FlowBuilder] Extracted SMS code from toast: ${trimmedCode}`);

    // Find OTP input - PrimeNG p-inputOtp component
    const otpInput = this.page.locator('p-inputotp input').first();
    await otpInput.fill(trimmedCode);

    // Submit - button text is "Verify Code"
    await this.page.locator('button:has-text("Verify Code")').click();

    console.log(`[FlowBuilder] Phone verification submitted`);
    return this;
  }

  /**
   * Verifies dashboard is reached
   * Strictly validates that we are on the dashboard - no auto-handling
   *
   * @returns FlowBuilder instance for chaining
   */
  async expectDashboard(): Promise<this> {
    console.log(`[FlowBuilder] Expecting dashboard`);

    // Wait for navigation and verify we're on dashboard (strict check)
    await this.page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Verify dashboard elements are visible
    await expect(this.page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(this.page.locator('p-card:has-text("Profile")')).toBeVisible();

    console.log(`[FlowBuilder] Dashboard verified`);
    return this;
  }

  /**
   * Verifies that a specific MFA method exists in the MFA widget on dashboard
   * Must be called after expectDashboard()
   *
   * @param method - MFA method to verify (e.g., 'totp', 'sms', 'email', 'passkey')
   * @returns FlowBuilder instance for chaining
   */
  async expectMfaMethodInWidget(method: MfaMethod): Promise<this> {
    console.log(`[FlowBuilder] Verifying MFA method '${method}' exists in widget`);

    // Map method to display name as shown in the widget
    const methodDisplayNames: Record<MfaMethod, string> = {
      sms: 'SMS',
      email: 'Email',
      totp: 'Authenticator App',
      passkey: 'Passkey',
    };

    const displayName = methodDisplayNames[method];
    if (!displayName) {
      throw new Error(`Unknown MFA method: ${method}`);
    }

    // Wait for MFA widget to be visible
    const mfaCard = this.page.locator('p-card:has-text("MFA Devices")');
    await expect(mfaCard).toBeVisible({ timeout: 10000 });

    // Find the device card that contains the method name
    // The method name appears in a paragraph with class "text-sm text-secondary-600":
    // "{{ getMethodName(device.type) }} • Added ..."
    // Use a more specific selector that includes the "• Added" pattern to avoid matching device names
    const methodLocator = mfaCard.locator(
      `p.text-sm.text-secondary-600:has-text("${displayName} • Added")`,
    );

    // Verify the method is visible in the enrolled devices list
    await expect(methodLocator).toBeVisible({ timeout: 5000 });

    console.log(`[FlowBuilder] MFA method '${method}' (${displayName}) verified in widget`);
    return this;
  }

  /**
   * Expects email verification screen to appear
   * Validates URL and presence of verification form
   *
   * @returns FlowBuilder instance for chaining
   */
  async expectEmailVerification(): Promise<this> {
    console.log(`[FlowBuilder] Expecting email verification screen`);
    
    // Log current URL for debugging
    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL: ${currentUrl}`);

    await this.page.waitForURL(/\/auth\/challenge\/verify-email/, { timeout: 15000 });
    await this.page.waitForSelector('form', { timeout: 10000 });

    console.log(`[FlowBuilder] Email verification screen verified`);
    return this;
  }

  /**
   * Expects phone verification screen to appear
   * Validates URL and presence of verification form
   *
   * @returns FlowBuilder instance for chaining
   */
  async expectPhoneVerification(): Promise<this> {
    console.log(`[FlowBuilder] Expecting phone verification screen`);

    await this.page.waitForURL(/\/auth\/challenge\/verify-phone/, { timeout: 15000 });
    await this.page.waitForSelector('form', { timeout: 10000 });

    console.log(`[FlowBuilder] Phone verification screen verified`);
    return this;
  }

  /**
   * Expects MFA setup screen to appear
   * Validates URL and presence of method selection
   *
   * @returns FlowBuilder instance for chaining
   */
  async expectMfaSetup(): Promise<this> {
    console.log(`[FlowBuilder] Expecting MFA setup screen`);

    await this.page.waitForURL(/\/auth\/challenge\/mfa-setup-required/, { timeout: 15000 });
    await expect(
      this.page
        .locator('h2')
        .filter({ hasText: /Set Up Multi-Factor Authentication|Add Multi-Factor Authentication/i }),
    ).toBeVisible({ timeout: 10000 });

    console.log(`[FlowBuilder] MFA setup screen verified`);
    return this;
  }

  /**
   * Selects MFA method from setup screen
   * Handles both signup and dashboard MFA setup
   *
   * Note: Method buttons contain h3 elements with specific text:
   * - 'sms' -> "SMS"
   * - 'email' -> "Email"
   * - 'totp' -> "Authenticator App"
   * - 'passkey' -> "Passkey"
   *
   * @param method - MFA method to select
   * @returns FlowBuilder instance for chaining
   */
  async selectMfaMethod(method: MfaMethod): Promise<this> {
    console.log(`[FlowBuilder] Selecting MFA method: ${method}`);

    // Wait for MFA selection screen
    await expect(
      this.page
        .locator('h2')
        .filter({ hasText: /Set Up Multi-Factor Authentication|Add Multi-Factor Authentication/i }),
    ).toBeVisible({ timeout: 10000 });

    // Map method to actual button text in h3 element
    const methodTextMap: Record<MfaMethod, string> = {
      sms: 'SMS',
      email: 'Email',
      totp: 'Authenticator App',
      passkey: 'Passkey',
    };

    const buttonText = methodTextMap[method];

    // Find button containing h3 with the method text
    const methodButton = this.page.locator(`button:has(h3:text-is("${buttonText}"))`);
    await methodButton.click();

    console.log(`[FlowBuilder] Selected ${method} for MFA`);
    return this;
  }

  /**
   * Sets up TOTP MFA
   * Extracts secret from UI and generates/verifies code
   *
   * @returns FlowBuilder instance for chaining
   */
  async setupTotp(): Promise<this> {
    console.log(`[FlowBuilder] Starting TOTP setup`);

    // Wait for TOTP setup screen to load (QR code and manual key)
    // The manual key appears in a <code> element with class "manual-key-text"
    await this.page.waitForSelector('code.manual-key-text', { timeout: 10000 });

    // Extract TOTP secret from manual key
    const secret = await this.extractTotpSecret();
    console.log(`[FlowBuilder] Extracted TOTP secret: ${secret.substring(0, 8)}...`);

    // Generate TOTP code using helper
    const code = this.helpers.generateTotpCode(secret);
    console.log(`[FlowBuilder] Generated TOTP code: ${code}`);

    // Enter code - p-inputOtp with formControlName="code"
    const codeInput = this.page.locator('p-inputotp input').first();
    await codeInput.fill(code);

    // Submit - button text is "Complete Setup"
    await this.page.locator('button:has-text("Complete Setup")').click();

    // Wait for navigation after TOTP setup completes
    // Could go to dashboard or another challenge
    await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] TOTP setup completed, current URL: ${currentUrl}`);

    // Check if there's an error message
    const errorMessage = this.page.locator('p-message[severity="error"]');
    const hasError = (await errorMessage.count()) > 0;
    if (hasError) {
      const errorText = await errorMessage.first().textContent();
      throw new Error(`TOTP setup failed with error: ${errorText}`);
    }

    console.log(`[FlowBuilder] TOTP setup completed successfully`);
    return this;
  }

  /**
   * Extracts TOTP secret from setup screen
   *
   * UI structure: Manual key is displayed in a <code> element with class "manual-key-text"
   * HTML: <code class="manual-key-text">ABCD 1234 EFGH...</code>
   * Note: The secret may be displayed with spaces for readability, but we need the raw secret
   *
   * @returns TOTP secret string (spaces removed)
   */
  private async extractTotpSecret(): Promise<string> {
    // Wait for manual key to be visible
    const codeElement = this.page.locator('code.manual-key-text');
    await codeElement.waitFor({ state: 'visible', timeout: 5000 });

    const secret = await codeElement.textContent();
    if (!secret || secret.trim().length < 16) {
      throw new Error(`Invalid TOTP secret extracted: ${secret}`);
    }

    // Remove all spaces from the secret (UI may display with spaces for readability)
    const cleanSecret = secret.trim().replace(/\s+/g, '');

    if (cleanSecret.length < 16) {
      throw new Error(`Invalid TOTP secret after cleaning: ${cleanSecret}`);
    }

    return cleanSecret;
  }

  /**
   * Sets up SMS MFA
   * Handles phone already verified (auto-complete) vs new verification
   *
   * @returns FlowBuilder instance for chaining
   */
  async setupSmsMfa(): Promise<this> {
    console.log(`[FlowBuilder] Starting SMS MFA setup`);

    // Wait for navigation after selecting SMS method
    // Could be on mfa-setup-required (auto-complete) or mfa-setup-required/verify (needs code)
    await this.page.waitForURL(
      /\/(auth\/challenge\/mfa-setup-required|auth\/challenge\/mfa-setup-required\/verify)/,
      { timeout: 10000 },
    );

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after SMS selection: ${currentUrl}`);

    // Check if phone is already verified (auto-complete screen)
    // Auto-complete stays on /auth/challenge/mfa-setup-required and shows "Setup Complete!"
    // If we're on /verify, we need to enter a code
    const isOnVerifyRoute = currentUrl.includes('/mfa-setup-required/verify');

    if (!isOnVerifyRoute) {
      // Check for auto-complete screen on the setup route
      // Wait a bit for the component to load setup data
      await this.page.waitForTimeout(1000);

      const autoCompleteHeading = this.page.locator('h3:text-is("Setup Complete!")');
      const isAlreadyVerified = await autoCompleteHeading
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isAlreadyVerified) {
        console.log(`[FlowBuilder] Phone already verified, clicking Continue`);
        // Click Continue button on auto-complete screen
        await this.page.locator('button:has-text("Continue")').click();

        // Wait for navigation after continuing
        await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
        console.log(`[FlowBuilder] SMS MFA setup completed (auto-complete)`);
        return this;
      } else {
        // Not auto-complete, but we're not on verify route either
        // This shouldn't happen, but let's wait a bit more and check again
        console.log(`[FlowBuilder] Not on verify route and auto-complete not detected, waiting...`);
        await this.page.waitForTimeout(2000);

        // Check if we navigated to verify route
        const newUrl = this.page.url();
        if (newUrl.includes('/mfa-setup-required/verify')) {
          console.log(`[FlowBuilder] Navigated to verify route`);
          // Fall through to code entry
        } else {
          // Still on setup route, check auto-complete again
          const stillAutoComplete = await autoCompleteHeading
            .isVisible({ timeout: 2000 })
            .catch(() => false);
          if (stillAutoComplete) {
            console.log(`[FlowBuilder] Auto-complete detected after wait, clicking Continue`);
            await this.page.locator('button:has-text("Continue")').click();
            await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
            console.log(`[FlowBuilder] SMS MFA setup completed (auto-complete)`);
            return this;
          } else {
            throw new Error(
              `Unexpected state: on ${newUrl} but no auto-complete and not on verify route`,
            );
          }
        }
      }
    }

    // If we reach here, we're on the verify route and need to enter a code
    {
      console.log(`[FlowBuilder] Phone not verified, entering SMS code`);

      // Wait for OTP verification form to be visible
      await this.page.waitForSelector('form', { timeout: 10000 });

      // Wait for toast to appear on screen - this tests that toast actually shows
      console.log(`[FlowBuilder] Waiting for SMS verification toast to appear...`);

      // Wait for toast container to be visible (key="sms" for SMS)
      const toastContainer = this.page.locator('p-toast[key="sms"]');
      await toastContainer.waitFor({ state: 'visible', timeout: 10000 });

      // Wait for code display element inside toast
      const codeDisplay = toastContainer.locator('.code-display');
      await codeDisplay.waitFor({ state: 'visible', timeout: 5000 });

      // Extract code from toast on screen
      const code = await codeDisplay.textContent();
      if (!code || code.trim().length === 0) {
        throw new Error('Failed to extract SMS verification code from toast');
      }

      const trimmedCode = code.trim();
      console.log(`[FlowBuilder] Extracted SMS code from toast: ${trimmedCode}`);

      // Find OTP input - PrimeNG p-inputOtp component
      const otpInput = this.page.locator('p-inputotp input').first();
      await otpInput.fill(trimmedCode);

      // Submit - button text is "Verify Code"
      await this.page.locator('button:has-text("Verify Code")').click();

      // Wait for navigation after verification
      await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
    }

    console.log(`[FlowBuilder] SMS MFA setup completed`);
    return this;
  }

  /**
   * Sets up Email MFA
   * Handles email already verified (auto-complete) vs new verification
   *
   * @returns FlowBuilder instance for chaining
   */
  async setupEmailMfa(): Promise<this> {
    console.log(`[FlowBuilder] Starting Email MFA setup`);

    // Wait for navigation after selecting Email method
    // Could be on mfa-setup-required (auto-complete) or mfa-setup-required/verify (needs code)
    await this.page.waitForURL(
      /\/(auth\/challenge\/mfa-setup-required|auth\/challenge\/mfa-setup-required\/verify)/,
      { timeout: 10000 },
    );

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after Email selection: ${currentUrl}`);

    // Check if email is already verified (auto-complete screen)
    // Auto-complete stays on /auth/challenge/mfa-setup-required and shows "Setup Complete!"
    // If we're on /verify, we need to enter a code
    const isOnVerifyRoute = currentUrl.includes('/mfa-setup-required/verify');

    if (!isOnVerifyRoute) {
      // Check for auto-complete screen on the setup route
      // Wait a bit for the component to load setup data
      await this.page.waitForTimeout(1000);

      const autoCompleteHeading = this.page.locator('h3:text-is("Setup Complete!")');
      const isAlreadyVerified = await autoCompleteHeading
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isAlreadyVerified) {
        console.log(`[FlowBuilder] Email already verified, clicking Continue`);
        // Click Continue button on auto-complete screen
        await this.page.locator('button:has-text("Continue")').click();

        // Wait for navigation after continuing
        await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
        console.log(`[FlowBuilder] Email MFA setup completed (auto-complete)`);
        return this;
      } else {
        // Not auto-complete, but we're not on verify route either
        // This shouldn't happen, but let's wait a bit more and check again
        console.log(`[FlowBuilder] Not on verify route and auto-complete not detected, waiting...`);
        await this.page.waitForTimeout(2000);

        // Check if we navigated to verify route
        const newUrl = this.page.url();
        if (newUrl.includes('/mfa-setup-required/verify')) {
          console.log(`[FlowBuilder] Navigated to verify route`);
          // Fall through to code entry
        } else {
          // Still on setup route, check auto-complete again
          const stillAutoComplete = await autoCompleteHeading
            .isVisible({ timeout: 2000 })
            .catch(() => false);
          if (stillAutoComplete) {
            console.log(`[FlowBuilder] Auto-complete detected after wait, clicking Continue`);
            await this.page.locator('button:has-text("Continue")').click();
            await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
            console.log(`[FlowBuilder] Email MFA setup completed (auto-complete)`);
            return this;
          } else {
            throw new Error(
              `Unexpected state: on ${newUrl} but no auto-complete and not on verify route`,
            );
          }
        }
      }
    }

    // If we reach here, we're on the verify route and need to enter a code
    {
      console.log(`[FlowBuilder] Email not verified, entering email code`);

      // Wait for OTP verification form to be visible
      await this.page.waitForSelector('form', { timeout: 10000 });

      // Wait for toast to appear on screen - this tests that toast actually shows
      console.log(`[FlowBuilder] Waiting for Email verification toast to appear...`);

      // Wait for toast container to be visible (key="email" for Email)
      const toastContainer = this.page.locator('p-toast[key="email"]');
      await toastContainer.waitFor({ state: 'visible', timeout: 10000 });

      // Wait for code display element inside toast
      const codeDisplay = toastContainer.locator('.code-display');
      await codeDisplay.waitFor({ state: 'visible', timeout: 5000 });

      // Extract code from toast on screen
      const code = await codeDisplay.textContent();
      if (!code || code.trim().length === 0) {
        throw new Error('Failed to extract Email verification code from toast');
      }

      const trimmedCode = code.trim();
      console.log(`[FlowBuilder] Extracted Email code from toast: ${trimmedCode}`);

      // Find OTP input - PrimeNG p-inputOtp component
      const otpInput = this.page.locator('p-inputotp input').first();
      await otpInput.fill(trimmedCode);

      // Submit - button text is "Verify Code"
      await this.page.locator('button:has-text("Verify Code")').click();

      // Wait for navigation after verification
      await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
    }

    console.log(`[FlowBuilder] Email MFA setup completed`);
    return this;
  }

  /**
   * Performs login with email and password
   *
   * @param email - User email
   * @param password - User password
   * @returns FlowBuilder instance for chaining
   */
  async login(email: string, password: string): Promise<this> {
    console.log(`[FlowBuilder] Logging in as ${email}`);

    // Navigate to login page
    const frontendUrl = process.env.FRONTEND_URL || 'https://angular.dev1.noorix.com';
    await this.page.goto(`${frontendUrl}/login`, { waitUntil: 'load' });

    // Wait for login form to be visible
    await this.page.waitForSelector('form.auth-form', { timeout: 10000 });

    // Fill email field
    await this.page.locator('#email').fill(email);

    // Fill password field (PrimeNG p-password component)
    await this.page.locator('#password input').fill(password);

    // Submit form
    await this.page.locator('p-button[type="submit"] button').click();

    console.log(`[FlowBuilder] Login submitted`);
    return this;
  }

  /**
   * Logs out current user
   * Clicks the "Sign Out" split button in the dashboard header
   *
   * @returns FlowBuilder instance for chaining
   */
  async logout(): Promise<this> {
    console.log(`[FlowBuilder] Logging out`);

    // Click "Sign Out" split button in dashboard header
    const signOutButton = this.page.locator('p-splitButton:has-text("Sign Out") button').first();
    await signOutButton.click();

    // Wait for redirect to login page
    await this.page.waitForURL(/\/login/, { timeout: 10000 });

    console.log(`[FlowBuilder] Logged out`);
    return this;
  }

  /**
   * Gets userId from the profile on dashboard
   * Extracts it from the profile card or API
   *
   * @returns User ID string
   */
  async getUserId(): Promise<string> {
    // Try to get userId from profile API
    const apiBaseUrl = process.env.API_BASE_URL || 'https://api.angular.dev1.noorix.com';

    // Get auth cookies from browser
    const cookies = await this.page.context().cookies();
    const authCookie = cookies.find(
      (c) => c.name.includes('access_token') || c.name.includes('auth'),
    );

    if (!authCookie) {
      throw new Error('Not authenticated - cannot get userId');
    }

    // Call profile API to get user info
    const response = await this.page.request.get(`${apiBaseUrl}/auth/profile`, {
      headers: {
        Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to get profile: ${response.status()}`);
    }

    const user = await response.json();
    const userId = user.id || user.userId;

    if (!userId) {
      throw new Error('User ID not found in profile response');
    }

    console.log(`[FlowBuilder] Retrieved userId: ${userId}`);
    return userId;
  }

  /**
   * Verifies TOTP during login challenge
   * Requires user to have TOTP already set up
   *
   * @param userId - User ID to fetch TOTP secret
   * @returns FlowBuilder instance for chaining
   */
  async verifyTotpLogin(userId: string): Promise<this> {
    console.log(`[FlowBuilder] Verifying TOTP for login`);

    // Wait for MFA challenge screen
    // Could be MFA selector first, or directly to OTP verify
    await this.page.waitForURL(/\/auth\/challenge\/(mfa-required|mfa-selector|verify-totp)/, {
      timeout: 10000,
    });

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after login: ${currentUrl}`);

    // Check if we need to select TOTP method first (MFA selector screen)
    if (currentUrl.includes('/mfa-selector') || currentUrl.includes('/mfa-required')) {
      // Check if there's a method selector - look for "Authenticator App" button
      const totpButton = this.page.locator('button:has(h3:text-is("Authenticator App"))');
      const hasSelector = (await totpButton.count()) > 0;

      if (hasSelector) {
        console.log(`[FlowBuilder] Selecting TOTP method from selector`);
        await totpButton.click();
        // Wait for navigation to OTP verify screen
        await this.page.waitForURL(/\/auth\/challenge\/(mfa-required|verify-totp)/, {
          timeout: 10000,
        });
      }
    }

    // Wait for OTP input to be visible
    await this.page.waitForSelector('p-inputotp, input[type="text"]', { timeout: 10000 });

    // Get TOTP secret for user
    const secret = await this.helpers.getTotpSecret(userId);
    console.log(`[FlowBuilder] Retrieved TOTP secret for user`);

    // Wait a moment to ensure we're in a stable 30-second window
    // This helps avoid edge cases where we generate at the boundary between windows
    await this.page.waitForTimeout(500);

    // Generate TOTP code right before entering to ensure we get the current valid code
    // TOTP codes change every 30 seconds (standard)
    // Generate immediately before entering to minimize window expiration risk
    const code = this.helpers.generateTotpCode(secret);
    console.log(`[FlowBuilder] Generated TOTP code: ${code} (current 30s window)`);

    // Enter code - try p-inputOtp first, then fallback to regular input
    const otpInput = this.page.locator('p-inputotp input').first();
    const inputExists = (await otpInput.count()) > 0;

    if (inputExists) {
      // For p-inputOtp, we need to enter digits one by one
      // First, clear all inputs
      const allInputs = this.page.locator('p-inputotp input');
      const inputCount = await allInputs.count();
      for (let i = 0; i < inputCount; i++) {
        await allInputs.nth(i).clear();
      }

      // Focus the first input
      await otpInput.focus();
      await this.page.waitForTimeout(100);

      // Fill the first input with the full code - PrimeNG will distribute it
      // Using fill() instead of deprecated type()
      await otpInput.fill(code);

      // Wait for PrimeNG to process and distribute digits
      await this.page.waitForTimeout(300);

      // Verify the code was entered correctly by checking all inputs
      const enteredCode = await this.page.evaluate(() => {
        // @ts-ignore - Code runs in browser context where 'document' exists
        const inputs = Array.from(document.querySelectorAll('p-inputotp input')) as Array<{
          value: string;
        }>;
        return inputs.map((i) => i.value).join('');
      });

      console.log(`[FlowBuilder] Entered code: ${enteredCode}, Expected: ${code}`);

      if (enteredCode !== code) {
        // If code doesn't match, try entering digit by digit manually
        console.log(`[FlowBuilder] Code mismatch, trying digit-by-digit entry...`);
        for (let i = 0; i < inputCount; i++) {
          await allInputs.nth(i).clear();
        }
        await this.page.waitForTimeout(100);

        for (let i = 0; i < code.length; i++) {
          const digit = code[i];
          const currentInput = allInputs.nth(i);
          await currentInput.focus();
          await currentInput.fill(digit);
          await this.page.waitForTimeout(50);
        }

        // Verify again
        const retryCode = await this.page.evaluate(() => {
          // @ts-ignore - Code runs in browser context where 'document' exists
          const inputs = Array.from(document.querySelectorAll('p-inputotp input')) as Array<{
            value: string;
          }>;
          return inputs.map((i) => i.value).join('');
        });

        console.log(`[FlowBuilder] After retry, entered code: ${retryCode}, Expected: ${code}`);

        if (retryCode !== code) {
          throw new Error(`Code entry failed: entered "${retryCode}", expected "${code}"`);
        }
      }
    } else {
      // Fallback to regular text input
      const textInput = this.page.locator('input[type="text"]').first();
      await textInput.clear();
      await textInput.fill(code);
    }

    // Wait a moment to ensure code is fully entered
    await this.page.waitForTimeout(500);

    // Check for any error messages before submitting
    const errorBeforeSubmit = this.page.locator('p-message[severity="error"]');
    if ((await errorBeforeSubmit.count()) > 0) {
      const errorText = await errorBeforeSubmit.first().textContent();
      console.log(`[FlowBuilder] Error before submit: ${errorText}`);
    }

    // Submit - button text could be "Verify", "Verify Code", or "Continue"
    const submitButton = this.page
      .locator(
        'button:has-text("Verify"), button:has-text("Verify Code"), button:has-text("Continue")',
      )
      .first();
    await submitButton.click();

    // Wait for navigation after verification
    await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });

    const afterVerificationUrl = this.page.url();
    console.log(`[FlowBuilder] After TOTP verification, current URL: ${afterVerificationUrl}`);

    // If still on challenge route, check for errors or wait for navigation
    if (afterVerificationUrl.includes('/auth/challenge')) {
      // Wait a moment for any error messages to appear
      await this.page.waitForTimeout(1000);

      // Check for error message
      const errorMessage = this.page.locator('p-message[severity="error"]');
      const hasError = (await errorMessage.count()) > 0;
      if (hasError) {
        const errorText = await errorMessage.first().textContent();
        console.log(`[FlowBuilder] Error message found: ${errorText}`);

        // If it's an invalid code error, try generating a new code (might be in different 30s window)
        // TOTP codes change every 30 seconds, so if signup and login happen in different windows, code will differ
        const isInvalidCodeError =
          errorText &&
          (errorText.toLowerCase().includes('invalid') ||
            errorText.toLowerCase().includes('incorrect') ||
            errorText.toLowerCase().includes('wrong'));

        if (isInvalidCodeError) {
          // Note: TOTP setup codes are one-time use and cannot be reused for login.
          // If we get "Invalid MFA code", it might be due to clock skew or timing.
          // Wait for the next 30-second window and try again with a fresh code
          console.log(`[FlowBuilder] Invalid code detected, waiting for next 30s window...`);
          await this.page.waitForTimeout(35000); // Wait 35s to ensure we're in a new window

          // Generate fresh code in the new window
          const newCode = this.helpers.generateTotpCode(secret);
          console.log(`[FlowBuilder] Generated new TOTP code: ${newCode} (new 30s window)`);

          // Clear and re-enter the code
          const otpInputRetry = this.page.locator('p-inputotp input').first();
          const inputExistsRetry = (await otpInputRetry.count()) > 0;

          if (inputExistsRetry) {
            // Clear all inputs
            const allInputsRetry = this.page.locator('p-inputotp input');
            const inputCountRetry = await allInputsRetry.count();
            for (let i = 0; i < inputCountRetry; i++) {
              await allInputsRetry.nth(i).clear();
            }
            await this.page.waitForTimeout(100);

            // Enter new code
            await otpInputRetry.focus();
            await otpInputRetry.fill(newCode);
            await this.page.waitForTimeout(300);
          } else {
            const textInputRetry = this.page.locator('input[type="text"]').first();
            await textInputRetry.clear();
            await textInputRetry.fill(newCode);
          }

          // Submit again
          await this.page
            .locator(
              'button:has-text("Verify"), button:has-text("Verify Code"), button:has-text("Continue")',
            )
            .first()
            .click();

          // Wait for navigation
          await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });
          const retryUrl = this.page.url();
          console.log(`[FlowBuilder] After retry, URL: ${retryUrl}`);

          if (retryUrl.includes('/dashboard')) {
            console.log(`[FlowBuilder] TOTP login verification completed after retry`);
            return this;
          }

          // Check for error again after retry
          await this.page.waitForTimeout(1000);
          const retryError = this.page.locator('p-message[severity="error"]');
          if ((await retryError.count()) > 0) {
            const retryErrorText = await retryError.first().textContent();
            throw new Error(`TOTP login verification failed after retry: ${retryErrorText}`);
          }
        } else {
          // Not an invalid code error, throw immediately
          throw new Error(`TOTP login verification failed: ${errorText}`);
        }
      }

      // Wait a bit more for navigation to complete
      await this.page.waitForTimeout(2000);
      const finalUrl = this.page.url();
      console.log(`[FlowBuilder] Final URL after wait: ${finalUrl}`);

      if (!finalUrl.includes('/dashboard')) {
        // Still not on dashboard - might be another challenge or error
        // Check for error again
        const finalError = this.page.locator('p-message[severity="error"]');
        if ((await finalError.count()) > 0) {
          const errorText = await finalError.first().textContent();
          throw new Error(`TOTP login verification failed: ${errorText}`);
        }
        throw new Error(`Expected dashboard after TOTP verification, but on: ${finalUrl}`);
      }
    }

    console.log(`[FlowBuilder] TOTP login verification completed`);
    return this;
  }

  /**
   * Verifies SMS MFA during login challenge
   * Extracts code from toast notification and submits
   *
   * @returns FlowBuilder instance for chaining
   */
  async verifySmsMfaLogin(): Promise<this> {
    console.log(`[FlowBuilder] Verifying SMS MFA for login`);

    // Wait for MFA challenge screen
    await this.page.waitForURL(/\/auth\/challenge\/(mfa-required|mfa-selector)/, {
      timeout: 10000,
    });

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after login: ${currentUrl}`);

    // Check if we need to select SMS method first (MFA selector screen)
    if (currentUrl.includes('/mfa-selector')) {
      const smsButton = this.page.locator('button:has(h3:text-is("SMS"))');
      const hasSelector = (await smsButton.count()) > 0;

      if (hasSelector) {
        console.log(`[FlowBuilder] Selecting SMS method from selector`);
        await smsButton.click();
        // Wait for navigation to OTP verify screen
        await this.page.waitForURL(/\/auth\/challenge\/mfa-required/, { timeout: 10000 });
      }
    }

    // Wait for OTP verification form to be visible
    await this.page.waitForSelector('form', { timeout: 10000 });

    // Wait for toast to appear on screen
    console.log(`[FlowBuilder] Waiting for SMS MFA verification toast to appear...`);

    // Wait for toast container to be visible (key="sms" for SMS)
    const toastContainer = this.page.locator('p-toast[key="sms"]');
    await toastContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for code display element inside toast
    const codeDisplay = toastContainer.locator('.code-display');
    await codeDisplay.waitFor({ state: 'visible', timeout: 5000 });

    // Extract code from toast on screen
    const code = await codeDisplay.textContent();
    if (!code || code.trim().length === 0) {
      throw new Error('Failed to extract SMS MFA verification code from toast');
    }

    const trimmedCode = code.trim();
    console.log(`[FlowBuilder] Extracted SMS MFA code from toast: ${trimmedCode}`);

    // Find OTP input - PrimeNG p-inputOtp component
    const otpInput = this.page.locator('p-inputotp input').first();
    await otpInput.fill(trimmedCode);

    // Submit - button text is "Verify Code"
    await this.page.locator('button:has-text("Verify Code")').click();

    // Wait for navigation after verification
    await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });

    console.log(`[FlowBuilder] SMS MFA login verification completed`);
    return this;
  }

  /**
   * Verifies Email MFA during login challenge
   * Extracts code from toast notification and submits
   *
   * @returns FlowBuilder instance for chaining
   */
  async verifyEmailMfaLogin(): Promise<this> {
    console.log(`[FlowBuilder] Verifying Email MFA for login`);

    // Wait for MFA challenge screen
    await this.page.waitForURL(/\/auth\/challenge\/(mfa-required|mfa-selector)/, {
      timeout: 10000,
    });

    const currentUrl = this.page.url();
    console.log(`[FlowBuilder] Current URL after login: ${currentUrl}`);

    // Check if we need to select Email method first (MFA selector screen)
    if (currentUrl.includes('/mfa-selector')) {
      const emailButton = this.page.locator('button:has(h3:text-is("Email"))');
      const hasSelector = (await emailButton.count()) > 0;

      if (hasSelector) {
        console.log(`[FlowBuilder] Selecting Email method from selector`);
        await emailButton.click();
        // Wait for navigation to OTP verify screen
        await this.page.waitForURL(/\/auth\/challenge\/mfa-required/, { timeout: 10000 });
      }
    }

    // Wait for OTP verification form to be visible
    await this.page.waitForSelector('form', { timeout: 10000 });

    // Wait for toast to appear on screen
    console.log(`[FlowBuilder] Waiting for Email MFA verification toast to appear...`);

    // Wait for toast container to be visible (key="email" for Email)
    const toastContainer = this.page.locator('p-toast[key="email"]');
    await toastContainer.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for code display element inside toast
    const codeDisplay = toastContainer.locator('.code-display');
    await codeDisplay.waitFor({ state: 'visible', timeout: 5000 });

    // Extract code from toast on screen
    const code = await codeDisplay.textContent();
    if (!code || code.trim().length === 0) {
      throw new Error('Failed to extract Email MFA verification code from toast');
    }

    const trimmedCode = code.trim();
    console.log(`[FlowBuilder] Extracted Email MFA code from toast: ${trimmedCode}`);

    // Find OTP input - PrimeNG p-inputOtp component
    const otpInput = this.page.locator('p-inputotp input').first();
    await otpInput.fill(trimmedCode);

    // Submit - button text is "Verify Code"
    await this.page.locator('button:has-text("Verify Code")').click();

    // Wait for navigation after verification
    await this.page.waitForURL(/\/(dashboard|auth\/challenge)/, { timeout: 15000 });

    console.log(`[FlowBuilder] Email MFA login verification completed`);
    return this;
  }

  /**
   * Navigates to dashboard (assumes already logged in)
   *
   * @returns FlowBuilder instance for chaining
   */
  async navigateToDashboard(): Promise<this> {
    console.log(`[FlowBuilder] Navigating to dashboard`);

    const frontendUrl = process.env.FRONTEND_URL || 'https://angular.dev1.noorix.com';
    await this.page.goto(`${frontendUrl}/dashboard`, { waitUntil: 'load' });

    // Wait for dashboard to load
    await this.page.waitForSelector('h1:has-text("Dashboard")', { timeout: 10000 });

    console.log(`[FlowBuilder] Dashboard loaded`);
    return this;
  }

  /**
   * Opens MFA enrollment from dashboard
   * Clicks "Enroll New Device" button in MFA Devices card
   *
   * @returns FlowBuilder instance for chaining
   */
  async addMfaFromDashboard(): Promise<this> {
    console.log(`[FlowBuilder] Adding MFA from dashboard`);

    // Wait for MFA Devices card to be visible
    const mfaCard = this.page.locator('p-card:has-text("MFA Devices")');
    await expect(mfaCard).toBeVisible({ timeout: 10000 });

    // Scroll card into view if needed
    await mfaCard.scrollIntoViewIfNeeded();

    // Click "Enroll New Device" button
    const enrollButton = this.page.locator('button:has-text("Enroll New Device")');
    await expect(enrollButton).toBeVisible({ timeout: 5000 });
    await enrollButton.click();

    // Wait for navigation to MFA enrollment page
    await this.page.waitForURL(/\/dashboard\/mfa\/enroll/, { timeout: 10000 });

    // Wait for MFA method selection screen
    await expect(
      this.page
        .locator('h2')
        .filter({ hasText: /Set Up Multi-Factor Authentication|Add Multi-Factor Authentication/i }),
    ).toBeVisible({ timeout: 10000 });

    console.log(`[FlowBuilder] MFA enrollment initiated from dashboard`);
    return this;
  }

  /**
   * Removes MFA method from dashboard
   * Finds device by method type, opens menu, clicks Delete, and confirms
   *
   * @param method - MFA method to remove (e.g., 'totp', 'sms', 'email')
   * @returns FlowBuilder instance for chaining
   */
  async removeMfaFromDashboard(method: MfaMethod): Promise<this> {
    console.log(`[FlowBuilder] Removing ${method} MFA from dashboard`);

    // Map method to display name as shown in the widget
    const methodDisplayNames: Record<MfaMethod, string> = {
      sms: 'SMS',
      email: 'Email',
      totp: 'Authenticator App',
      passkey: 'Passkey',
    };

    const displayName = methodDisplayNames[method];
    if (!displayName) {
      throw new Error(`Unknown MFA method: ${method}`);
    }

    // Wait for MFA Devices card to be visible
    const mfaCard = this.page.locator('p-card:has-text("MFA Devices")');
    await expect(mfaCard).toBeVisible({ timeout: 10000 });
    await mfaCard.scrollIntoViewIfNeeded();

    // Find the device row that contains the method name
    // The method name appears in a paragraph: "{{ getMethodName(device.type) }} • Added ..."
    const methodLocator = mfaCard.locator(
      `p.text-sm.text-secondary-600:has-text("${displayName} • Added")`,
    );
    await expect(methodLocator).toBeVisible({ timeout: 5000 });

    // Find the parent device row container
    // The structure is: device row > device info > paragraph with method name
    const deviceRow = methodLocator.locator('xpath=ancestor::div[contains(@class, "border")]');

    // Find the ellipsis menu button in this row
    const menuButton = deviceRow.locator('p-button[icon="pi pi-ellipsis-v"] button');
    await expect(menuButton).toBeVisible({ timeout: 5000 });
    await menuButton.click();

    // Wait for PrimeNG menu to appear
    // PrimeNG menu is appended to body, so we look for it there
    const deleteMenuItem = this.page.locator('p-menu li:has-text("Delete")');
    await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });

    // Click Delete menu item
    await deleteMenuItem.click();

    // Wait for confirmation dialog
    const confirmDialog = this.page.locator('p-confirmdialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Click confirm button in dialog
    // PrimeNG confirm dialog has "Yes" or "Accept" button
    const confirmButton = this.page
      .locator('p-confirmdialog button:has-text("Yes"), p-confirmdialog button:has-text("Accept")')
      .first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Wait for dialog to close and device to be removed
    await confirmDialog.waitFor({ state: 'hidden', timeout: 10000 });

    // Wait a moment for UI to update
    await this.page.waitForTimeout(1000);

    console.log(`[FlowBuilder] ${method} MFA removed from dashboard`);
    return this;
  }

  /**
   * Tests resend code functionality
   * Waits for resend button to be enabled and clicks it
   *
   * @returns FlowBuilder instance for chaining
   */
  async resendCode(): Promise<this> {
    console.log(`[FlowBuilder] Testing resend code`);

    const resendButton = this.page.locator('button:has-text("Resend"), a:has-text("Resend")');

    // Wait for button to be visible
    await resendButton.waitFor({ state: 'visible', timeout: 60000 });

    // Wait additional time if timer is running
    const isDisabled = await resendButton.isDisabled().catch(() => false);
    if (isDisabled) {
      console.log(`[FlowBuilder] Waiting for resend timer to expire`);
      await this.page.waitForTimeout(30000); // Max resend timer
    }

    await resendButton.click();

    // Wait for new toast
    await this.page.waitForTimeout(2000);

    console.log(`[FlowBuilder] Code resent successfully`);
    return this;
  }

  /**
   * Tests back navigation from verification screen
   *
   * @returns FlowBuilder instance for chaining
   */
  async goBack(): Promise<this> {
    console.log(`[FlowBuilder] Navigating back`);

    const backButton = this.page.locator('button:has-text("Back"), a:has-text("Back")');
    await backButton.click();

    console.log(`[FlowBuilder] Navigated back`);
    return this;
  }

  /**
   * Enters invalid code to trigger error
   * Validates that error message is displayed
   *
   * @returns FlowBuilder instance for chaining
   */
  async enterInvalidCode(): Promise<this> {
    console.log(`[FlowBuilder] Entering invalid code`);

    const otpInput = this.page.locator('p-inputotp input, input[type="text"]').first();
    await otpInput.fill('000000');

    await this.page.locator('button:has-text("Verify"), button:has-text("Verify Code")').click();

    // Wait for error message
    await expect(this.page.locator('text=/invalid|incorrect|wrong|error/i')).toBeVisible({
      timeout: 5000,
    });

    console.log(`[FlowBuilder] Invalid code error displayed`);
    return this;
  }

  /**
   * Expects error message to be visible
   * Validates that an error occurred
   *
   * @returns FlowBuilder instance for chaining
   */
  async expectError(): Promise<this> {
    console.log(`[FlowBuilder] Expecting error message`);

    await expect(
      this.page.locator('p-message[severity="error"], text=/error|invalid|incorrect|wrong/i'),
    ).toBeVisible({ timeout: 5000 });

    console.log(`[FlowBuilder] Error message verified`);
    return this;
  }
}
