import {
  Inject,
  Injectable,
  Module,
  DynamicModule,
  Global,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD, ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityMetadata, Repository } from 'typeorm';
// Public API imports
import {
  BaseUser,
  BaseApiKey,
  BaseSession,
  BaseChallengeSession,
  BaseMFADevice,
  BaseSocialAccount,
  BaseAuthAudit,
  BaseVerificationToken,
  BaseLoginAttempt,
  BaseTrustedDevice,
  BaseRateLimit,
  BaseStorageLock,
  NAuthConfig,
  LoggerService,
  NAuthException,
  AuthErrorCode,
  StorageAdapter,
  authConfigSchema,
  AuthService,
  AdminAuthService,
  ApiKeyService,
  EmailVerificationService,
  PhoneVerificationService,
  SocialAuthService,
  MFAService,
  ClientInfoService,
  RateLimitStorageService,
  AccountLockoutStorageService,
  NAuthLogger,
  AuthAuditService, // Public type for DI token
  EmailProvider,
  SMSProvider,
  SMSTemplateEngine,
  SMSTemplateEngineImpl,
  SocialRedirectHandler,
  type IMFAProviderService,
  type ISocialAuthProviderService,
} from '@nauth-toolkit/core';

// Internal API imports (for framework adapter use only)
import {
  PasswordService,
  JwtService,
  SessionService,
  GeoLocationService,
  TrustedDeviceService,
  RiskDetectionService,
  RiskScoringService,
  AdaptiveMFADecisionService,
  AuthFlowStateMachineService,
  AuthFlowContextBuilder,
  ChallengeService,
  AuthChallengeHelperService,
  SocialProviderRegistry,
  NAUTH_MFA_PROVIDER_TOKEN,
  NAUTH_SOCIAL_PROVIDER_TOKEN,
  AuthAuditService as InternalAuthAuditService, // Internal version with recordEvent() for instantiation
  PasswordResetService,
  SocialAuthStateStore,
  HookRegistryService,
  registerBuiltInEmailNotificationHooks,
  TelemetryService,
} from '@nauth-toolkit/core/internal';

// MaxMind module type (for type safety in factory)
// Matches the type definition in geo-location.service.ts
type MaxMindModule = {
  Reader: {
    open: (dbPath: string) => Promise<{
      city: (ip: string) => {
        country?: { isoCode?: string; names?: { en?: string }; isInEuropeanUnion?: boolean };
        city?: { names?: { en?: string } };
        subdivisions?: Array<{ names?: { en?: string } }>;
        postal?: { code?: string };
        location?: { latitude?: number; longitude?: number; timeZone?: string };
        continent?: { code?: string; names?: { en?: string } };
      };
      country: (ip: string) => {
        country?: { isoCode?: string; names?: { en?: string }; isInEuropeanUnion?: boolean };
        continent?: { code?: string; names?: { en?: string } };
      };
    }>;
  };
};
import { CookieTokenInterceptor } from './interceptors/cookie-token.interceptor';
import { NAuthContextInterceptor } from './interceptors/nauth-context.interceptor';
import { AuthGuard } from './guards/auth.guard';
import { NAuthContextGuard } from './guards/nauth-context.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CsrfService } from './services/csrf.service';
import { TokenDeliveryHttpService } from './services/token-delivery-http.service';
import { nauthMigrationsBootstrapProvider } from './services/migrations-bootstrap.service';

// ============================================================================
// Provider Auto-Registration (NestJS)
// ============================================================================

/**
 * Auto-registers MFA + Social provider services into their respective registries.
 *
 * @remarks
 * This runs on `OnApplicationBootstrap` to guarantee **all modules** have been instantiated,
 * removing any dependency on the order of `imports: []` in the consumer application.
 *
 * Provider modules contribute providers by binding their service to the shared tokens:
 * - `NAUTH_MFA_PROVIDER_TOKEN`
 * - `NAUTH_SOCIAL_PROVIDER_TOKEN`
 */
@Injectable()
class NAuthProviderAutoRegistrationService implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly mfaService: MFAService,
    private readonly socialProviderRegistry: SocialProviderRegistry,
    private readonly hookRegistry: HookRegistryService,
    @Inject('EMAIL_PROVIDER') private readonly emailProvider: EmailProvider,
    // NOTE: These are provided by AuthModule. Marked optional for safe initialization in edge test contexts.
    @Optional() @Inject('NAUTH_LOGGER') private readonly logger?: NAuthLogger,
    @Optional() @Inject('NAUTH_CONFIG') private readonly config?: NAuthConfig,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {}

  /**
   * Runs after all modules are initialized; discovers providers and registers them.
   */
  onApplicationBootstrap(): void {
    // ==========================================================================
    // MFA Providers
    // ==========================================================================
    const mfaProviders = this.safeGetAllProviders<unknown>(NAUTH_MFA_PROVIDER_TOKEN);
    let registeredMfa = 0;
    for (const p of mfaProviders) {
      // Only register providers that match the public contract.
      if (!this.isMfaProvider(p)) continue;
      if (p.isMethodAllowed()) {
        this.mfaService.registerProvider(p);
        registeredMfa += 1;
      }
    }

    // ==========================================================================
    // Social Providers
    // ==========================================================================
    const socialProviders = this.safeGetAllProviders<unknown>(NAUTH_SOCIAL_PROVIDER_TOKEN);
    let validSocialProviders = 0;
    let registeredSocial = 0;
    const socialConfig = this.config?.social as unknown as Record<string, { enabled?: boolean }> | undefined;

    for (const p of socialProviders) {
      if (!this.isSocialProvider(p)) continue;
      validSocialProviders += 1;
      // Follow existing behavior: register only if enabled in config.
      const enabled = socialConfig?.[p.providerName]?.enabled === true;
      if (enabled) {
        this.socialProviderRegistry.registerProvider(p);
        registeredSocial += 1;
      } else if (this.logger?.isEnabled?.()) {
        this.logger.debug(
          `[nauth-toolkit] Social provider '${p.providerName}' found but not enabled in config (social.${p.providerName}.enabled !== true)`,
        );
      }
    }

    if (this.logger?.isEnabled?.()) {
      this.logger.debug(
        `[nauth-toolkit] Auto-registered providers (NestJS): MFA=${registeredMfa}/${mfaProviders.length}, Social=${registeredSocial}/${validSocialProviders} (${socialProviders.length} total from DI)`,
      );
    }

    // ==========================================================================
    // Built-in Email Notification Hooks (opt-in via config.emailNotifications)
    // ==========================================================================
    // Register built-in hooks on bootstrap to guarantee they are wired before any requests,
    // similar to MFA/Social provider auto-registration.
    if (this.config) {
      registerBuiltInEmailNotificationHooks(this.hookRegistry, this.emailProvider, this.config, this.logger);
      if (this.logger?.isEnabled?.()) {
        this.logger.debug('[nauth-toolkit] Registered built-in email notification hooks (NestJS)');
      }
    }

    // ==========================================================================
    // Anonymous Usage Telemetry (opt-out)
    // ==========================================================================
    // Deferred so application bootstrap gains no awaits; runs after provider
    // registration above so the reported provider lists are complete.
    // See https://nauth.dev/docs/concepts/telemetry
    if (this.telemetryService) {
      const telemetry = this.telemetryService;
      setImmediate(() => {
        telemetry.sendBootPing();
        telemetry.startHeartbeat();
      });
    }
  }

  /**
   * Stops the telemetry heartbeat timer on application shutdown.
   */
  onApplicationShutdown(): void {
    this.telemetryService?.shutdown();
  }

  private safeGetAllProviders<T>(token: string): T[] {
    // `ModuleRef.get()` throws if the token is unknown. We treat "not present" as empty.
    try {
      const resolved = this.moduleRef.get<T>(token as unknown as never, { strict: false, each: true } as never);
      return Array.isArray(resolved) ? resolved : [resolved];
    } catch {
      return [];
    }
  }

  private isMfaProvider(value: unknown): value is IMFAProviderService {
    return (
      typeof value === 'object' &&
      value !== null &&
      'methodName' in value &&
      'isMethodAllowed' in value &&
      'setup' in value &&
      'verifySetup' in value &&
      'verify' in value &&
      typeof (value as { isMethodAllowed?: unknown }).isMethodAllowed === 'function' &&
      typeof (value as { setup?: unknown }).setup === 'function' &&
      typeof (value as { verifySetup?: unknown }).verifySetup === 'function' &&
      typeof (value as { verify?: unknown }).verify === 'function'
    );
  }

  private isSocialProvider(value: unknown): value is ISocialAuthProviderService {
    return (
      typeof value === 'object' &&
      value !== null &&
      'providerName' in value &&
      'getAuthUrl' in value &&
      'handleCallback' in value &&
      'verifyToken' in value &&
      'linkAccount' in value &&
      'getUserProfileFromCallback' in value &&
      typeof (value as { providerName?: unknown }).providerName === 'string' &&
      typeof (value as { getAuthUrl?: unknown }).getAuthUrl === 'function' &&
      typeof (value as { handleCallback?: unknown }).handleCallback === 'function' &&
      typeof (value as { verifyToken?: unknown }).verifyToken === 'function' &&
      typeof (value as { linkAccount?: unknown }).linkAccount === 'function' &&
      typeof (value as { getUserProfileFromCallback?: unknown }).getUserProfileFromCallback === 'function'
    );
  }
}

