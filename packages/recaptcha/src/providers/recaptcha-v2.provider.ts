import { RecaptchaProvider, RecaptchaVerificationResult } from '../recaptcha-provider.interface';

/**
 * Configuration for reCAPTCHA v2 provider
 */
export interface RecaptchaV2Config {
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
 * Google reCAPTCHA v2 Provider
 *
 * Implements checkbox-based CAPTCHA requiring user interaction.
 * Returns simple success/fail without scoring.
 *
 * v2 is useful when:
 * - You need explicit user verification
 * - Mobile WebView environments where v3 scoring is unreliable
 * - Regulatory requirements mandate visible challenges
 *
 * @example
 * ```typescript
 * const provider = new RecaptchaV2Provider({
 *   secretKey: process.env.RECAPTCHA_V2_SECRET_KEY!,
 * });
 *
 * const result = await provider.verify(token, clientIp);
 *
 * if (!result.success) {
 *   throw new Error('reCAPTCHA validation failed');
 * }
 * ```
 */
export class RecaptchaV2Provider implements RecaptchaProvider {
  private readonly secretKey: string;
  private readonly verifyUrl: string;
  private readonly timeout: number;

  constructor(config: RecaptchaV2Config) {
    this.secretKey = config.secretKey;
    this.verifyUrl = config.verifyUrl || 'https://www.google.com/recaptcha/api/siteverify';
    this.timeout = config.timeout || 10000;
  }

  /**
   * Verify reCAPTCHA v2 token with Google's API
   *
   * @param token - Token from client (obtained from checkbox widget)
   * @param remoteIp - Client IP address (optional but recommended)
   * @param action - Not used for v2 (only for v3/Enterprise)
   * @returns Verification result (no score for v2)
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
      // v2 does not include score or action
      return {
        success: data.success === true,
        challengeTs: data.challenge_ts,
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
