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
import { AuthFlowContextBuilder, AuthFlowStateMachineService } from './internal';
import { ClientInfo } from './interfaces/client-info.interface';
import { IUser } from './interfaces/entities.interface';

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
    // 1. Initialize Repositories & Storage
    // ========================================================================
    const repos = getRepositories(dataSource);
    const storage = await initStorage(config, repos.rateLimitRepository, repos.storageLockRepository, logger);

    // ========================================================================
    // 2. Initialize Services
    // ========================================================================
    const emailProvider = config.emailProvider;
    const smsProvider = config.smsProvider;
    const services: NAuthServices = initServices(config, repos, storage, logger, emailProvider, smsProvider);

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
    const socialAuthStateStore = new Map<string, { timestamp: number; provider: string }>();

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
    );

    // ========================================================================
    // 5. Create Handlers
    // ========================================================================
    const clientInfoHandler = new ClientInfoHandler(services.clientInfoService, services.geoLocationService, logger);

    const authHandler = new AuthHandler(
      services.jwtService,
      services.sessionService,
      repos.userRepository,
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

    // ========================================================================
    // 6. Register Middleware with Adapter
    // ========================================================================
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

    // ========================================================================
    // 8. Build and Return Instance
    // ========================================================================

    // Exclude internal services from public API
    const { challengeService, authChallengeHelperService, ...publicServices } = services;

    logger.log(`NAuth initialized successfully with ${adapter.name}`);

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
