import { ISocialAuthProviderService } from '../interfaces/social-auth-provider.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Social Provider Registry (Internal)
 *
 * Internal registry service for managing social authentication providers.
 * This is an implementation detail used by SocialAuthService and provider modules.
 *
 * **Note:** This is an internal service. Consumer applications should use
 * `SocialAuthService` instead, which provides a high-level API for social authentication.
 *
 * **Key Features:**
 * - Dynamic provider registration without hardcoded names
 * - Provider lookup by name
 * - Auto-registration when provider modules are imported
 *
 * **How it works:**
 * Provider modules (Google, Apple, Facebook, etc.) automatically register themselves
 * with this registry using OnModuleInit when their modules are imported.
 *
 * @internal
 *
 * @example
 * ```typescript
 * // Provider modules auto-register
 * onModuleInit() {
 *   this.providerRegistry.registerProvider(this);
 * }
 *
 * // SocialAuthService uses the registry internally
 * const provider = this.providerRegistry.getProvider('google');
 * ```
 */
export class SocialProviderRegistry {
  private readonly providers = new Map<string, ISocialAuthProviderService>();

  /**
   * Register a social auth provider
   *
   * Called automatically by provider modules during initialization.
   * Provider names must be unique.
   *
   * @param provider - Provider service instance (must have providerName property)
   *
   * @example
   * ```typescript
   * // In provider module OnModuleInit:
   * constructor(private providerRegistry: SocialProviderRegistry) {}
   *
   * onModuleInit() {
   *   this.providerRegistry.registerProvider(this);
   * }
   * ```
   */
  registerProvider(provider: ISocialAuthProviderService): void {
    const name = provider.providerName;

    if (this.providers.has(name)) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, `Social auth provider '${name}' is already registered`);
    }

    this.providers.set(name, provider);
  }

  /**
   * Get a provider by name
   *
   * @param name - Provider name (e.g., 'google', 'apple', 'facebook')
   * @returns Provider service instance
   * @throws {NAuthException} If provider is not registered
   *
   * @example
   * ```typescript
   * const googleProvider = this.providerRegistry.getProvider('google');
   * const authUrl = await googleProvider.getAuthUrl();
   * ```
   */
  getProvider(name: string): ISocialAuthProviderService {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Social auth provider '${name}' is not registered. Import the provider module (e.g., GoogleSocialAuthModule) and ensure it's properly configured.`,
      );
    }
    return provider;
  }

  /**
   * Check if a provider is registered
   *
   * @param name - Provider name
   * @returns True if provider exists
   *
   * @example
   * ```typescript
   * if (this.providerRegistry.hasProvider('github')) {
   *   // Use GitHub provider
   * }
   * ```
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get all registered provider names
   *
   * @returns Array of provider names
   *
   * @example
   * ```typescript
   * const providers = this.providerRegistry.listProviders();
   * // ['google', 'apple', 'facebook']
   * ```
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
