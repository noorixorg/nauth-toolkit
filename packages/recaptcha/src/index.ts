/**
 * @nauth-toolkit/recaptcha
 *
 * Google reCAPTCHA v2/v3/Enterprise support for nauth-toolkit.
 *
 * Provides bot protection for authentication endpoints via configurable
 * reCAPTCHA verification. Supports all Google reCAPTCHA versions with
 * platform-agnostic implementation.
 *
 * @example
 * ```typescript
 * import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
 *
 * const provider = new RecaptchaV3Provider({
 *   secretKey: process.env.RECAPTCHA_SECRET_KEY!,
 * });
 *
 * const result = await provider.verify(token, clientIp, 'login');
 * ```
 *
 * @packageDocumentation
 */

// Core interfaces
export * from './recaptcha-provider.interface';

// Provider implementations
export * from './providers/recaptcha-v2.provider';
export * from './providers/recaptcha-v3.provider';
export * from './providers/recaptcha-enterprise.provider';
