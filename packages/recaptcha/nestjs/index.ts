/**
 * NestJS integration for @nauth-toolkit/recaptcha
 *
 * Currently this module simply re-exports the main package.
 * Future versions may include NestJS-specific features such as:
 * - Global module configuration
 * - Dependency injection providers
 * - Guard decorators
 *
 * @example
 * ```typescript
 * import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha/nestjs';
 *
 * // Use the same as main package for now
 * const provider = new RecaptchaV3Provider({
 *   secretKey: process.env.RECAPTCHA_SECRET_KEY!,
 * });
 * ```
 *
 * @packageDocumentation
 */

// Re-export everything from main package
export * from '../src/index';
