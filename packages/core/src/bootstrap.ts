/**
 * NAuth Bootstrap
 *
 * Entry point for initializing NAuth with platform adapters.
 *
 * **Usage:**
 * ```typescript
 * import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';
 *
 * const nauth = await NAuth.create({
 *   config: authConfig,
 *   dataSource: dataSource,
 *   adapter: new ExpressAdapter(),
 * });
 *
 * // Mount middleware
 * app.use(nauth.middleware.clientInfo);
 * app.use(nauth.middleware.csrf);
 * app.use(nauth.middleware.auth);
 * app.use(nauth.middleware.tokenDelivery);
 *
 * // Protected routes
 * app.get('/profile', nauth.helpers.requireAuth(), (req, res) => {
 *   const user = nauth.helpers.getCurrentUser();
 *   res.json({ user });
 * });
 * ```
 */

import { DataSource } from 'typeorm';
import { NAuthConfig } from './interfaces/config.interface';
import { IAuthorizationProvider } from './interfaces/authorization-provider.interface';
import { NAuthLogger } from './utils/nauth-logger';
import { NAuthException } from './exceptions/nauth.exception';
import { AuthErrorCode } from './enums/error-codes.enum';
import { NAuthAdapter, NAuthRequest, NAuthResponse } from './platform/interfaces';
import { ExpressAdapter } from './adapters/express.adapter';
import { ContextStorage } from './utils/context-storage';

// Handlers
import { ClientInfoHandler } from './handlers/client-info.handler';
import { AuthHandler } from './handlers/auth.handler';
import { ApiKeyHandler } from './handlers/api-key.handler';
import { TokenDeliveryHandler } from './handlers/token-delivery.handler';
import { CsrfHandler } from './handlers/csrf.handler';
import { CsrfService } from './services/csrf.service';
import { TelemetryService } from './services/telemetry.service';

// Setup Helpers
import { getRepositories } from './utils/setup/get-repositories';
import { initStorage } from './utils/setup/init-storage';
import type { StorageAdapter } from './interfaces/storage-adapter.interface';
import { initServices, NAuthServices } from './utils/setup/init-services';
import { registerMFAProviders } from './utils/setup/register-mfa';
import { initSocialAuth, NAuthSocialProviders } from './utils/setup/init-social';
import { runNAuthMigrationsOnStartup } from './utils/setup/run-nauth-migrations';
import { AuthFlowContextBuilder, AuthFlowStateMachineService } from './internal';
import { ClientInfo } from './interfaces/client-info.interface';
import { IUser } from './interfaces/entities.interface';
import { SocialAuthStateStore } from './services/social-auth-state-store.service';
import { SocialRedirectHandler } from './services/social-redirect.handler';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for NAuth initialization
 */
export interface NAuthOptions {
  /** NAuth configuration */
  config: NAuthConfig;

  /** TypeORM DataSource */
  dataSource: DataSource;

  /**
   * Platform adapter (Express, Fastify, etc.)
   * @default ExpressAdapter
   */
  adapter?: NAuthAdapter;

  /**
   * Decides whether privileged operations may proceed.
   *
   * The toolkit authenticates but defines no role model, so administrative operations
   * delegate the decision here. Omit it and `AdminAuthService` behaves exactly as in
   * every previous release — it trusts its caller.
   *
   * Supply one and every privileged method consults it, however it was reached: a
   * shipped route, a hand-written controller, or a script. Work with no authenticated
   * caller must be wrapped in `runAsSystem()`, which bypasses the provider explicitly.
   *
   * @example
   * ```typescript
   * const nauth = await NAuth.create({
   *   config, dataSource,
   *   authorization: {
   *     // Look authority up in your own store. Never in `user.metadata` — that column
   *     // is caller-writable through signup and the self-service profile update.
   *     authorize: async ({ actor }) =>
   *       ({ allow: Boolean(actor) && (await roles.isAdmin(actor.sub)), reason: 'Requires the admin role' }),
   *   },
   * });
   * ```
   */
  authorization?: IAuthorizationProvider;
}

