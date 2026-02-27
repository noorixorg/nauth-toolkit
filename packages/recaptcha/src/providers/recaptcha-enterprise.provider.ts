import { RecaptchaProvider, RecaptchaValidationResult, RecaptchaVerificationResult } from '../recaptcha-provider.interface';

/**
 * Configuration for reCAPTCHA Enterprise provider
 */
export interface RecaptchaEnterpriseConfig {
  /**
   * Project ID from Google Cloud Console
   */
  projectId: string;

  /**
   * API key from Google Cloud Console
   *
   * Requirements:
   * 1. Created in: Google Cloud Console → APIs & Services → Credentials
   * 2. Must have reCAPTCHA Enterprise API enabled
   * 3. Recommended: Restrict to IP addresses or HTTP referrers for security
   *
   * Note: This is different from the site key. The API key authenticates your backend.
   */
  apiKey: string;

  /**
   * Site key from reCAPTCHA Enterprise admin console
   */
  siteKey: string;

  /**
   * Custom API endpoint (optional)
   * Useful for regional deployments
   *
   * @default 'https://recaptchaenterprise.googleapis.com/v1'
   */
  apiEndpoint?: string;

  /**
   * Request timeout in milliseconds
   *
   * @default 10000 (10 seconds)
   */
  timeout?: number;
}

/**
 * Google reCAPTCHA Enterprise Provider
 *
 * Implements advanced bot detection using Google's Enterprise REST API.
 *
 * Features:
 * - Advanced fraud detection with risk scores
 * - Custom rules and actions
 * - Detailed analytics and reporting
 * - SLA guarantees
 *
 * Setup:
 * 1. Enable reCAPTCHA Enterprise API in Google Cloud Console
 * 2. Create an API key with reCAPTCHA Enterprise API permission
 * 3. Create a site key in reCAPTCHA Enterprise console
 * 4. Add domains to site key whitelist (including localhost for dev)
 *
 * Enterprise is recommended for:
 * - High-traffic production applications
 * - Advanced security requirements
 * - Compliance and auditing needs
 *
 * @example
 * ```typescript
 * const provider = new RecaptchaEnterpriseProvider({
 *   projectId: 'my-project-id',
 *   apiKey: process.env.RECAPTCHA_ENTERPRISE_API_KEY!,
 *   siteKey: process.env.RECAPTCHA_ENTERPRISE_SITE_KEY!,
 * });
 *
 * const result = await provider.verify(token, clientIp, 'login');
 *
 * if (!result.success) {
 *   throw new Error('reCAPTCHA validation failed');
 * }
 *
 * if (result.score && result.score < 0.5) {
 *   // Handle low score - potential bot
 * }
 * ```
 */
export class RecaptchaEnterpriseProvider implements RecaptchaProvider {
  private readonly projectId: string;
  private readonly apiKey: string;
  private readonly siteKey: string;
  private readonly apiEndpoint: string;
  private readonly timeout: number;

  constructor(config: RecaptchaEnterpriseConfig) {
    this.projectId = config.projectId;
    this.apiKey = config.apiKey;
    this.siteKey = config.siteKey;
    this.apiEndpoint = config.apiEndpoint || 'https://recaptchaenterprise.googleapis.com/v1';
    this.timeout = config.timeout || 10000;
  }

