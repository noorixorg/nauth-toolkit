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
import { NAuthLogger } from './utils/nauth-logger';
import { NAuthException } from './exceptions/nauth.exception';
import { AuthErrorCode } from './enums/error-codes.enum';
import { NAuthAdapter, NAuthRequest, NAuthResponse } from './platform/interfaces';
import { ExpressAdapter } from './adapters/express.adapter';
import { ContextStorage } from './utils/context-storage';

// Handlers
import { ClientInfoHandler } from './handlers/client-info.handler';
import { AuthHandler } from './handlers/auth.handler';
import { TokenDeliveryHandler } from './handlers/token-delivery.handler';
import { CsrfHandler } from './handlers/csrf.handler';
import { CsrfService } from './services/csrf.service';

// Setup Helpers
import { getRepositories } from './utils/setup/get-repositories';
import { initStorage } from './utils/setup/init-storage';
import { initServices, NAuthServices } from './utils/setup/init-services';
import { registerMFAProviders } from './utils/setup/register-mfa';
import { initSocialAuth, NAuthSocialProviders } from './utils/setup/init-social';
import { runNAuthMigrationsOnStartup } from './utils/setup/run-nauth-migrations';
import { AuthFlowContextBuilder, AuthFlowStateMachineService } from './internal';
import { ClientInfo } from './interfaces/client-info.interface';
import { IUser } from './interfaces/entities.interface';
import { SocialAuthStateStore } from './services/social-auth-state-store.service';

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

  /** CSRF service (if enabled) */
  csrfService?: CsrfService;
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
    logger.debug('[PERF] Starting database migrations...');
    await runNAuthMigrationsOnStartup(config, dataSource, logger);
    logger.debug('[PERF] Database migrations completed');

    // ========================================================================
    // 1. Initialize Repositories & Storage
    // ========================================================================
    logger.debug('[PERF] Discovering repositories...');
    const repos = getRepositories(dataSource);
    logger.debug('[PERF] Repositories discovered');

    logger.debug('[PERF] Initializing storage...');
    const storage = await initStorage(config, repos.rateLimitRepository, repos.storageLockRepository, logger);
    logger.debug('[PERF] Storage initialized');

    // ========================================================================
    // 2. Initialize Services
    // ========================================================================
    logger.debug('[PERF] Initializing services...');
    const emailProvider = config.emailProvider;
    const smsProvider = config.smsProvider;
    const services: NAuthServices = initServices(config, repos, storage, logger, emailProvider, smsProvider);
    logger.debug('[PERF] Services initialized');

    // ========================================================================
    // 3. Initialize Auth Flow State Machine
    // ========================================================================
    logger.debug('[PERF] Initializing auth flow state machine...');
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
    logger.debug('[PERF] Auth flow state machine initialized');

    // ========================================================================
    // 4. Register MFA & Social Providers
    // ========================================================================
    logger.debug('[PERF] Registering providers...');
    const socialAuthStateStore = new SocialAuthStateStore(storage, logger);

    if (config.mfa?.enabled && services.mfaService) {
      logger.debug('[PERF] Registering MFA providers...');
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
      logger.debug('[PERF] MFA providers registered');
    }

    logger.debug('[PERF] Initializing social auth...');
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
    logger.debug('[PERF] Social auth initialized');
    logger.debug('[PERF] Providers registration completed');

    // ========================================================================
    // 5. Create Handlers
    // ========================================================================
    logger.debug('[PERF] Creating handlers...');
    const clientInfoHandler = new ClientInfoHandler(services.clientInfoService, services.geoLocationService, logger);

    const authHandler = new AuthHandler(
      services.jwtService,
      services.sessionService,
      services.authService,
      config,
      logger,
    );

    const tokenDeliveryHandler = new TokenDeliveryHandler(config, logger);

    // CSRF service (only for cookies/hybrid delivery)
    const csrfService =
      config.tokenDelivery?.method === 'cookies' || config.tokenDelivery?.method === 'hybrid'
        ? new CsrfService(config)
        : undefined;

    const csrfHandler = csrfService ? new CsrfHandler(csrfService, config, logger) : null;
    logger.debug('[PERF] Handlers created');

    // ========================================================================
    // 6. Register Middleware with Adapter
    // ========================================================================
    logger.debug('[PERF] Registering middleware with adapter...');
    const middleware = {
      // ClientInfo MUST be first - initializes context
      clientInfo: adapter.registerMiddleware('clientInfo', clientInfoHandler.handle.bind(clientInfoHandler), {
        initializesContext: true,
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

      // Context helpers (read from ContextStorage)
      getCurrentUser: () => ContextStorage.get<IUser>('CURRENT_USER'),
      getCurrentSession: () => ContextStorage.get<string | number>('CURRENT_SESSION'),
      getClientInfo: () => ContextStorage.get<ClientInfo>('CLIENT_INFO'),
    };
    logger.debug('[PERF] Middleware registered with adapter');

    // ========================================================================
    // 8. Build and Return Instance
    // ========================================================================
    logger.debug('[PERF] Building NAuth instance...');

    // Exclude internal services from public API
    const { challengeService, authChallengeHelperService, ...publicServices } = services;

    logger.log(`NAuth initialized successfully with ${adapter.name}`);
    logger.debug('[PERF] NAuth initialization completed');

    return {
      ...publicServices,
      ...socialProviders,
      middleware,
      helpers,
      adapter,
      config,
      logger,
      socialAuthService: services.socialAuthService,
      csrfService,
    };
  }
}