/**
 * NAuth instance returned by NAuth.create()
 *
 * Contains services, middleware, and helpers for authentication.
 *
 * @typeParam TMiddleware - Type for middleware (framework-specific)
 * @typeParam THelper - Type for route helpers (framework-specific)
 */
export interface NAuthInstance<TMiddleware = unknown, THelper = unknown>
  extends Omit<NAuthServices, 'challengeService' | 'authChallengeHelperService'>, NAuthSocialProviders {
  /** Framework-specific middleware/hooks */
  middleware: {
    /** Client info extraction (MUST BE FIRST) */
    clientInfo: TMiddleware;
    /** JWT authentication */
    auth: TMiddleware;
    /** CSRF protection */
    csrf: TMiddleware;
    /** Token delivery (response interceptor) */
    tokenDelivery: TMiddleware;
  };

  /** Route helpers */
  helpers: {
    /** Mark route as public (bypasses CSRF) */
    public: () => THelper;
    /** Require authentication (with optional CSRF bypass) */
    requireAuth: (options?: { csrf?: boolean }) => THelper;
    /** Optional authentication marker */
    optionalAuth: () => THelper;
    /** Override token delivery mode */
    tokenDelivery: (mode: 'json' | 'cookies') => THelper;
    /** Skip reCAPTCHA validation for this route */
    skipRecaptcha: () => THelper;
    /** Require reCAPTCHA validation for this route */
    requireRecaptcha: () => THelper;
    /** Get current authenticated user */
    getCurrentUser: () => IUser | undefined;
    /** Get current session ID */
    getCurrentSession: () => string | number | undefined;
    /** Get client info */
    getClientInfo: () => ClientInfo | undefined;
  };

  /** The adapter being used */
  adapter: NAuthAdapter;

  /** Configuration */
  config: NAuthConfig;

  /** Logger instance */
  logger: NAuthLogger;

  /**
   * The resolved transient storage adapter (Memory, Database, or Redis).
   *
   * Exposed so provider packages can persist their own short-lived, TTL-bounded state
   * without opening a second connection or requiring new tables — for example
   * `@nauth-toolkit/oidc-provider`, which stores every OpenID Connect artifact here.
   */
  storage: StorageAdapter;

  /** CSRF service (if enabled) */
  csrfService?: CsrfService;

  /** Social OAuth redirect handler — start, callback, and exchange flows */
  socialRedirect?: SocialRedirectHandler;

  /** Anonymous usage telemetry (opt-out) — see https://nauth.dev/docs/concepts/telemetry */
  telemetryService?: TelemetryService;
}

// ============================================================================
// NAuth Bootstrap Class
// ============================================================================

/**
 * NAuth Bootstrap
 *
 * Main entry point for initializing NAuth.
 */
export class NAuth {
  /**
   * Create NAuth instance
   *
   * @param options - Configuration options
   * @returns Initialized NAuth instance
   *
   * @example
   * ```typescript
   * const nauth = await NAuth.create({
   *   config: authConfig,
   *   dataSource: dataSource,
   *   adapter: new ExpressAdapter(),
   * });
   * ```
   */
  static async create(options: NAuthOptions): Promise<NAuthInstance> {
    const { config, dataSource } = options;
    const adapter = options.adapter || new ExpressAdapter();

    const logger = new NAuthLogger(config.logger);
    logger.log(`Initializing NAuth with ${adapter.name}...`);

    // ========================================================================
    // 0. Run database migrations (adapter-owned, auto-run, no consumer burden)
    // ========================================================================
    await runNAuthMigrationsOnStartup(config, dataSource, logger);

    // ========================================================================
    // 1. Initialize Repositories & Storage
    // ========================================================================
    const repos = getRepositories(dataSource);

    const storage = await initStorage(config, repos.rateLimitRepository, repos.storageLockRepository, logger);

    // ========================================================================
    // 2. Initialize Services
    // ========================================================================
    const emailProvider = config.emailProvider;
    const smsProvider = config.smsProvider;
    const services: NAuthServices = initServices(
      config,
      repos,
      storage,
      logger,
      emailProvider,
      smsProvider,
      options.authorization,
    );

    // ========================================================================
    // 3. Initialize Auth Flow State Machine
    // ========================================================================
    const contextBuilder = new AuthFlowContextBuilder(
      services.trustedDeviceService,
      services.adaptiveMFADecisionService,
      services.clientInfoService,
      logger,
    );
    const stateMachine = new AuthFlowStateMachineService(contextBuilder, logger);

    if (services.authChallengeHelperService) {
      (services.authChallengeHelperService as unknown as Record<string, unknown>).stateMachine = stateMachine;
      (services.authChallengeHelperService as unknown as Record<string, unknown>).contextBuilder = contextBuilder;
    } else {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'AuthChallengeHelperService not initialized.');
    }