  /**
   * Validate Enterprise reCAPTCHA configuration by sending a probe assessment
   *
   * Sends a dummy token to the assessments API. If credentials are valid,
   * Google returns HTTP 200 with tokenProperties.valid === false (expected).
   * Any other HTTP status indicates a configuration problem.
   *
   * @returns Validation result with actionable guidance
   */
  async validateConfig(): Promise<RecaptchaValidationResult> {
    const assessmentUrl = `${this.apiEndpoint}/projects/${this.projectId}/assessments?key=${this.apiKey}`;

    const requestBody = {
      event: {
        token: 'NAUTH_STARTUP_VALIDATION_PROBE',
        siteKey: this.siteKey,
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(assessmentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          valid: true,
          message: 'reCAPTCHA Enterprise configuration is valid. API key, project, and site key are all working.',
          httpStatus: response.status,
        };
      }

      switch (response.status) {
        case 400:
          return {
            valid: false,
            message: `reCAPTCHA Enterprise: Invalid request (HTTP 400). The site key "${this.siteKey}" may be incorrect or not yet activated.`,
            hint: 'Verify your siteKey in the reCAPTCHA Enterprise console at https://console.cloud.google.com/security/recaptcha. Newly created keys may take a few minutes to propagate.',
            httpStatus: 400,
          };
        case 403:
          return {
            valid: false,
            message: 'reCAPTCHA Enterprise: Access denied (HTTP 403). The API key may be invalid or the reCAPTCHA Enterprise API is not enabled.',
            hint: 'Check: (1) API key is correct, (2) reCAPTCHA Enterprise API is enabled at https://console.cloud.google.com/apis/library/recaptchaenterprise.googleapis.com, (3) API key restrictions allow this service.',
            httpStatus: 403,
          };
        case 404:
          return {
            valid: false,
            message: `reCAPTCHA Enterprise: Project not found (HTTP 404). The project ID "${this.projectId}" may be incorrect.`,
            hint: 'Verify your projectId matches a Google Cloud project with reCAPTCHA Enterprise enabled.',
            httpStatus: 404,
          };
        default:
          return {
            valid: false,
            message: `reCAPTCHA Enterprise: Unexpected response (HTTP ${response.status}).`,
            httpStatus: response.status,
          };
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          valid: false,
          message: `reCAPTCHA Enterprise: Connection timeout after ${this.timeout}ms.`,
          hint: 'Check network connectivity and verify the apiEndpoint is correct.',
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        message: `reCAPTCHA Enterprise: Network error — ${errorMessage}`,
        hint: 'Check network connectivity. If using a custom apiEndpoint, verify the URL is correct.',
      };
    }
  }

  /**
   * Verify reCAPTCHA Enterprise token with Google's API
   *
   * Uses the reCAPTCHA Enterprise REST API for assessment creation.
   * The API key is passed as a query parameter for authentication.
   *
   * @param token - Token from client (generated by grecaptcha.enterprise.execute)
   * @param remoteIp - Client IP address (optional but recommended)
   * @param action - Action name used when generating token (e.g., 'login', 'signup')
   * @returns Verification result with score and risk analysis
   *
   * @throws Error if network request fails or times out
   */
  async verify(token: string, remoteIp?: string, action?: string): Promise<RecaptchaVerificationResult> {
    // Build assessment URL with API key as query parameter
    // This is the correct way to authenticate with API keys per Google docs
    const assessmentUrl = `${this.apiEndpoint}/projects/${this.projectId}/assessments?key=${this.apiKey}`;

    const requestBody = {
      event: {
        token,
        siteKey: this.siteKey,
        ...(action && { expectedAction: action }),
        ...(remoteIp && { userIpAddress: remoteIp }),
      },
    };

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Make request to Google's Enterprise API
      const response = await fetch(assessmentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`reCAPTCHA Enterprise API returned status ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      // Extract token properties from assessment
      const tokenProperties = data.tokenProperties || {};
      const riskAnalysis = data.riskAnalysis || {};

      // Map Enterprise response to our interface
      return {
        success: tokenProperties.valid === true,
        score: riskAnalysis.score,
        action: tokenProperties.action,
        hostname: tokenProperties.hostname,
        errorCodes: tokenProperties.invalidReason ? [tokenProperties.invalidReason] : undefined,
      };
    } catch (error: unknown) {
      // Handle network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`reCAPTCHA Enterprise verification timeout after ${this.timeout}ms`);
        }
        throw new Error(`reCAPTCHA Enterprise verification failed: ${error.message}`);
      }
      throw new Error('reCAPTCHA Enterprise verification failed with unknown error');
    }
  }
}
