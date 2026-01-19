import { Injectable, Inject, PLATFORM_ID, Optional, InjectionToken } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Detects the current platform environment
 */
type Platform = 'web' | 'capacitor-webview' | 'capacitor-native' | 'ssr';

/**
 * reCAPTCHA version type
 */
type RecaptchaVersion = 'v2' | 'v3' | 'enterprise';

/**
 * reCAPTCHA configuration for RecaptchaService
 * 
 * Internal configuration interface used by RecaptchaService.
 * Use RecaptchaAngularConfig from tokens.ts for app configuration.
 */
export interface RecaptchaServiceConfig {
  enabled: boolean;
  version: RecaptchaVersion;
  siteKey: string;
  action?: string;
  autoLoadScript?: boolean;
  language?: string;
}

/**
 * Injection token for reCAPTCHA configuration
 */
export const RECAPTCHA_CONFIG = new InjectionToken<RecaptchaServiceConfig | undefined>('RECAPTCHA_CONFIG', {
  providedIn: 'root',
  factory: () => undefined,
});

/**
 * Google reCAPTCHA service for Angular applications.
 *
 * Provides lazy loading of reCAPTCHA script and platform-aware token generation.
 * Automatically detects platform (web, Capacitor WebView, Capacitor native, SSR)
 * and skips reCAPTCHA in environments where it's not supported or needed.
 *
 * Features:
 * - Lazy script loading (only loads when needed)
 * - v2 (checkbox) and v3 (invisible) support
 * - Platform detection (web, Capacitor, SSR)
 * - Automatic skip for Capacitor native mode
 * - Automatic skip for SSR
 *
 * @example v3 Automatic Mode
 * ```typescript
 * constructor(private recaptcha: RecaptchaService) {}
 *
 * async login() {
 *   const token = await this.recaptcha.execute('login');
 *   await this.auth.login(email, password, token);
 * }
 * ```
 *
 * @example v2 Manual Mode
 * ```typescript
 * ngOnInit() {
 *   this.recaptcha.render('recaptcha-container', (token) => {
 *     this.recaptchaToken = token;
 *   });
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class RecaptchaService {
  private scriptLoaded = false;
  private scriptLoading: Promise<void> | null = null;
  private platform: Platform;
  private widgetId: number | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: string,
    @Optional() @Inject(RECAPTCHA_CONFIG) private config?: RecaptchaServiceConfig,
  ) {
    this.platform = this.detectPlatform();
    
    // Auto-preload script for v3/Enterprise so it's ready before first login/signup
    // No-op when disabled, shouldSkip, or v2 (v2 renders on-demand)
    if (this.config?.enabled && (this.config.version === 'v3' || this.config.version === 'enterprise')) {
      if (!this.shouldSkip()) {
        this.loadScript().catch(() => {
          // Silently fail - execute() will handle errors when called
        });
      }
    }
  }

  // ============================================================================
  // Platform Detection
  // ============================================================================

  /**
   * Detect the current platform environment.
   *
   * Detection priority:
   * 1. SSR (not in browser) → 'ssr'
   * 2. Capacitor native (no web view) → 'capacitor-native'
   * 3. Capacitor WebView → 'capacitor-webview'
   * 4. Web browser → 'web'
   *
   * @returns Detected platform type
   *
   * @example
   * ```typescript
   * const platform = this.detectPlatform();
   * if (platform === 'capacitor-native') {
   *   // Skip reCAPTCHA, use device attestation
   * }
   * ```
   */
  private detectPlatform(): Platform {
    // SSR detection
    if (!isPlatformBrowser(this.platformId)) {
      return 'ssr';
    }

    // Capacitor detection (window.Capacitor exists)
    const windowRef = window as { Capacitor?: { isNativePlatform?: () => boolean } };

    if (windowRef.Capacitor) {
      // Capacitor native (iOS/Android app)
      if (typeof windowRef.Capacitor.isNativePlatform === 'function' && windowRef.Capacitor.isNativePlatform()) {
        return 'capacitor-native';
      }
      // Capacitor WebView
      return 'capacitor-webview';
    }

    return 'web';
  }

  /**
   * Get the current platform.
   *
   * @returns Current platform type
   */
  getPlatform(): Platform {
    return this.platform;
  }

  /**
   * Check if reCAPTCHA should be skipped for current platform.
   *
   * Skips for:
   * - SSR (no window object)
   * - Capacitor native (use device attestation instead)
   *
   * @returns True if should skip reCAPTCHA
   */
  shouldSkip(): boolean {
    return this.platform === 'ssr' || this.platform === 'capacitor-native';
  }

  // ============================================================================
  // Script Loading
  // ============================================================================

  /**
   * Load Google reCAPTCHA script if not already loaded.
   *
   * Script URL format:
   * - v2: https://www.google.com/recaptcha/api.js
   * - v3: https://www.google.com/recaptcha/api.js?render={siteKey}
   * - Enterprise: https://www.google.com/recaptcha/enterprise.js?render={siteKey}
   *
   * @returns Promise that resolves when script is loaded
   *
   * @throws Error if config is missing or script fails to load
   */
  async loadScript(): Promise<void> {
    // Skip in SSR or Capacitor native
    if (this.shouldSkip()) {
      return;
    }

    // Skip if disabled
    if (!this.config?.enabled) {
      return;
    }

    // Already loaded
    if (this.scriptLoaded) {
      return;
    }

    // Already loading (return existing promise)
    if (this.scriptLoading) {
      return this.scriptLoading;
    }

    // Validate config
    if (!this.config.siteKey) {
      throw new Error('[RecaptchaService] Site key is required');
    }

    // Start loading
    this.scriptLoading = this.injectScript();

    try {
      await this.scriptLoading;
      this.scriptLoaded = true;
    } finally {
      this.scriptLoading = null;
    }
  }

  /**
   * Inject the reCAPTCHA script into the DOM.
   *
   * @returns Promise that resolves when script loads
   */
  private injectScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;

      // Set script URL based on version
      if (this.config!.version === 'enterprise') {
        script.src = `https://www.google.com/recaptcha/enterprise.js?render=${this.config!.siteKey}`;
      } else if (this.config!.version === 'v3') {
        script.src = `https://www.google.com/recaptcha/api.js?render=${this.config!.siteKey}`;
      } else {
        // v2 - load without render parameter
        let url = 'https://www.google.com/recaptcha/api.js';
        if (this.config!.language) {
          url += `?hl=${this.config!.language}`;
        }
        script.src = url;
      }

      script.onload = () => resolve();
      script.onerror = () => reject(new Error('[RecaptchaService] Failed to load reCAPTCHA script'));

      document.head.appendChild(script);
    });
  }

  // ============================================================================
  // v3/Enterprise Methods (Invisible Challenge)
  // ============================================================================

  /**
   * Execute reCAPTCHA v3/Enterprise challenge (invisible).
   *
   * Automatically loads script if needed and generates a token.
   * Skips automatically for SSR and Capacitor native.
   *
   * @param action - Action name for v3 analytics (e.g., 'login', 'signup')
   * @returns Promise resolving to reCAPTCHA token, or undefined if skipped
   *
   * @throws Error if version is v2, config missing, or execution fails
   *
   * @example
   * ```typescript
   * const token = await this.recaptcha.execute('login');
   * if (token) {
   *   await this.auth.login(email, password, token);
   * }
   * ```
   */
  async execute(action?: string): Promise<string | undefined> {
    // Skip for platforms that don't support reCAPTCHA
    if (this.shouldSkip()) {
      return undefined;
    }

    // Skip if disabled
    if (!this.config?.enabled) {
      return undefined;
    }

    // v2 requires manual render
    if (this.config.version === 'v2') {
      throw new Error('[RecaptchaService] execute() is only for v3/Enterprise. Use render() for v2.');
    }

    // Load script if needed
    await this.loadScript();

    // Get grecaptcha object
    const grecaptcha = (window as { grecaptcha?: { execute?: (siteKey: string, options: { action: string }) => Promise<string>; enterprise?: { execute?: (siteKey: string, options: { action: string }) => Promise<string> } } }).grecaptcha;

    if (!grecaptcha) {
      throw new Error('[RecaptchaService] grecaptcha is not loaded');
    }

    // Execute reCAPTCHA
    const actionName = action || this.config.action || 'submit';

    try {
      if (this.config.version === 'enterprise' && grecaptcha.enterprise?.execute) {
        return await grecaptcha.enterprise.execute(this.config.siteKey, { action: actionName });
      } else if (grecaptcha.execute) {
        return await grecaptcha.execute(this.config.siteKey, { action: actionName });
      } else {
        throw new Error('[RecaptchaService] grecaptcha.execute is not available');
      }
    } catch (error: unknown) {
      throw new Error(`[RecaptchaService] Failed to execute reCAPTCHA: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  // ============================================================================
  // v2 Methods (Visible Checkbox)
  // ============================================================================

  /**
   * Render reCAPTCHA v2 checkbox widget.
   *
   * @param containerId - DOM element ID or element to render in
   * @param callback - Callback when user completes challenge
   * @returns Promise resolving to widget ID
   *
   * @throws Error if version is not v2, config missing, or render fails
   *
   * @example
   * ```typescript
   * ngAfterViewInit() {
   *   this.recaptcha.render('recaptcha-container', (token) => {
   *     this.recaptchaToken = token;
   *     this.loginForm.patchValue({ recaptchaToken: token });
   *   });
   * }
   * ```
   */
  async render(containerId: string, callback: (token: string) => void): Promise<number> {
    // Skip for platforms that don't support reCAPTCHA
    if (this.shouldSkip()) {
      throw new Error('[RecaptchaService] reCAPTCHA v2 is not supported in SSR or Capacitor native');
    }

    // Skip if disabled
    if (!this.config?.enabled) {
      throw new Error('[RecaptchaService] reCAPTCHA is not enabled');
    }

    // Only for v2
    if (this.config.version !== 'v2') {
      throw new Error('[RecaptchaService] render() is only for v2. Use execute() for v3/Enterprise.');
    }

    // Load script if needed
    await this.loadScript();

    // Get grecaptcha object
    const grecaptcha = (window as { grecaptcha?: { render?: (container: string, options: { sitekey: string; callback: (token: string) => void }) => number } }).grecaptcha;

    if (!grecaptcha?.render) {
      throw new Error('[RecaptchaService] grecaptcha.render is not available');
    }

    // Render widget
    try {
      this.widgetId = grecaptcha.render(containerId, {
        sitekey: this.config.siteKey,
        callback: callback,
      });
      return this.widgetId;
    } catch (error: unknown) {
      throw new Error(`[RecaptchaService] Failed to render reCAPTCHA: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Get response token from v2 widget.
   *
   * @param widgetId - Widget ID (optional, uses last rendered widget if not provided)
   * @returns reCAPTCHA token or null if not completed
   *
   * @example
   * ```typescript
   * const token = this.recaptcha.getResponse();
   * if (token) {
   *   await this.auth.login(email, password, token);
   * }
   * ```
   */
  getResponse(widgetId?: number): string | null {
    const grecaptcha = (window as { grecaptcha?: { getResponse?: (widgetId?: number) => string } }).grecaptcha;

    if (!grecaptcha?.getResponse) {
      return null;
    }

    const id = widgetId !== undefined ? widgetId : this.widgetId ?? undefined;
    return grecaptcha.getResponse(id) || null;
  }

  /**
   * Reset v2 widget (clear response).
   *
   * @param widgetId - Widget ID (optional, uses last rendered widget if not provided)
   *
   * @example
   * ```typescript
   * // After failed login
   * this.recaptcha.reset();
   * ```
   */
  reset(widgetId?: number): void {
    const grecaptcha = (window as { grecaptcha?: { reset?: (widgetId?: number) => void } }).grecaptcha;

    if (!grecaptcha?.reset) {
      return;
    }

    const id = widgetId !== undefined ? widgetId : this.widgetId ?? undefined;
    grecaptcha.reset(id);
  }
}
