"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialProviderRegistry = void 0;
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
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
var SocialProviderRegistry = /** @class */ (function () {
    function SocialProviderRegistry() {
        this.providers = new Map();
    }
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
    SocialProviderRegistry.prototype.registerProvider = function (provider) {
        var name = provider.providerName;
        if (this.providers.has(name)) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.VALIDATION_FAILED, "Social auth provider '".concat(name, "' is already registered"));
        }
        this.providers.set(name, provider);
    };
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
    SocialProviderRegistry.prototype.getProvider = function (name) {
        var provider = this.providers.get(name);
        if (!provider) {
            throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.SOCIAL_CONFIG_MISSING, "Social auth provider '".concat(name, "' is not registered. Import the provider module (e.g., GoogleSocialAuthModule) and ensure it's properly configured."));
        }
        return provider;
    };
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
    SocialProviderRegistry.prototype.hasProvider = function (name) {
        return this.providers.has(name);
    };
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
    SocialProviderRegistry.prototype.listProviders = function () {
        return Array.from(this.providers.keys());
    };
    return SocialProviderRegistry;
}());
exports.SocialProviderRegistry = SocialProviderRegistry;