/**
 * Extended NAuth Configuration (includes optional entities)
 *
 * Entities are optional - AuthModule will auto-discover them from DataSource if not provided.
 * Consumer apps should NOT need to configure entities if they're already in TypeORM.forRoot().
 */
export interface NAuthModuleConfig extends NAuthConfig {
  /**
   * Optional: TypeORM entities from database package
   *
   * **Note:** Entities are optional if already registered in `TypeOrmModule.forRoot()`.
   * AuthModule will auto-discover entities from DataSource metadata.
   *
   * Only provide if you're not using `TypeOrmModule.forRoot()` with entities.
   *
   * @example
   * ```typescript
   * // PREFERRED - Auto-discovery (entities in TypeORM.forRoot())
   * TypeOrmModule.forRoot({ entities: getNAuthEntities(), ... })
   * AuthModule.forRoot({ jwt: {...} }) // entities not needed
   *
   * // ALSO VALID - Explicit entities (if not using TypeORM.forRoot())
   * AuthModule.forRoot({ entities: getNAuthEntities(), jwt: {...} })
   * ```
   */
  entities?: Function[];
}

/**
 * Main Authentication Module (v2.0 - Modular)
 *
 * Core provides base authentication services.
 * Features like MFA, social auth, phone verification are in separate packages.
 */