    // ========================================================================
    // 4. Register MFA & Social Providers
    // ========================================================================
    const socialAuthStateStore = new SocialAuthStateStore(storage, logger);

    if (config.mfa?.enabled && services.mfaService) {
      await registerMFAProviders(
        config,
        services.mfaService,
        repos.mfaDeviceRepository!,
        repos.userRepository,
        logger,
        services.passwordService,
        services.emailVerificationService,
        services.phoneVerificationService,
        services.challengeService,
        services.auditService,
        services.clientInfoService,
      );
    }

    const socialProviders: NAuthSocialProviders = await initSocialAuth(
      config,
      services.socialProviderRegistry,
      services.authService,
      services.socialAuthService,
      services.jwtService,
      services.sessionService,
      services.authChallengeHelperService,
      services.clientInfoService,
      logger,
      socialAuthStateStore,
      repos.userRepository,
      services.phoneVerificationService,
      services.auditService,
      services.trustedDeviceService,
      repos.socialProviderSecretRepository,
      services.hookRegistry,
    );

    // Build SocialRedirectHandler when any social provider is enabled
    const hasSocial =
      config.social?.google?.enabled || config.social?.apple?.enabled || config.social?.facebook?.enabled;
    const socialRedirectHandler = hasSocial
      ? new SocialRedirectHandler(config, services.socialProviderRegistry, socialAuthStateStore, storage, logger)
      : undefined;

    // ========================================================================
    // 4b. Validate reCAPTCHA Provider (if enabled)
    // ========================================================================
    if (config.recaptcha?.enabled && config.recaptcha.provider) {
      const validateMode = config.recaptcha.validateOnStartup ?? 'warn';
      // Cast to access optional validateConfig — runtime typeof check ensures safety.
      const provider = config.recaptcha.provider as {
        validateConfig?: () => Promise<{ valid: boolean; message: string; hint?: string; httpStatus?: number }>;
      };

      if (validateMode !== false && typeof provider.validateConfig === 'function') {
        try {
          const validationResult = await provider.validateConfig();

          if (validationResult.valid) {
            logger.log(`reCAPTCHA: ${validationResult.message}`);
          } else {
            const fullMessage = validationResult.hint
              ? `${validationResult.message} ${validationResult.hint}`
              : validationResult.message;

            if (validateMode === 'error') {
              throw new NAuthException(
                AuthErrorCode.RECAPTCHA_PROVIDER_MISSING,
                `reCAPTCHA startup validation failed: ${fullMessage}`,
              );
            } else {
              logger.warn(`reCAPTCHA startup validation failed: ${fullMessage}`);
            }
          }
        } catch (error: unknown) {
          if (error instanceof NAuthException) {
            throw error;
          }
          const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
          logger.warn(`reCAPTCHA startup validation could not complete: ${errorMessage}`);
        }
      }
    }

    // ========================================================================
    // 5. Create Handlers
    // ========================================================================
    const clientInfoHandler = new ClientInfoHandler(
      services.clientInfoService,
      config,
      services.geoLocationService,
      logger,
    );

    const authHandler = new AuthHandler(
      services.jwtService,
      services.sessionService,
      services.authService,
      config,
      logger,
    );

    // API key handler (only when the feature is enabled and the service is available)
    const apiKeyHandler =
      config.apiKeys?.enabled && services.apiKeyService
        ? new ApiKeyHandler(services.apiKeyService, services.authService, config, logger)
        : null;

