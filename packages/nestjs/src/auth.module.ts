import { Module, DynamicModule, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD, Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityMetadata, Repository } from 'typeorm';
// Public API imports
import {
  BaseUser,
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
  EmailProvider,
  SMSProvider,
  NAuthException,
  AuthErrorCode,
  StorageAdapter,
  authConfigSchema,
  AuthService,
  EmailVerificationService,
  PhoneVerificationService,
  SocialAuthService,
  MFAService,
  ClientInfoService,
  RateLimitStorageService,
  AccountLockoutStorageService,
  NAuthLogger,
  AuthAuditService, // Public type for DI token
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
  AuthAuditService as InternalAuthAuditService, // Internal version with recordEvent() for instantiation
} from '@nauth-toolkit/core/internal';

import { NAuthMigrationsBootstrapService } from './services/migrations-bootstrap.service';

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
import { ClientInfoInterceptor } from './interceptors/client-info.interceptor';
import { CookieTokenInterceptor } from './interceptors/cookie-token.interceptor';
import { AuthGuard } from './guards/auth.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CsrfService } from './services/csrf.service';

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
   * // ✅ PREFERRED - Auto-discovery (entities in TypeORM.forRoot())
   * TypeOrmModule.forRoot({ entities: getNAuthEntities(), ... })
   * AuthModule.forRoot({ jwt: {...} }) // entities not needed
   *
   * // ✅ ALSO VALID - Explicit entities (if not using TypeORM.forRoot())
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
        // Global interceptor for automatic client info extraction
        {
          provide: APP_INTERCEPTOR,
          useClass: ClientInfoInterceptor,
        },
        // Global interceptor for cookie token delivery (no-op in JSON mode)
        {
          provide: APP_INTERCEPTOR,
          useFactory: (
            config: NAuthConfig,
            jwtService: JwtService,
            reflector: Reflector,
            csrfService?: CsrfService, // Optional - only available when CSRF is enabled
          ) => {
            return new CookieTokenInterceptor(config, jwtService, reflector, csrfService);
          },
          inject: [
            'NAUTH_CONFIG',
            JwtService,
            Reflector,
            { token: CsrfService, optional: true }, // Optional - only available when CSRF is enabled
          ],
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

        // Run database migrations automatically during NestJS bootstrap
        // Keeps consumer apps migration-free while ensuring schema compatibility.
        NAuthMigrationsBootstrapService,

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
                '  import { getNAuthStorageEntities } from "@nauth-toolkit/database-typeorm-postgres";\n' +
                '  entities: [...getNAuthEntities(), ...getNAuthStorageEntities()]',
            );
          },
          inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER', 'RateLimitRepository', 'StorageLockRepository'],
        },

        // Rate Limit Repository (optional - only needed for DatabaseStorageAdapter)
        {
          provide: 'RateLimitRepository',
          useFactory: (dataSource: DataSource) => {
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
          inject: [DataSource],
        },

        // Storage Lock Repository (optional - only needed for DatabaseStorageAdapter)
        {
          provide: 'StorageLockRepository',
          useFactory: (dataSource: DataSource) => {
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
          inject: [DataSource],
        },

        // Repository Tokens - discover entities from DataSource metadata
        // This allows entities to be auto-discovered if registered in TypeORM.forRoot()
        {
          provide: 'UserRepository',
          useFactory: (dataSource: DataSource) => {
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
          inject: [DataSource],
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
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
          ) => {
            return new ChallengeService(challengeSessionRepository, clientInfoService, logger, auditService);
          },
          inject: [
            'ChallengeSessionRepository',
            ClientInfoService,
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
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
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
            phoneVerificationService?: PhoneVerificationService,
            mfaService?: MFAService,
            mfaDeviceRepository?: Repository<BaseMFADevice>,
            trustedDeviceService?: TrustedDeviceService,
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
              auditService,
              phoneVerificationService,
              mfaService,
              mfaDeviceRepository,
              trustedDeviceService,
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
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
            { token: PhoneVerificationService, optional: true },
            { token: MFAService, optional: true }, // No circular dependency - MFAService no longer depends on AuthService
            { token: 'MFADeviceRepository', optional: true },
            { token: TrustedDeviceService, optional: true },
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

        // Social Auth State Store - shared Map for CSRF state validation across all providers
        {
          provide: 'SOCIAL_AUTH_STATE_STORE',
          useValue: new Map<string, { timestamp: number; provider: string }>(),
        },

        // Social Provider Registry - internal registry for social providers
        // Provider modules (GoogleSocialAuthModule, AppleSocialAuthModule, etc.)
        // will automatically register themselves with this registry via OnModuleInit
        SocialProviderRegistry,

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
          ) => {
            return new MFAService(
              mfaDeviceRepository,
              userRepository,
              challengeService,
              nauthConfig,
              logger,
              auditService,
              clientInfoService,
            );
          },
          inject: [
            'MFADeviceRepository',
            'UserRepository',
            { token: ChallengeService, optional: true },
            { token: 'NAUTH_CONFIG', optional: true },
            { token: 'NAUTH_LOGGER', optional: true },
            { token: AuthAuditService, optional: true },
            { token: ClientInfoService, optional: true },
          ],
        },
        {
          provide: SocialAuthService,
          useFactory: (
            providerRegistry: SocialProviderRegistry,
            userRepository: Repository<BaseUser>,
            socialAccountRepository: Repository<BaseSocialAccount>,
            authService: AuthService,
            logger: NAuthLogger,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
          ) => {
            return new SocialAuthService(
              providerRegistry,
              userRepository,
              socialAccountRepository,
              authService,
              logger,
              auditService,
            );
          },
          inject: [
            SocialProviderRegistry,
            'UserRepository',
            'SocialAccountRepository',
            AuthService,
            'NAUTH_LOGGER',
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
          ],
        },
        ClientInfoService,
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
          ) => {
            return new AdaptiveMFADecisionService(
              riskDetectionService,
              riskScoringService,
              storageAdapter,
              clientInfoService,
              config,
              logger,
              auditService,
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
          useFactory: () => {
            if (!config.emailProvider) {
              throw new NAuthException(
                AuthErrorCode.VALIDATION_FAILED,
                'emailProvider is required. Install and configure an email package:\n' +
                  '  yarn add @nauth-toolkit/email-console (for dev)\n' +
                  '  yarn add @nauth-toolkit/email-nodemailer (for production)',
              );
            }
            const provider = config.emailProvider;
            // Inject logger into provider if it has setLogger method
            if (provider && typeof provider.setLogger === 'function') {
              provider.setLogger(nauthLogger);
            }
            // Inject global variables from email config if provider supports it
            if (provider && typeof provider.setGlobalVariables === 'function' && config.email) {
              const globalVars: Record<string, unknown> = {};
              // Extract top-level branding fields
              if (config.email.appName) globalVars.appName = config.email.appName;
              if (config.email.companyName) globalVars.companyName = config.email.companyName;
              if (config.email.logoUrl) globalVars.logoUrl = config.email.logoUrl;
              if (config.email.supportEmail) globalVars.supportEmail = config.email.supportEmail;
              if (config.email.dashboardUrl) globalVars.dashboardUrl = config.email.dashboardUrl;
              if (config.email.brandColor) globalVars.brandColor = config.email.brandColor;
              if (config.email.footerDisclaimer) globalVars.footerDisclaimer = config.email.footerDisclaimer;
              // Merge with templates.globalVariables (templates.globalVariables takes precedence)
              const mergedVars = {
                ...globalVars,
                ...(config.email.templates?.globalVariables || {}),
              };
              provider.setGlobalVariables(mergedVars);
            }
            return provider;
          },
        },
        {
          provide: EmailVerificationService,
          useFactory: (
            verificationTokenRepo: Repository<BaseVerificationToken>,
            userRepo: Repository<BaseUser>,
            emailProvider: unknown,
            storageAdapter: StorageAdapter,
            nauthConfig: NAuthConfig,
            clientInfoService: ClientInfoService,
            logger: NAuthLogger,
            auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
          ) => {
            return new EmailVerificationService(
              verificationTokenRepo,
              userRepo,
              emailProvider as EmailProvider,
              storageAdapter,
              nauthConfig,
              clientInfoService,
              logger,
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
            { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
          ],
        },

        // SMS Provider (optional - only needed if using phone verification)
        ...(config.smsProvider
          ? [
              {
                provide: 'SMS_PROVIDER',
                useFactory: () => {
                  const provider = config.smsProvider!;
                  if (provider && typeof provider.setLogger === 'function') {
                    provider.setLogger(nauthLogger);
                  }
                  return provider;
                },
              },
              {
                provide: PhoneVerificationService,
                useFactory: (
                  verificationTokenRepo: Repository<BaseVerificationToken>,
                  userRepo: Repository<BaseUser>,
                  smsProvider: unknown,
                  storageAdapter: StorageAdapter,
                  nauthConfig: NAuthConfig,
                  clientInfoService: ClientInfoService,
                  logger: NAuthLogger,
                  auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
                ) => {
                  return new PhoneVerificationService(
                    verificationTokenRepo,
                    userRepo,
                    smsProvider as SMSProvider,
                    storageAdapter,
                    nauthConfig,
                    clientInfoService,
                    logger,
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
                  { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
                  'NAUTH_LOGGER',
                ],
              },
            ]
          : []),

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

        // Guards
        AuthGuard,
        ...(config.tokenDelivery?.method === 'cookies' || config.tokenDelivery?.method === 'hybrid' ? [CsrfGuard] : []),
      ],
      exports: [
        AuthService,
        PasswordService,
        JwtService,
        SessionService,
        ChallengeService,
        AuthChallengeHelperService, // Needed by social auth providers
        SocialProviderRegistry, // Needed by social auth provider modules for auto-registration
        ClientInfoService,
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
        // TrustedDeviceService is provided but not exported (used internally by AuthService)
        'NAUTH_LOGGER',
        'NAUTH_CONFIG', // Export config so other modules can access it
        'SOCIAL_AUTH_STATE_STORE', // Needed by social auth providers for CSRF protection
        // Repository tokens exported for internal toolkit packages (MFA providers, etc.)
        // ⚠️ WARNING: These are for INTERNAL toolkit packages ONLY, not consumer apps
        // Consumer apps should use service methods (AuthService, MFAService, etc.) instead of direct repository access
        'UserRepository',
        'MFADeviceRepository',
        // Note: TypeOrmModule not exported to prevent consumer apps from accessing entities directly

        // Note: MFA provider services (TOTPMFAProviderService, SMSMFAProviderService, PasskeyMFAProviderService)
        // are in @nauth-toolkit/mfa-* packages and auto-register with MFAService
        // These providers need repository access but are internal toolkit packages, not consumer apps
        // Note: PhoneVerificationService is provided from core when an SMS provider is configured
      ],
    };
  }

  /**
   * Configure module with async configuration
   * @deprecated in v2.0 - Use forRoot() instead. Async config not needed in modular architecture.
   */
  static forRootAsync(_options: {
    useFactory: (...args: unknown[]) => Promise<NAuthModuleConfig> | NAuthModuleConfig;
    inject?: unknown[];
  }): DynamicModule {
    throw new NAuthException(
      AuthErrorCode.INTERNAL_ERROR,
      'forRootAsync() is deprecated in v2.0. Use forRoot() instead.\n' +
        'The modular architecture requires entities to be provided synchronously.',
    );
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
      const errors = result.error.errors
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