@Global()
@Module({})
export class AuthModule {
  /**
   * Configure module with static configuration
   *
   * @param config - NAuthModuleConfig with entities from database package
   */
  static forRoot(config: NAuthModuleConfig): DynamicModule {
    // Validate configuration
    this.validateConfig(config);

    // Initialize logger wrapper (silent by default if no logger provided)
    const nauthLogger = new NAuthLogger(config.logger);

    // Log initialization
    if (nauthLogger.isEnabled()) {
      nauthLogger.log('Initializing nauth-toolkit...');
      nauthLogger.debug(`Table prefix: ${config.tablePrefix || 'nauth_'}`);
      nauthLogger.debug(`JWT algorithm: ${config.jwt.algorithm || 'HS256'}`);
    }

    // Storage adapter will be initialized in useFactory below
    // Use config.storageAdapter if provided, otherwise default to MemoryStorageAdapter

    // Determine entities - use provided or discover from DataSource
    const entities = config.entities || [];

    return {
      module: AuthModule,
      imports: [
        // TypeORM entities - only if provided (otherwise entities from forRoot() are used)
        ...(entities.length > 0 ? [TypeOrmModule.forFeature(entities)] : []),
      ],
      providers: [
        // Auto-run nauth-toolkit migrations on startup (no consumer burden)
        nauthMigrationsBootstrapProvider,

        // Auto-register social + MFA provider modules at application bootstrap (order-independent)
        NAuthProviderAutoRegistrationService,

        // Global guard for AsyncLocalStorage context initialization (runs FIRST)
        // Must run before other guards to ensure context is available
        {
          provide: APP_GUARD,
          useClass: NAuthContextGuard,
        },

        // Global interceptor for context restoration (restores context for controllers)
        {
          provide: APP_INTERCEPTOR,
          useClass: NAuthContextInterceptor,
        },
        // Shared token delivery helper (used by interceptor + controllers)
        TokenDeliveryHttpService,

        // Social redirect handler (framework-neutral). Consumer apps define controllers and delegate here.
        {
          provide: SocialRedirectHandler,
          useFactory: (
            config: NAuthConfig,
            providerRegistry: SocialProviderRegistry,
            stateStore: SocialAuthStateStore,
            storage: StorageAdapter,
            logger: NAuthLogger,
          ) => {
            return new SocialRedirectHandler(config, providerRegistry, stateStore, storage, logger);
          },
          inject: [
            'NAUTH_CONFIG',
            SocialProviderRegistry,
            'SOCIAL_AUTH_STATE_STORE',
            'STORAGE_ADAPTER',
            'NAUTH_LOGGER',
          ],
        },

        // Global interceptor for cookie token delivery (no-op in JSON mode)
        {
          provide: APP_INTERCEPTOR,
          useClass: CookieTokenInterceptor,
        },

        // CSRF Service (always provided, but only used when tokenDelivery.method === 'cookies' or 'hybrid')
        {
          provide: CsrfService,
          useFactory: (config: NAuthConfig) => {
            return new CsrfService(config);
          },
          inject: ['NAUTH_CONFIG'],
        },

        // CSRF Guard (conditionally applied when using cookie-based token delivery)
        ...(config.tokenDelivery?.method === 'cookies' || config.tokenDelivery?.method === 'hybrid'
          ? [
              {
                provide: APP_GUARD,
                useClass: CsrfGuard,
              },
            ]
          : []),
        // Configuration
        {
          provide: 'NAUTH_CONFIG',
          useValue: config,
        },

        // Logger
        {
          provide: 'NAUTH_LOGGER',
          useValue: nauthLogger,
        },

        // Storage adapter - use config or default to DatabaseStorageAdapter if repositories available
        // WARNING: PRODUCTION REQUIREMENT - MemoryStorageAdapter is NOT safe for production
        // - Data lost on server restart
        // - NOT shared across multiple server instances
        // - Rate limiting per-container (not global in multi-container setups)
        // - Token reuse detection fails in multi-server deployments
        {
          provide: 'STORAGE_ADAPTER',
          useFactory: async (
            config: NAuthConfig,
            logger: NAuthLogger,
            rateLimitRepo: Repository<BaseRateLimit> | null,
            storageLockRepo: Repository<BaseStorageLock> | null,
          ) => {
            // If storage adapter is explicitly provided, use it
            if (config.storageAdapter) {
              const adapter = config.storageAdapter;

              // Inject logger into adapter if it supports setLogger (for factory-created adapters)
              if (
                adapter &&
                typeof (adapter as unknown as { setLogger?: (logger: LoggerService) => void }).setLogger === 'function'
              ) {
                (adapter as unknown as { setLogger: (logger: LoggerService) => void }).setLogger(logger);
              }
              // Inject repositories into DatabaseStorageAdapter if it supports setRepositories
              if (
                adapter &&
                typeof (
                  adapter as unknown as {
                    setRepositories?: (
                      rateLimitRepo: Repository<BaseRateLimit>,
                      storageLockRepo: Repository<BaseStorageLock>,
                    ) => void;
                  }
                ).setRepositories === 'function'
              ) {
                if (rateLimitRepo && storageLockRepo) {
                  (
                    adapter as unknown as {
                      setRepositories: (
                        rateLimitRepo: Repository<BaseRateLimit>,
                        storageLockRepo: Repository<BaseStorageLock>,
                      ) => void;
                    }
                  ).setRepositories(rateLimitRepo, storageLockRepo);
                }
              }
              await adapter.initialize();
              return adapter;
            }

            // No storage adapter provided - try to use DatabaseStorageAdapter if repositories available
            if (rateLimitRepo && storageLockRepo) {
              // Default to DatabaseStorageAdapter when repositories are available (most apps have a database)
              try {
                // Lazy import to avoid bundling if not used
                const { DatabaseStorageAdapter } = await import('@nauth-toolkit/storage-database');

                const adapter = new DatabaseStorageAdapter(null, null, logger);
                adapter.setRepositories(rateLimitRepo, storageLockRepo);
                await adapter.initialize();
                logger?.warn?.(
                  'WARNING: Storage adapter not provided. Using DatabaseStorageAdapter as default. ' +
                    'For production, explicitly configure storageAdapter in your config.',
                );
                return adapter;
              } catch (error) {
                // If DatabaseStorageAdapter import fails, fall through to error
                logger?.error?.(
                  'Failed to create DatabaseStorageAdapter. Please explicitly configure storageAdapter in your config.',
                  { error },
                );
              }
            }

            // No storage adapter provided and no repositories available - REQUIRE explicit configuration
            throw new Error(
              'Storage adapter is REQUIRED for production deployments. ' +
                'MemoryStorageAdapter is NOT safe for production (data lost on restart, not shared across instances). ' +
                'Please configure storageAdapter in your NAuthConfig:\n\n' +
                'Option 1: DatabaseStorageAdapter (recommended if you have a database)\n' +
                '  import { DatabaseStorageAdapter } from "@nauth-toolkit/storage-database";\n' +
                '  storageAdapter: new DatabaseStorageAdapter()\n\n' +
                'Option 2: RedisStorageAdapter (for high-performance multi-server deployments)\n' +
                '  import { RedisStorageAdapter } from "@nauth-toolkit/storage-redis";\n' +
                '  storageAdapter: new RedisStorageAdapter(redisClient)\n\n' +
                'Make sure to include storage entities in your TypeORM configuration:\n' +
                '  import { getNAuthTransientStorageEntities } from "@nauth-toolkit/database-typeorm-postgres";\n' +
                '  entities: [...getNAuthEntities(), ...getNAuthTransientStorageEntities()]',
            );
          },
          inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER', 'RateLimitRepository', 'StorageLockRepository'],
        },

        // Rate Limit Repository (optional - only needed for DatabaseStorageAdapter)
        {
          provide: 'RateLimitRepository',
          useFactory: (dataSource: DataSource, _logger?: NAuthLogger) => {
            // Try to find entity from config first
            const entityFromConfig = entities.find((e: Function) => e.name === 'RateLimit');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            // Try to find by table name in DataSource metadata
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_rate_limits',
            );
            if (metadata) {
              return dataSource.getRepository(metadata.target);
            }
            // Try to find by class name in metadata
            const metadataByName = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => typeof m.target === 'function' && m.target.name === 'RateLimit',
            );
            if (metadataByName && typeof metadataByName.target === 'function') {
              return dataSource.getRepository(metadataByName.target);
            }
            // Return null if not found (storage adapter might not be DatabaseStorageAdapter)
            return null;
          },
          inject: [DataSource, 'NAUTH_LOGGER'],
        },

        // Storage Lock Repository (optional - only needed for DatabaseStorageAdapter)
        {
          provide: 'StorageLockRepository',
          useFactory: (dataSource: DataSource, _logger?: NAuthLogger) => {
            // Try to find entity from config first
            const entityFromConfig = entities.find((e: Function) => e.name === 'StorageLock');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            // Try to find by table name in DataSource metadata
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_storage_locks',
            );
            if (metadata) {
              return dataSource.getRepository(metadata.target);
            }
            // Try to find by class name in metadata
            const metadataByName = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => typeof m.target === 'function' && m.target.name === 'StorageLock',
            );
            if (metadataByName && typeof metadataByName.target === 'function') {
              return dataSource.getRepository(metadataByName.target);
            }
            // Return null if not found (storage adapter might not be DatabaseStorageAdapter)
            return null;
          },
          inject: [DataSource, 'NAUTH_LOGGER'],
        },

        // Repository Tokens - discover entities from DataSource metadata
        // This allows entities to be auto-discovered if registered in TypeORM.forRoot()
        {
          provide: 'UserRepository',
          useFactory: (dataSource: DataSource, _logger?: NAuthLogger) => {
            // Try to find entity from provided config first
            const entityFromConfig = entities.find((e: Function) => e.name === 'User');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            // Otherwise, find by table name from DataSource metadata
            const metadata = dataSource.entityMetadatas.find((m: EntityMetadata) => m.tableName === 'nauth_users');
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'User entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource, 'NAUTH_LOGGER'],
        },
        {
          provide: 'SessionRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'Session');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find((m: EntityMetadata) => m.tableName === 'nauth_sessions');
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'Session entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'LoginAttemptRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'LoginAttempt');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_login_attempts',
            );
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'LoginAttempt entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'VerificationTokenRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'VerificationToken');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_verification_tokens',
            );
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'VerificationToken entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'SocialAccountRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'SocialAccount');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_social_accounts',
            );
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'SocialAccount entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'SocialProviderSecretRepository',
          useFactory: (dataSource: DataSource, logger?: LoggerService) => {
            // Try to find entity from config first
            const entityFromConfig = entities.find((e: Function) => e.name === 'SocialProviderSecret');
            if (entityFromConfig) {
              const repo = dataSource.getRepository(entityFromConfig);
              if (logger) {
                (logger as { debug?: (msg: string) => void }).debug?.(
                  '[NAuth] SocialProviderSecretRepository: Found entity from config',
                );
              }
              return repo;
            }

            // Fallback: find by table name in DataSource metadata
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_social_provider_secrets',
            );

            if (metadata) {
              const repo = dataSource.getRepository(metadata.target);
              if (logger) {
                (logger as { debug?: (msg: string) => void }).debug?.(
                  '[NAuth] SocialProviderSecretRepository: Found entity from DataSource metadata',
                );
              }
              return repo;
            }

            // Not found: keep this OPTIONAL at the AuthModule layer.
            // WHY: social providers are optional; we only require this repository when Apple is enabled.
            // Apple module/service will validate presence when apple.enabled === true.
            (logger as { debug?: (msg: string) => void } | undefined)?.debug?.(
              '[NAuth] SocialProviderSecretRepository: entity not registered (optional unless Apple is enabled)',
            );
            return null;
          },
          inject: [DataSource, 'NAUTH_LOGGER'],
        },
        {
          provide: 'ChallengeSessionRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'ChallengeSession');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_challenge_sessions',
            );
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'ChallengeSession entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'MFADeviceRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'MFADevice');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_mfa_devices',
            );
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'MFADevice entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'AuthAuditRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'AuthAudit');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find((m: EntityMetadata) => m.tableName === 'nauth_auth_audit');
            if (!metadata) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'AuthAudit entity not found. Register entities in TypeORM.forRoot() or provide in config.entities',
              );
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'TrustedDeviceRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'TrustedDevice');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find(
              (m: EntityMetadata) => m.tableName === 'nauth_trusted_devices',
            );
            if (!metadata) {
              // Return null if not found (rememberDevice might be disabled)
              return null;
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },
        {
          provide: 'ApiKeyRepository',
          useFactory: (dataSource: DataSource) => {
            const entityFromConfig = entities.find((e: Function) => e.name === 'ApiKey');
            if (entityFromConfig) {
              return dataSource.getRepository(entityFromConfig);
            }
            const metadata = dataSource.entityMetadatas.find((m: EntityMetadata) => m.tableName === 'nauth_api_keys');
            if (!metadata) {
              // Return null if not found (API keys feature might be disabled)
              return null;
            }
            return dataSource.getRepository(metadata.target);
          },
          inject: [DataSource],
        },

        // Services
        {
          provide: PasswordService,
          useFactory: () => {
            return new PasswordService(config.password);
          },
        },
        {
          provide: 'PASSWORD_SERVICE',
          useFactory: () => {
            return new PasswordService(config.password);
          },
        },
        {
          provide: JwtService,
          useFactory: () => {
            return new JwtService(config.jwt);
          },
        },
        {
          provide: SessionService,
          useFactory: (
            sessionRepository: Repository<BaseSession>,
            storageAdapter: StorageAdapter,
            clientInfoService: ClientInfoService,
            nauthConfig: NAuthConfig,
            logger: NAuthLogger,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
          ) => {
            return new SessionService(
              sessionRepository,
              storageAdapter,
              clientInfoService,
              nauthConfig,
              logger,
              auditService,
            );
          },
          inject: [
            'SessionRepository',
            'STORAGE_ADAPTER',
            ClientInfoService,
            'NAUTH_CONFIG',
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
          ],
        },
        {
          provide: ChallengeService,
          useFactory: (
            challengeSessionRepository: Repository<BaseChallengeSession>,
            clientInfoService: ClientInfoService,
            logger: NAuthLogger,
            auditService: InternalAuthAuditService | undefined, // Optional - only available when auditLogs.enabled is true
            config: NAuthConfig,
          ) => {
            return new ChallengeService(challengeSessionRepository, clientInfoService, logger, auditService, config);
          },
          inject: [
            'ChallengeSessionRepository',
            ClientInfoService,
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
            'NAUTH_CONFIG',
          ],
        },
        // AuthFlowContextBuilder - builds context with pre-computed values
        {
          provide: AuthFlowContextBuilder,
          useFactory: (
            trustedDeviceService?: TrustedDeviceService | null,
            adaptiveMFADecisionService?: AdaptiveMFADecisionService,
            clientInfoService?: ClientInfoService,
            logger?: NAuthLogger,
          ) => {
            return new AuthFlowContextBuilder(
              trustedDeviceService || undefined,
              adaptiveMFADecisionService,
              clientInfoService,
              logger,
            );
          },
          inject: [
            { token: TrustedDeviceService, optional: true },
            { token: AdaptiveMFADecisionService, optional: true },
            { token: ClientInfoService, optional: true },
            { token: 'NAUTH_LOGGER', optional: true },
          ],
        },
        // AuthFlowStateMachineService - evaluates authentication flow states
        {
          provide: AuthFlowStateMachineService,
          useFactory: (contextBuilder: AuthFlowContextBuilder, logger?: NAuthLogger) => {
            return new AuthFlowStateMachineService(contextBuilder, logger);
          },
          inject: [AuthFlowContextBuilder, { token: 'NAUTH_LOGGER', optional: true }],
        },
        {
          provide: AuthChallengeHelperService,
          useFactory: (
            challengeService: ChallengeService,
            jwtService: JwtService,
            sessionService: SessionService,
            mfaDeviceRepository: Repository<BaseMFADevice>,
            logger: NAuthLogger,
            stateMachine: AuthFlowStateMachineService,
            contextBuilder: AuthFlowContextBuilder,
            clientInfoService: ClientInfoService,
            emailVerificationService?: EmailVerificationService,
            phoneVerificationService?: PhoneVerificationService,
            trustedDeviceService?: TrustedDeviceService,
          ) => {
            return new AuthChallengeHelperService(
              challengeService,
              jwtService,
              sessionService,
              mfaDeviceRepository,
              logger,
              stateMachine,
              contextBuilder,
              clientInfoService,
              emailVerificationService,
              phoneVerificationService,
              trustedDeviceService,
            );
          },
          inject: [
            ChallengeService,
            JwtService,
            SessionService,
            'MFADeviceRepository',
            'NAUTH_LOGGER',
            AuthFlowStateMachineService,
            AuthFlowContextBuilder,
            ClientInfoService,
            { token: EmailVerificationService, optional: true },
            { token: PhoneVerificationService, optional: true },
            { token: TrustedDeviceService, optional: true },
          ],
        },
        {
          provide: AdminAuthService,
          useFactory: (
            userRepository: Repository<BaseUser>,
            loginAttemptRepository: Repository<BaseLoginAttempt>,
            passwordService: PasswordService,
            sessionService: SessionService,
            challengeService: ChallengeService,
            challengeHelper: AuthChallengeHelperService,
            emailVerificationService: EmailVerificationService,
            clientInfoService: ClientInfoService,
            accountLockoutStorage: AccountLockoutStorageService,
            nauthConfig: NAuthConfig,
            logger: NAuthLogger,
            hookRegistry: HookRegistryService,
            auditService?: InternalAuthAuditService,
            phoneVerificationService?: PhoneVerificationService,
            mfaDeviceRepository?: Repository<BaseMFADevice>,
            trustedDeviceService?: TrustedDeviceService,
            passwordResetService?: PasswordResetService,
            socialAuthService?: SocialAuthService,
            sessionRepository?: Repository<BaseSession>,
            verificationTokenRepository?: Repository<BaseVerificationToken>,
            socialAccountRepository?: Repository<BaseSocialAccount>,
            challengeSessionRepository?: Repository<BaseChallengeSession>,
            authAuditRepository?: Repository<BaseAuthAudit>,
            trustedDeviceRepository?: Repository<BaseTrustedDevice>,
          ) => {
            return new AdminAuthService(
              userRepository,
              loginAttemptRepository,
              passwordService,
              sessionService,
              challengeService,
              challengeHelper,
              emailVerificationService,
              clientInfoService,
              accountLockoutStorage,
              nauthConfig,
              logger,
              hookRegistry,
              auditService,
              phoneVerificationService,
              mfaDeviceRepository,
              trustedDeviceService,
              passwordResetService,
              socialAuthService,
              sessionRepository,
              verificationTokenRepository,
              socialAccountRepository,
              challengeSessionRepository,
              authAuditRepository,
              trustedDeviceRepository,
            );
          },
          inject: [
            'UserRepository',
            'LoginAttemptRepository',
            PasswordService,
            SessionService,
            ChallengeService,
            AuthChallengeHelperService,
            EmailVerificationService,
            ClientInfoService,
            AccountLockoutStorageService,
            'NAUTH_CONFIG',
            'NAUTH_LOGGER',
            HookRegistryService,
            { token: InternalAuthAuditService, optional: true },
            { token: PhoneVerificationService, optional: true },
            { token: 'MFADeviceRepository', optional: true },
            { token: TrustedDeviceService, optional: true },
            { token: PasswordResetService, optional: true },
            { token: SocialAuthService, optional: true },
            { token: 'SessionRepository', optional: true },
            { token: 'VerificationTokenRepository', optional: true },
            { token: 'SocialAccountRepository', optional: true },
            { token: 'ChallengeSessionRepository', optional: true },
            { token: 'AuthAuditRepository', optional: true },
            { token: 'TrustedDeviceRepository', optional: true },
          ],
        },
        {
          provide: AuthService,
          useFactory: (
            userRepository: Repository<BaseUser>,
            loginAttemptRepository: Repository<BaseLoginAttempt>,
            passwordService: PasswordService,
            jwtService: JwtService,
            sessionService: SessionService,
            challengeService: ChallengeService,
            challengeHelper: AuthChallengeHelperService,
            emailVerificationService: EmailVerificationService,
            clientInfoService: ClientInfoService,
            accountLockoutStorage: AccountLockoutStorageService,
            nauthConfig: NAuthConfig,
            logger: NAuthLogger,
            hookRegistry: HookRegistryService,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
            phoneVerificationService?: PhoneVerificationService,
            mfaService?: MFAService,
            mfaDeviceRepository?: Repository<BaseMFADevice>,
            trustedDeviceService?: TrustedDeviceService,
            passwordResetService?: PasswordResetService,
            socialAuthService?: SocialAuthService, // Optional - only available when social auth is configured
            sessionRepository?: Repository<BaseSession>, // Optional - for cascade deletion
            verificationTokenRepository?: Repository<BaseVerificationToken>, // Optional - for cascade deletion
            socialAccountRepository?: Repository<BaseSocialAccount>, // Optional - for cascade deletion
            challengeSessionRepository?: Repository<BaseChallengeSession>, // Optional - for cascade deletion
            authAuditRepository?: Repository<BaseAuthAudit>, // Optional - for cascade deletion
            trustedDeviceRepository?: Repository<BaseTrustedDevice>, // Optional - for cascade deletion
          ) => {
            return new AuthService(
              userRepository,
              loginAttemptRepository,
              passwordService,
              jwtService,
              sessionService,
              challengeService,
              challengeHelper,
              emailVerificationService,
              clientInfoService,
              accountLockoutStorage,
              nauthConfig,
              logger,
              hookRegistry,
              auditService,
              phoneVerificationService,
              mfaService,
              mfaDeviceRepository,
              trustedDeviceService,
              passwordResetService,
              socialAuthService,
              sessionRepository,
              verificationTokenRepository,
              socialAccountRepository,
              challengeSessionRepository,
              authAuditRepository,
              trustedDeviceRepository,
            );
          },
          inject: [
            'UserRepository',
            'LoginAttemptRepository',
            PasswordService,
            JwtService,
            SessionService,
            ChallengeService,
            AuthChallengeHelperService,
            EmailVerificationService,
            ClientInfoService,
            AccountLockoutStorageService,
            'NAUTH_CONFIG',
            'NAUTH_LOGGER',
            HookRegistryService,
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
            { token: PhoneVerificationService, optional: true },
            { token: MFAService, optional: true }, // No circular dependency - MFAService no longer depends on AuthService
            { token: 'MFADeviceRepository', optional: true },
            { token: TrustedDeviceService, optional: true },
            { token: PasswordResetService, optional: true },
            { token: SocialAuthService, optional: true }, // Optional - only available when social auth is configured
            { token: 'SessionRepository', optional: true }, // Optional - for cascade deletion
            { token: 'VerificationTokenRepository', optional: true }, // Optional - for cascade deletion
            { token: 'SocialAccountRepository', optional: true }, // Optional - for cascade deletion
            { token: 'ChallengeSessionRepository', optional: true }, // Optional - for cascade deletion
            { token: 'AuthAuditRepository', optional: true }, // Optional - for cascade deletion
            { token: 'TrustedDeviceRepository', optional: true }, // Optional - for cascade deletion
          ],
        },
        {
          provide: TrustedDeviceService,
          useFactory: (
            config: NAuthConfig,
            logger: NAuthLogger,
            trustedDeviceRepository?: Repository<BaseTrustedDevice> | null,
          ) => {
            if (!trustedDeviceRepository) {
              // Return null if repository not available (rememberDevice disabled)
              return null;
            }
            return new TrustedDeviceService(config, logger, trustedDeviceRepository);
          },
          inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER', { token: 'TrustedDeviceRepository', optional: true }],
        },

        // Social Auth State Store - StorageAdapter-backed, cluster-safe CSRF state + redirect context store
        {
          provide: 'SOCIAL_AUTH_STATE_STORE',
          useFactory: (storageAdapter: StorageAdapter, logger: NAuthLogger) => {
            return new SocialAuthStateStore(storageAdapter, logger);
          },
          inject: ['STORAGE_ADAPTER', 'NAUTH_LOGGER'],
        },

        // Social Provider Registry - internal registry for social providers
        // Provider modules (GoogleSocialAuthModule, AppleSocialAuthModule, etc.)
        // will automatically register themselves with this registry via OnModuleInit
        SocialProviderRegistry,

        // Anonymous usage telemetry (opt-out) - boot ping + daily heartbeat,
        // fired from NAuthProviderAutoRegistrationService after provider
        // registration. See https://nauth.dev/docs/concepts/telemetry
        {
          provide: TelemetryService,
          useFactory: (
            config: NAuthConfig,
            storageAdapter: StorageAdapter,
            logger?: NAuthLogger,
            mfaService?: MFAService,
            socialProviderRegistry?: SocialProviderRegistry,
          ) => {
            return new TelemetryService(config, storageAdapter, logger, 'nestjs', mfaService, socialProviderRegistry);
          },
          inject: [
            'NAUTH_CONFIG',
            'STORAGE_ADAPTER',
            { token: 'NAUTH_LOGGER', optional: true },
            { token: MFAService, optional: true },
            { token: SocialProviderRegistry, optional: true },
          ],
        },

        // MFA Service - registry for auto-registered MFA providers
        // Provider modules (TOTPMFAModule, SMSMFAModule, PasskeyMFAModule, etc.)
        // will automatically register themselves with this service via OnModuleInit
        {
          provide: MFAService,
          useFactory: (
            mfaDeviceRepository: Repository<BaseMFADevice>,
            userRepository: Repository<BaseUser>,
            challengeService?: ChallengeService,
            nauthConfig?: NAuthConfig,
            logger?: NAuthLogger,
            auditService?: InternalAuthAuditService,
            clientInfoService?: ClientInfoService,
            hookRegistry?: HookRegistryService,
          ) => {
            return new MFAService(
              mfaDeviceRepository,
              userRepository,
              challengeService,
              nauthConfig,
              logger,
              auditService,
              clientInfoService,
              hookRegistry,
            );
          },
          inject: [
            'MFADeviceRepository',
            'UserRepository',
            { token: ChallengeService, optional: true },
            { token: 'NAUTH_CONFIG', optional: true },
            { token: 'NAUTH_LOGGER', optional: true },
            { token: InternalAuthAuditService, optional: true },
            { token: ClientInfoService, optional: true },
            { token: HookRegistryService, optional: true },
          ],
        },
        {
          provide: SocialAuthService,
          useFactory: (
            providerRegistry: SocialProviderRegistry,
            userRepository: Repository<BaseUser>,
            socialAccountRepository: Repository<BaseSocialAccount>,
            logger: NAuthLogger,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
          ) => {
            return new SocialAuthService(
              providerRegistry,
              userRepository,
              socialAccountRepository,
              null, // Don't inject AuthService to avoid circular dependency
              logger,
              auditService,
            );
          },
          inject: [
            SocialProviderRegistry,
            'UserRepository',
            'SocialAccountRepository',
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
          ],
        },
        ClientInfoService,
        HookRegistryService,
        // Conditionally provide AuthAuditService based on config.auditLogs.enabled
        // Default to enabled if not specified (backward compatibility)
        //
        // Architecture:
        // - Create ONE instance of InternalAuthAuditService
        // - Export as InternalAuthAuditService for internal packages (social auth, MFA providers)
        // - Alias as AuthAuditService for consumer apps (public API with fetch methods only)
        // This ensures a single instance handles both recording and fetching
        ...(config.auditLogs?.enabled !== false
          ? [
              // Primary instance: InternalAuthAuditService (has recordEvent + fetch methods)
              {
                provide: InternalAuthAuditService,
                useFactory: (
                  auditRepository: Repository<BaseAuthAudit>,
                  userRepository: Repository<BaseUser>,
                  logger: NAuthLogger,
                  clientInfoService: ClientInfoService,
                ) => {
                  return new InternalAuthAuditService(auditRepository, userRepository, logger, clientInfoService);
                },
                inject: ['AuthAuditRepository', 'UserRepository', 'NAUTH_LOGGER', ClientInfoService],
              },
              // Alias: AuthAuditService points to the same InternalAuthAuditService instance
              // Consumer apps inject AuthAuditService but get the full instance
              // TypeScript types prevent them from calling recordEvent() (not in public interface)
              {
                provide: AuthAuditService,
                useExisting: InternalAuthAuditService,
              },
            ]
          : []),
        {
          provide: RiskDetectionService,
          useFactory: (
            sessionRepository: Repository<BaseSession>,
            auditRepository: Repository<BaseAuthAudit>,
            config: NAuthConfig,
            logger: NAuthLogger,
            trustedDeviceService?: TrustedDeviceService | null, // TrustedDeviceService - optional
          ) => {
            return new RiskDetectionService(
              sessionRepository,
              auditRepository,
              config,
              logger,
              trustedDeviceService ?? undefined,
            );
          },
          inject: [
            'SessionRepository',
            'AuthAuditRepository',
            'NAUTH_CONFIG',
            'NAUTH_LOGGER',
            { token: TrustedDeviceService, optional: true },
          ],
        },
        {
          provide: RiskScoringService,
          useFactory: (config: NAuthConfig, logger: NAuthLogger) => {
            return new RiskScoringService(config, logger);
          },
          inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER'],
        },
        {
          provide: AdaptiveMFADecisionService,
          useFactory: (
            riskDetectionService: RiskDetectionService,
            riskScoringService: RiskScoringService,
            storageAdapter: StorageAdapter,
            clientInfoService: ClientInfoService,
            config: NAuthConfig,
            logger: NAuthLogger,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
            hookRegistry?: HookRegistryService,
          ) => {
            return new AdaptiveMFADecisionService(
              riskDetectionService,
              riskScoringService,
              storageAdapter,
              clientInfoService,
              config,
              logger,
              auditService,
              hookRegistry,
            );
          },
          inject: [
            RiskDetectionService,
            RiskScoringService,
            'STORAGE_ADAPTER',
            ClientInfoService,
            'NAUTH_CONFIG',
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
            { token: HookRegistryService, optional: true },
          ],
        },

        // MaxMind Module (optional - only provided if package is installed and config is present)
        // Uses dynamic import pattern (no require() - follows NestJS best practices)
        ...(config.geoLocation?.maxMind
          ? [
              {
                provide: 'MAXMIND_MODULE',
                useFactory: async (): Promise<unknown | null> => {
                  try {
                    // Use dynamic import (ES modules) instead of require()
                    // This is the proper NestJS way to handle optional peer dependencies
                    // Note: Module may not be installed - catch block handles gracefully
                    const maxMindModule = await import('@maxmind/geoip2-node');
                    return maxMindModule;
                  } catch {
                    // Package not installed - return null (service will handle gracefully)
                    return null;
                  }
                },
              },
            ]
          : [
              {
                provide: 'MAXMIND_MODULE',
                useValue: null,
              },
            ]),

        // GeoLocation Service (optional - only if MaxMind config provided)
        ...(config.geoLocation?.maxMind
          ? [
              {
                provide: GeoLocationService,
                useFactory: (
                  nauthConfig: NAuthConfig,
                  storageAdapter: StorageAdapter,
                  maxMindLib: unknown | null,
                  logger?: NAuthLogger,
                ) => {
                  return new GeoLocationService(
                    nauthConfig,
                    storageAdapter,
                    maxMindLib as MaxMindModule | null,
                    logger,
                  );
                },
                inject: ['NAUTH_CONFIG', 'STORAGE_ADAPTER', 'MAXMIND_MODULE', 'NAUTH_LOGGER'],
              },
            ]
          : []),

        // Email Provider (required - must be provided in config or from email package)
        {
          provide: 'EMAIL_PROVIDER',
          useFactory: async (): Promise<EmailProvider> => {
            if (!config.emailProvider) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'emailProvider is required. Install and configure an email package:\n' +
                  '  yarn add @nauth-toolkit/email-console (for dev)\n' +
                  '  yarn add @nauth-toolkit/email-nodemailer (for production)',
              );
            }
            const provider = config.emailProvider as EmailProvider;

            // Validate required methods (core contract)
            if (
              typeof provider.sendVerificationEmail !== 'function' ||
              typeof provider.sendPasswordResetEmail !== 'function' ||
              typeof provider.sendWelcomeEmail !== 'function'
            ) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'emailProvider must implement sendVerificationEmail, sendPasswordResetEmail, and sendWelcomeEmail',
              );
            }

            // Inject logger into provider if it has setLogger method
            {
              const maybeLoggerAware = provider as unknown as { setLogger?: (logger: NAuthLogger) => void };
              if (typeof maybeLoggerAware.setLogger === 'function') {
                maybeLoggerAware.setLogger(nauthLogger);
              }
            }

            // Inject config into provider if it supports it (used for suppression logic in some providers)
            {
              const maybeConfigAware = provider as unknown as { setConfig?: (cfg: NAuthConfig) => void };
              if (typeof maybeConfigAware.setConfig === 'function') {
                maybeConfigAware.setConfig(config);
              }
            }
            // Inject global variables from email config if provider supports it
            if (
              typeof (provider as unknown as { setGlobalVariables?: (vars: Record<string, unknown>) => void })
                .setGlobalVariables === 'function' &&
              config.email
            ) {
              const mergedVars = (config.email.globalVariables ?? {}) as Record<string, unknown>;
              (
                provider as unknown as { setGlobalVariables: (vars: Record<string, unknown>) => void }
              ).setGlobalVariables(mergedVars);
            }

            // ============================================================================
            // Register Custom Email Templates
            // ============================================================================
            const emailTemplates = config.email?.templates;
            if (emailTemplates?.customTemplates) {
              // Check if provider has getTemplateEngine method (NodemailerProvider)
              const maybeTemplateEngineAware = provider as unknown as {
                getTemplateEngine?: () => {
                  registerTemplate?: (type: string, template: { subject: string; html: string; text?: string }) => void;
                  registerTemplateFromFile?: (type: string, htmlPath: string, textPath?: string) => Promise<void>;
                  registerTemplateFromSources?: (
                    type: string,
                    sources: {
                      subject: { content?: string; filePath?: string };
                      html: { content?: string; filePath?: string };
                      text?: { content?: string; filePath?: string };
                    },
                  ) => Promise<void>;
                };
              };

              if (typeof maybeTemplateEngineAware.getTemplateEngine === 'function') {
                const templateEngine = maybeTemplateEngineAware.getTemplateEngine();

                // Register each custom template
                for (const [type, templateDef] of Object.entries(emailTemplates.customTemplates)) {
                  try {
                    if (templateDef.htmlPath) {
                      // File-based template
                      // NOTE: We intentionally avoid framework-specific path magic here.
                      // The template engine resolves relative paths against its baseDir (default: process.cwd()).
                      const htmlPath = templateDef.htmlPath;
                      const textPath = templateDef.textPath;

                      if (templateDef.subject && templateEngine.registerTemplateFromSources) {
                        // Explicit subject + file paths
                        await templateEngine.registerTemplateFromSources(type, {
                          subject: { content: templateDef.subject },
                          html: { filePath: htmlPath },
                          text: textPath ? { filePath: textPath } : undefined,
                        });
                      } else if (templateEngine.registerTemplateFromFile) {
                        // Subject is expected in HTML frontmatter
                        await templateEngine.registerTemplateFromFile(type, htmlPath, textPath);
                      }
                    } else if (templateDef.html) {
                      // Inline template
                      if (templateEngine.registerTemplate) {
                        // Parse subject from frontmatter if present, otherwise require explicit subject.
                        let subject = templateDef.subject;
                        let html = templateDef.html;

                        const frontmatterMatch = html.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
                        if (frontmatterMatch) {
                          const frontmatter = frontmatterMatch[1];
                          html = frontmatterMatch[2];
                          const subjectMatch = frontmatter.match(/subject:\s*(.+)/);
                          if (subjectMatch) subject = subjectMatch[1].trim();
                        }

                        // Graceful fallback: if subject is missing, do not register (avoids sending malformed emails).
                        if (!subject) {
                          throw new Error(
                            `Inline template "${type}" must provide "subject" or HTML frontmatter (--- subject: ... ---)`,
                          );
                        }

                        templateEngine.registerTemplate(type, {
                          subject,
                          html,
                          text: templateDef.text,
                        });
                      }
                    }
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    nauthLogger.warn?.(
                      `Failed to register email template "${type}": ${errorMessage}. Using default template.`,
                    );
                  }
                }
              } else {
                nauthLogger.warn?.(
                  '[EmailTemplates] Email provider does not support getTemplateEngine(). Custom templates will not be registered.',
                );
              }
            }

            return provider;
          },
        },
        {
          provide: EmailVerificationService,
          useFactory: (
            verificationTokenRepo: Repository<BaseVerificationToken>,
            userRepo: Repository<BaseUser>,
            emailProvider: EmailProvider,
            storageAdapter: StorageAdapter,
            nauthConfig: NAuthConfig,
            clientInfoService: ClientInfoService,
            logger: NAuthLogger,
            hookRegistry: HookRegistryService,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
          ) => {
            return new EmailVerificationService(
              verificationTokenRepo,
              userRepo,
              emailProvider,
              storageAdapter,
              nauthConfig,
              clientInfoService,
              logger,
              hookRegistry,
              auditService,
            );
          },
          inject: [
            'VerificationTokenRepository',
            'UserRepository',
            'EMAIL_PROVIDER',
            'STORAGE_ADAPTER',
            'NAUTH_CONFIG',
            ClientInfoService,
            'NAUTH_LOGGER',
            HookRegistryService,
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
          ],
        },

        // SMS Provider (optional - only needed if using phone verification)
        ...(config.smsProvider
          ? [
              {
                provide: 'SMS_PROVIDER',
                useFactory: async (): Promise<SMSProvider> => {
                  const provider = config.smsProvider as SMSProvider;

                  if (!provider || typeof provider.sendOTP !== 'function') {
                    throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'smsProvider must implement sendOTP');
                  }

                  // Inject logger into provider if it has setLogger method
                  {
                    const maybeLoggerAware = provider as unknown as { setLogger?: (logger: NAuthLogger) => void };
                    if (typeof maybeLoggerAware.setLogger === 'function') {
                      maybeLoggerAware.setLogger(nauthLogger);
                    }
                  }

                  // ============================================================================
                  // Initialize SMS Template Engine
                  // ============================================================================
                  const smsTemplates = config.sms?.templates;
                  if (smsTemplates) {
                    // If user configured templates, the provider must support the template hooks.
                    // This avoids silent fallback to hard-coded messages when templates are expected.
                    if (typeof provider.setTemplateEngine !== 'function') {
                      throw new NAuthException(
                        AuthErrorCode.VALIDATION_FAILED,
                        'sms.templates is configured, but smsProvider does not support templates. ' +
                          'Please upgrade your SMS provider package to a version that implements setTemplateEngine().',
                      );
                    }

                    // Use provided engine or create new one
                    const templateEngine: SMSTemplateEngine =
                      smsTemplates.engine ?? new SMSTemplateEngineImpl(process.cwd(), nauthLogger);

                    // Register custom templates
                    if (smsTemplates.customTemplates) {
                      for (const [type, templateDef] of Object.entries(smsTemplates.customTemplates)) {
                        try {
                          if (templateDef.content) {
                            // Inline template
                            templateEngine.registerTemplate(type, { content: templateDef.content });
                          } else if (templateDef.contentPath) {
                            // File-based template
                            await templateEngine.registerTemplateFromSources(type, {
                              content: { filePath: templateDef.contentPath },
                            });
                          }
                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                          nauthLogger.error?.(
                            `Failed to register SMS template "${type}": ${errorMessage}. Using default template.`,
                          );
                        }
                      }
                    }

                    // Inject template engine into provider
                    provider.setTemplateEngine(templateEngine);

                    // Set global variables
                    if (typeof provider.setGlobalVariables === 'function' && smsTemplates.globalVariables) {
                      // Extract selected branding fields from email.globalVariables (if available)
                      const globalVars: Record<string, string | number | boolean | undefined> = {};
                      const emailGlobals = config.email?.globalVariables as Record<string, unknown> | undefined;
                      if (typeof emailGlobals?.appName === 'string') {
                        globalVars.appName = emailGlobals.appName;
                      }
                      if (typeof emailGlobals?.companyName === 'string') {
                        globalVars.companyName = emailGlobals.companyName;
                      }
                      if (typeof emailGlobals?.supportEmail === 'string') {
                        globalVars.supportEmail = emailGlobals.supportEmail;
                      }

                      // Merge with sms.templates.globalVariables (sms.templates.globalVariables takes precedence)
                      // Filter out non-compatible types from globalVariables
                      const smsGlobalVars: Record<string, string | number | boolean | undefined> = {};
                      for (const [key, value] of Object.entries(smsTemplates.globalVariables)) {
                        if (
                          typeof value === 'string' ||
                          typeof value === 'number' ||
                          typeof value === 'boolean' ||
                          value === undefined
                        ) {
                          smsGlobalVars[key] = value;
                        }
                      }

                      const mergedVars: Record<string, string | number | boolean | undefined> = {
                        ...globalVars,
                        ...smsGlobalVars,
                      };
                      provider.setGlobalVariables(mergedVars as import('@nauth-toolkit/core').SMSTemplateVariables);
                    }
                  }

                  return provider;
                },
              },
              {
                provide: PhoneVerificationService,
                useFactory: (
                  verificationTokenRepo: Repository<BaseVerificationToken>,
                  userRepo: Repository<BaseUser>,
                  smsProvider: SMSProvider,
                  storageAdapter: StorageAdapter,
                  nauthConfig: NAuthConfig,
                  clientInfoService: ClientInfoService,
                  logger: NAuthLogger,
                  hookRegistry: HookRegistryService,
                  auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
                ) => {
                  return new PhoneVerificationService(
                    verificationTokenRepo,
                    userRepo,
                    smsProvider,
                    storageAdapter,
                    nauthConfig,
                    clientInfoService,
                    logger,
                    hookRegistry,
                    auditService,
                  );
                },
                inject: [
                  'VerificationTokenRepository',
                  'UserRepository',
                  'SMS_PROVIDER',
                  'STORAGE_ADAPTER',
                  'NAUTH_CONFIG',
                  ClientInfoService,
                  'NAUTH_LOGGER',
                  HookRegistryService,
                  { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
                ],
              },
            ]
          : []),

        {
          provide: PasswordResetService,
          useFactory: (
            verificationTokenRepo: Repository<BaseVerificationToken>,
            emailProvider: EmailProvider,
            storageAdapter: StorageAdapter,
            nauthConfig: NAuthConfig,
            clientInfoService: ClientInfoService,
            logger: NAuthLogger,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
            smsProvider?: SMSProvider, // Optional - only available when smsProvider is configured
          ) => {
            return new PasswordResetService(
              verificationTokenRepo,
              emailProvider,
              storageAdapter,
              nauthConfig,
              clientInfoService,
              logger,
              auditService,
              smsProvider,
            );
          },
          inject: [
            'VerificationTokenRepository',
            'EMAIL_PROVIDER',
            'STORAGE_ADAPTER',
            'NAUTH_CONFIG',
            ClientInfoService,
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
            { token: 'SMS_PROVIDER', optional: true }, // Optional - only available when smsProvider is configured
          ],
        },

        {
          provide: RateLimitStorageService,
          useFactory: (storageAdapter: StorageAdapter) => {
            return new RateLimitStorageService(storageAdapter);
          },
          inject: ['STORAGE_ADAPTER'],
        },
        {
          provide: AccountLockoutStorageService,
          useFactory: (storageAdapter: StorageAdapter) => {
            return new AccountLockoutStorageService(storageAdapter);
          },
          inject: ['STORAGE_ADAPTER'],
        },

        // API Key Service (only functional when apiKeys.enabled; repository may be null otherwise)
        ...(config.apiKeys?.enabled
          ? [
              {
                provide: ApiKeyService,
                useFactory: (
                  apiKeyRepository: Repository<BaseApiKey> | null,
                  userRepository: Repository<BaseUser>,
                  nauthConfig: NAuthConfig,
                  logger: NAuthLogger,
                  auditService?: InternalAuthAuditService,
                ) => {
                  if (!apiKeyRepository) {
                    throw new NAuthException(
                      AuthErrorCode.VALIDATION_FAILED,
                      'API keys are enabled but the ApiKey entity was not found in the DataSource. ' +
                        'Ensure getNAuthEntities() (which now includes ApiKey) is registered with TypeORM and the migration has run.',
                    );
                  }
                  return new ApiKeyService(apiKeyRepository, userRepository, nauthConfig, logger, auditService);
                },
                inject: [
                  'ApiKeyRepository',
                  'UserRepository',
                  'NAUTH_CONFIG',
                  'NAUTH_LOGGER',
                  { token: InternalAuthAuditService, optional: true },
                ],
              },
            ]
          : []),

        // Guards
        AuthGuard,
        ...(config.tokenDelivery?.method === 'cookies' || config.tokenDelivery?.method === 'hybrid' ? [CsrfGuard] : []),
      ],
      exports: [
        AuthService,
        AdminAuthService,
        ...(config.apiKeys?.enabled ? [ApiKeyService] : []),
        SocialAuthService, // Needed by social auth provider modules
        PasswordService,
        JwtService,
        SessionService,
        ChallengeService,
        AuthChallengeHelperService, // Needed by social auth providers
        SocialProviderRegistry, // Needed by social auth provider modules for auto-registration
        ClientInfoService,
        HookRegistryService, // Needed by NAuthHooksModule for hook registration
        // Audit Services (conditional - only if enabled)
        // Single instance, exported under two tokens:
        //   - AuthAuditService (public API) - For consumer apps to fetch audit logs (TypeScript prevents recordEvent)
        //   - InternalAuthAuditService - For INTERNAL toolkit packages ONLY (social auth, MFA providers)
        // Consumer apps should inject AuthAuditService, internal packages inject InternalAuthAuditService
        ...(config.auditLogs?.enabled !== false ? [AuthAuditService, InternalAuthAuditService] : []),
        AuthGuard,
        ...(config.tokenDelivery?.method === 'cookies' || config.tokenDelivery?.method === 'hybrid'
          ? [CsrfGuard, CsrfService]
          : []),
        RateLimitStorageService,
        AccountLockoutStorageService,
        ...(config.geoLocation?.maxMind ? [GeoLocationService] : []),
        'EMAIL_PROVIDER',
        EmailVerificationService,
        ...(config.smsProvider ? ['SMS_PROVIDER', PhoneVerificationService] : []),
        SocialAuthService, // Always export - providers register themselves when modules are imported
        MFAService, // Always export - MFA providers register themselves when modules are imported
        // Social redirect helper (framework-neutral handler consumers delegate to)
        SocialRedirectHandler,
        // TrustedDeviceService is provided but not exported (used internally by AuthService)
        'NAUTH_LOGGER',
        'NAUTH_CONFIG', // Export config so other modules can access it
        'SOCIAL_AUTH_STATE_STORE', // Needed by social auth providers for CSRF protection
        // Repository tokens exported for internal toolkit packages (MFA providers, etc.)
        // WARNING: These are for INTERNAL toolkit packages ONLY, not consumer apps
        // Consumer apps should use service methods (AuthService, MFAService, etc.) instead of direct repository access
        'UserRepository',
        'SocialAccountRepository', // Needed by social auth provider modules
        'MFADeviceRepository',
        // Needed by @nauth-toolkit/social-apple for Apple JWT client secret rotation
        'SocialProviderSecretRepository',
        // Note: TypeOrmModule not exported to prevent consumer apps from accessing entities directly

        // Note: MFA provider services (TOTPMFAProviderService, SMSMFAProviderService, PasskeyMFAProviderService)
        // are in @nauth-toolkit/mfa-* packages and auto-register with MFAService
        // These providers need repository access but are internal toolkit packages, not consumer apps
        // Note: PhoneVerificationService is provided from core when an SMS provider is configured
      ],
    };
  }

  /**
   * Validate configuration using Zod schema
   *
   * Validates all configuration sections and cross-dependencies:
   * - Email/phone verification requires respective providers
   * - MFA enforcement modes require specific configurations
   * - Social providers require credentials when enabled
   * - JWT algorithm requires appropriate keys
   * - MaxMind geolocation requires credentials for downloads
   *
   * @param config - Configuration to validate
   * @throws {NAuthException} If validation fails with detailed error messages
   */
  private static validateConfig(config: NAuthModuleConfig): void {
    const result = authConfigSchema.safeParse(config);

    if (!result.success) {
      // Format Zod errors into readable messages
      const errors = result.error.issues
        .map((err) => {
          const path = err.path.length > 0 ? err.path.join('.') : 'root';
          return `  - ${path}: ${err.message}`;
        })
        .join('\n');

      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Configuration validation failed:\n\n${errors}\n\n` +
          'Please check your auth configuration and ensure all required fields are provided.',
      );
    }

    // Configuration is valid - no need to return anything
    // TypeScript types ensure type safety at compile time
    // Zod ensures runtime validation for JavaScript/Express apps
  }
}