    const tokenDeliveryHandler = new TokenDeliveryHandler(config, logger);

    // CSRF service (only for cookies/hybrid delivery)
    const csrfService =
      config.tokenDelivery?.method === 'cookies' || config.tokenDelivery?.method === 'hybrid'
        ? new CsrfService(config)
        : undefined;

    const csrfHandler = csrfService ? new CsrfHandler(csrfService, config, logger) : null;

    // ========================================================================
    // 6. Register Middleware with Adapter
    // ========================================================================
    const middleware = {
      // ClientInfo MUST be first - initializes context
      clientInfo: adapter.registerMiddleware('clientInfo', clientInfoHandler.handle.bind(clientInfoHandler), {
        initializesContext: true,
      }),

      // API key handler - MUST run before the JWT auth handler. When an API key is present it
      // is the only credential considered; a valid key makes the auth handler skip cookie/bearer.
      apiKey: apiKeyHandler
        ? adapter.registerMiddleware('apiKey', apiKeyHandler.handle.bind(apiKeyHandler))
        : adapter.registerMiddleware('noop', async (_req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
            await next();
          }),

      // Auth handler
      auth: adapter.registerMiddleware('auth', authHandler.handle.bind(authHandler)),

      // CSRF handler (no-op if disabled)
      csrf: csrfHandler
        ? adapter.registerMiddleware('csrf', csrfHandler.handle.bind(csrfHandler))
        : adapter.registerMiddleware('noop', async (_req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
            await next();
          }),

      // Token delivery (response interceptor)
      tokenDelivery: adapter.registerResponseInterceptor(
        tokenDeliveryHandler.handleResponse.bind(tokenDeliveryHandler),
      ),
    };

