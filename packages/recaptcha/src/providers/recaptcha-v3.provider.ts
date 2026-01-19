import { RecaptchaProvider, RecaptchaVerificationResult } from '../recaptcha-provider.interface';

/**
 * Configuration for reCAPTCHA v3 provider
 */
export interface RecaptchaV3Config {
  /**
   * Secret key from Google reCAPTCHA admin console
   */
  secretKey: string;

  /**
   * Custom verification endpoint (optional)
   * Useful for enterprise deployments or proxies
   *
   * @default 'https://www.google.com/recaptcha/api/siteverify'
   */
  verifyUrl?: string;

  /**
   * Request timeout in milliseconds
   *
   * @default 10000 (10 seconds)
   */
  timeout?: number;
}

/**
 * Google reCAPTCHA v3 Provider
 *
 * Implements invisible, score-based bot detection without user interaction.
 * Returns a risk score (0.0 - 1.0) indicating likelihood of bot activity.
 *
 * v3 is recommended for most web applications as it provides better UX
 * by not requiring user interaction while still detecting bots effectively.
 *
 * @example
 * ```typescript
 * const provider = new RecaptchaV3Provider({
 *   secretKey: process.env.RECAPTCHA_SECRET_KEY!,
 * });
 *
 * const result = await provider.verify(token, clientIp, 'login');
 *
 * if (!result.success) {
 *   throw new Error('reCAPTCHA validation failed');
 * }
 *
 * if (result.score && result.score < 0.5) {
 *   throw new Error('Suspicious activity detected');
 * }
 * ```
 */
export class RecaptchaV3Provider implements RecaptchaProvider {
  private readonly secretKey: string;
  private readonly verifyUrl: string;
  private readonly timeout: number;

  constructor(config: RecaptchaV3Config) {
    this.secretKey = config.secretKey;
    this.verifyUrl = config.verifyUrl || 'https://www.google.com/recaptcha/api/siteverify';
    this.timeout = config.timeout || 10000;
  }

  /**
   * Verify reCAPTCHA v3 token with Google's API
   *
   * @param token - Token from client
   * @param remoteIp - Client IP address (optional but recommended)
   * @param action - Action name used when generating token (e.g., 'login', 'signup')
   * @returns Verification result with score
   *
   * @throws Error if network request fails or times out
   */
  async verify(token: string, remoteIp?: string, _action?: string): Promise<RecaptchaVerificationResult> {
    // Build request body
    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Make request to Google's API
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`reCAPTCHA API returned status ${response.status}`);
      }

      const data = await response.json();

      // Map Google's response to our interface
      return {
        success: data.success === true,
        score: data.score,
        action: data.action,
        hostname: data.hostname,
        errorCodes: data['error-codes'],
      };
    } catch (error: unknown) {
      // Handle network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`reCAPTCHA verification timeout after ${this.timeout}ms`);
        }
        throw new Error(`reCAPTCHA verification failed: ${error.message}`);
      }
      throw new Error('reCAPTCHA verification failed with unknown error');
    }
  }
}