    // ========================================================================
    // 7. Create Helpers
    // ========================================================================
    const helpers = {
      /**
       * Mark route as public - bypasses CSRF validation
       */
      public: () =>
        adapter.registerMiddleware('public', (req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
          req.attributes.nauthPublic = true;
          return next();
        }),

      /**
       * Require authentication
       *
       * @param options.csrf - Set to false to bypass CSRF check (e.g., for logout)
       */
      requireAuth: (options?: { csrf?: boolean }) =>
        adapter.registerMiddleware('requireAuth', (req: NAuthRequest, res: NAuthResponse, next: () => void) => {
          // Enforce deferred CSRF check (unless disabled)
          if (options?.csrf !== false && req.attributes.nauthCsrfError) {
            throw req.attributes.nauthCsrfError;
          }

          // Enforce authentication
          if (!req.attributes.user) {
            res.status(401).json({
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Authentication required',
              code: 'AUTH_REQUIRED',
            });
            return;
          }

          // API-key route opt-in enforcement (deny-wins, least privilege):
          // a key-authenticated request is only allowed on routes explicitly opted-in via
          // allowApiKey() (or globalAllowlist), and never on routes opted-out via denyApiKey().
          if (req.attributes.nauthApiKeyAuth) {
            const allowed =
              req.attributes.nauthDenyApiKey !== true &&
              (req.attributes.nauthAllowApiKey === true || config.apiKeys?.globalAllowlist === true);
            if (!allowed) {
              res.status(403).json({
                statusCode: 403,
                error: 'Forbidden',
                message: 'API key authentication is not allowed for this route',
                code: AuthErrorCode.FORBIDDEN,
              });
              return;
            }
          }

          return next();
        }),

      /**
       * Optional authentication marker
       *
       * Auth middleware already does optional auth by default.
       * This helper is a semantic marker for documentation purposes.
       */
      optionalAuth: () =>
        adapter.registerMiddleware('optionalAuth', (_req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
          return next();
        }),

      /**
       * Override token delivery mode for this route
       */
      tokenDelivery: (mode: 'json' | 'cookies') =>
        adapter.registerMiddleware(
          'tokenDeliveryConfig',
          (req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
            req.attributes.nauthTokenDelivery = mode;
            return next();
          },
        ),

      /**
       * Skip reCAPTCHA validation for this route
       *
       * Use when a specific route should bypass reCAPTCHA even if globally enabled.
       * Useful for admin routes, mobile-only endpoints, or internal API calls.
       *
       * @example
       * ```typescript
       * // Express
       * app.post('/api/auth/login/admin', nauth.helpers.skipRecaptcha(), (req, res) => {
       *   // ... admin login logic
       * });
       *
       * // Fastify
       * fastify.post('/api/auth/login/admin', {
       *   preHandler: [nauth.helpers.skipRecaptcha()]
       * }, async (req, reply) => {
       *   // ... admin login logic
       * });
       * ```
       */
      skipRecaptcha: () =>
        adapter.registerMiddleware('skipRecaptcha', (req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
          req.attributes.nauthSkipRecaptcha = true;
          return next();
        }),

      /**
       * Require reCAPTCHA validation for this route
       *
       * Use when a specific route must enforce reCAPTCHA even if not globally enabled.
       * Useful for high-risk operations like password reset or account deletion.
       *
       * @example
       * ```typescript
       * // Express
       * app.post('/api/auth/password/reset', nauth.helpers.requireRecaptcha(), (req, res) => {
       *   // ... password reset logic
       * });
       *
       * // Fastify
       * fastify.post('/api/auth/password/reset', {
       *   preHandler: [nauth.helpers.requireRecaptcha()]
       * }, async (req, reply) => {
       *   // ... password reset logic
       * });
       * ```
       */
      requireRecaptcha: () =>
        adapter.registerMiddleware('requireRecaptcha', (req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
          req.attributes.nauthRequireRecaptcha = true;
          return next();
        }),

      /**
       * Allow API-key authentication for this route (opt-in).
       *
       * With the default opt-in policy, API keys only authenticate on routes marked with this
       * helper. Enforced by `requireAuth()`.
       *
       * @example
       * ```typescript
       * app.get('/api/data', nauth.helpers.allowApiKey(), nauth.helpers.requireAuth(), handler);
       * ```
       */
      allowApiKey: () =>
        adapter.registerMiddleware('allowApiKey', (req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
          req.attributes.nauthAllowApiKey = true;
          return next();
        }),

      /**
       * Deny API-key authentication for this route (takes precedence over allow / globalAllowlist).
       *
       * Use to exclude a sensitive route even when keys are enabled globally or on a controller.
       * Enforced by `requireAuth()`.
       */
      denyApiKey: () =>
        adapter.registerMiddleware('denyApiKey', (req: NAuthRequest, _res: NAuthResponse, next: () => void) => {
          req.attributes.nauthDenyApiKey = true;
          return next();
        }),

      // Context helpers (read from ContextStorage)
      getCurrentUser: () => ContextStorage.get<IUser>('CURRENT_USER'),
      getCurrentSession: () => ContextStorage.get<string | number>('CURRENT_SESSION'),
      getClientInfo: () => ContextStorage.get<ClientInfo>('CLIENT_INFO'),
    };

    // ========================================================================
    // 8. Build and Return Instance
    // ========================================================================

    // Exclude internal services from public API
    const { challengeService, authChallengeHelperService, ...publicServices } = services;

    logger.log(`NAuth initialized successfully with ${adapter.name}`);

    // Anonymous usage telemetry (opt-out). Deferred via setImmediate so
    // NAuth.create() gains no awaits; all telemetry work is fire-and-forget
    // off the startup path and never touches a request path.
    const telemetryService = new TelemetryService(
      config,
      storage,
      logger,
      adapter.name.replace(/Adapter$/i, '').toLowerCase(),
      services.mfaService,
      services.socialProviderRegistry,
    );
    setImmediate(() => {
      telemetryService.sendBootPing();
      telemetryService.startHeartbeat();
    });

    return {
      ...publicServices,
      ...socialProviders,
      middleware,
      helpers,
      adapter,
      config,
      logger,
      storage,
      socialAuthService: services.socialAuthService,
      csrfService,
      socialRedirect: socialRedirectHandler,
      telemetryService,
    };
  }
}
