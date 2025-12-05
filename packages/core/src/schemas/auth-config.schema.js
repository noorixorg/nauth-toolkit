"use strict";
/**
 * Zod Schema Validation for NAuth Configuration
 *
 * Provides runtime validation for auth configuration with comprehensive
 * cross-dependency checks. Ensures configuration is valid before module initialization.
 *
 * This schema validates:
 * - Required fields
 * - Type correctness
 * - Cross-dependencies (e.g., email config requires emailProvider)
 * - Algorithm-specific requirements (JWT symmetric vs asymmetric)
 * - MFA enforcement modes and their requirements
 * - Social provider requirements
 * - GeoLocation MaxMind credentials
 *
 * @example
 * ```typescript
 * import { authConfigSchema } from '@nauth-toolkit/core';
 *
 * const result = authConfigSchema.safeParse(config);
 * if (!result.success) {
 *   console.error('Config validation failed:', result.error.errors);
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authConfigSchema = exports.geoLocationConfigSchema = exports.tokenDeliveryConfigSchema = exports.mfaConfigSchema = exports.adaptiveMFAConfigSchema = exports.riskLevelConfigSchema = exports.backupCodesConfigSchema = exports.passkeyConfigSchema = exports.totpConfigSchema = exports.socialConfigSchema = exports.socialProviderConfigSchema = exports.phoneConfigSchema = exports.emailConfigSchema = exports.lifecycleHooksSchema = exports.securityConfigSchema = exports.sessionConfigSchema = exports.lockoutConfigSchema = exports.passwordConfigSchema = exports.loginConfigSchema = exports.signupConfigSchema = exports.jwtConfigSchema = void 0;
var zod_1 = require("zod");
// ============================================================================
// JWT Configuration Schemas
// ============================================================================
/**
 * Access token configuration schema
 */
var accessTokenConfigSchema = zod_1.z.object({
    secret: zod_1.z.string().optional(),
    privateKey: zod_1.z.string().optional(),
    publicKey: zod_1.z.string().optional(),
    expiresIn: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
});
/**
 * Refresh token configuration schema
 */
var refreshTokenConfigSchema = zod_1.z.object({
    secret: zod_1.z.string().min(32, 'Refresh token secret must be at least 32 characters (256 bits) for security'),
    expiresIn: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    rotation: zod_1.z.boolean().optional(),
    reuseDetection: zod_1.z.boolean().optional(),
});
/**
 * JWT configuration schema
 */
exports.jwtConfigSchema = zod_1.z
    .object({
    algorithm: zod_1.z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).optional(),
    accessToken: accessTokenConfigSchema,
    refreshToken: refreshTokenConfigSchema,
    issuer: zod_1.z.string().optional(),
    audience: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
})
    .superRefine(function (data, ctx) {
    var algorithm = data.algorithm || 'HS256';
    var symmetricAlgorithms = ['HS256', 'HS384', 'HS512'];
    var asymmetricAlgorithms = ['RS256', 'RS384', 'RS512'];
    if (symmetricAlgorithms.includes(algorithm)) {
        if (!data.accessToken.secret) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "jwt.accessToken.secret is required for symmetric algorithm ".concat(algorithm),
                path: ['accessToken', 'secret'],
            });
        }
        else if (data.accessToken.secret.length < 32) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'JWT access token secret must be at least 32 characters (256 bits) for security',
                path: ['accessToken', 'secret'],
            });
        }
    }
    else if (asymmetricAlgorithms.includes(algorithm)) {
        if (!data.accessToken.privateKey) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "jwt.accessToken.privateKey is required for asymmetric algorithm ".concat(algorithm),
                path: ['accessToken', 'privateKey'],
            });
        }
        if (!data.accessToken.publicKey) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "jwt.accessToken.publicKey is required for asymmetric algorithm ".concat(algorithm),
                path: ['accessToken', 'publicKey'],
            });
        }
    }
});
// ============================================================================
// Signup Configuration Schema
// ============================================================================
exports.signupConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    verificationMethod: zod_1.z.enum(['none', 'email', 'phone', 'both']).optional(),
    allowDuplicatePhones: zod_1.z.boolean().optional(),
    emailVerification: zod_1.z
        .object({
        expiresIn: zod_1.z.number().optional(),
        resendDelay: zod_1.z.number().optional(),
        rateLimitMax: zod_1.z.number().optional(),
        rateLimitWindow: zod_1.z.number().optional(),
        maxAttemptsPerUser: zod_1.z.number().optional(),
        maxAttemptsPerIP: zod_1.z.number().optional(),
        attemptWindow: zod_1.z.number().optional(),
    })
        .optional(),
    phoneVerification: zod_1.z
        .object({
        codeLength: zod_1.z.number().optional(),
        expiresIn: zod_1.z.number().optional(),
        maxAttempts: zod_1.z.number().optional(),
        resendDelay: zod_1.z.number().optional(),
        rateLimitMax: zod_1.z.number().optional(),
        rateLimitWindow: zod_1.z.number().optional(),
        maxAttemptsPerUser: zod_1.z.number().optional(),
        maxAttemptsPerIP: zod_1.z.number().optional(),
        attemptWindow: zod_1.z.number().optional(),
    })
        .optional(),
});
// ============================================================================
// Login Configuration Schema
// ============================================================================
exports.loginConfigSchema = zod_1.z.object({
    identifierType: zod_1.z.enum(['email', 'username', 'phone', 'email_or_username']).optional(),
});
// ============================================================================
// Password Configuration Schema
// ============================================================================
exports.passwordConfigSchema = zod_1.z.object({
    minLength: zod_1.z.number().optional(),
    maxLength: zod_1.z.number().optional(),
    requireUppercase: zod_1.z.boolean().optional(),
    requireLowercase: zod_1.z.boolean().optional(),
    requireNumbers: zod_1.z.boolean().optional(),
    requireSpecialChars: zod_1.z.boolean().optional(),
    specialChars: zod_1.z.string().optional(),
    preventCommon: zod_1.z.boolean().optional(),
    preventUserInfo: zod_1.z.boolean().optional(),
    historyCount: zod_1.z.number().optional(),
    expiryDays: zod_1.z.number().optional(),
});
// ============================================================================
// Lockout Configuration Schema
// ============================================================================
exports.lockoutConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    maxAttempts: zod_1.z.number().optional(),
    duration: zod_1.z.number().optional(),
    resetOnSuccess: zod_1.z.boolean().optional(),
});
// ============================================================================
// Session Configuration Schema
// ============================================================================
exports.sessionConfigSchema = zod_1.z.object({
    maxConcurrent: zod_1.z.number().optional(),
    disallowMultipleSessions: zod_1.z.boolean().optional(),
    maxLifetime: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
});
// ============================================================================
// Security Configuration Schema
// ============================================================================
exports.securityConfigSchema = zod_1.z.object({
    csrf: zod_1.z
        .object({
        cookieName: zod_1.z.string().optional(),
        headerName: zod_1.z.string().optional(),
        tokenLength: zod_1.z.number().optional(),
        excludedPaths: zod_1.z.array(zod_1.z.string()).optional(),
        cookieOptions: zod_1.z
            .object({
            // httpOnly is always false (hardcoded) - CSRF token must be readable by JavaScript
            secure: zod_1.z.boolean().optional(),
            sameSite: zod_1.z.enum(['strict', 'lax', 'none']).optional(),
            domain: zod_1.z.string().optional(),
            path: zod_1.z.string().optional(),
        })
            .optional(),
    })
        .optional(),
});
// ============================================================================
// Lifecycle Hooks Schema
// ============================================================================
// Note: Functions cannot be validated by Zod, so we use z.any() for hooks
exports.lifecycleHooksSchema = zod_1.z.object({
    beforeSignup: zod_1.z.any().optional(),
    afterSignup: zod_1.z.any().optional(),
    beforeLogin: zod_1.z.any().optional(),
    afterLogin: zod_1.z.any().optional(),
    afterLoginFailed: zod_1.z.any().optional(),
    beforePasswordChange: zod_1.z.any().optional(),
    afterPasswordChange: zod_1.z.any().optional(),
    beforeAccountLock: zod_1.z.any().optional(),
    afterAccountLock: zod_1.z.any().optional(),
    onAdaptiveMFATriggered: zod_1.z.any().optional(),
    onSignInBlocked: zod_1.z.any().optional(),
});
// ============================================================================
// Email Configuration Schema
// ============================================================================
/**
 * Custom template definition schema
 *
 * Validates template definition structure:
 * - Must have either htmlPath OR html content (not both)
 * - Can have either textPath OR text content (not both)
 * - Subject is optional (can be extracted from frontmatter)
 */
var customTemplateDefinitionSchema = zod_1.z
    .object({
    htmlPath: zod_1.z.string().optional(),
    html: zod_1.z.string().optional(),
    textPath: zod_1.z.string().optional(),
    text: zod_1.z.string().optional(),
    subject: zod_1.z.string().optional(),
})
    .refine(function (data) { return !!(data.htmlPath || data.html); }, {
    message: 'Must provide either "htmlPath" or "html" content',
})
    .refine(function (data) { return !(data.htmlPath && data.html); }, {
    message: 'Cannot provide both "htmlPath" and "html". Use one or the other.',
})
    .refine(function (data) { return !(data.textPath && data.text); }, {
    message: 'Cannot provide both "textPath" and "text". Use one or the other.',
});
/**
 * Template configuration schema
 *
 * Validates template configuration:
 * - Global variables for branding
 * - Custom templates with required parameters
 */
var templateConfigSchema = zod_1.z.object({
    engine: zod_1.z.any().optional(), // TemplateEngine instance - runtime validation
    globalVariables: zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()])).optional(),
    customTemplates: zod_1.z.record(customTemplateDefinitionSchema).optional(),
});
/**
 * Email configuration schema
 */
exports.emailConfigSchema = zod_1.z.object({
    appName: zod_1.z.string().optional(),
    companyName: zod_1.z.string().optional(),
    logoUrl: zod_1.z.string().optional(),
    supportEmail: zod_1.z.string().email().optional(),
    dashboardUrl: zod_1.z.string().url().optional(),
    brandColor: zod_1.z.string().optional(),
    footerDisclaimer: zod_1.z.string().optional(),
    templates: templateConfigSchema.optional(),
});
// ============================================================================
// Phone Configuration Schema
// ============================================================================
exports.phoneConfigSchema = zod_1.z.object({
// verification section removed - moved to signup.phoneVerification
// Kept empty for backwards compatibility
});
// ============================================================================
// Social Provider Configuration Schema
// ============================================================================
exports.socialProviderConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    clientId: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    clientSecret: zod_1.z.string().optional(),
    callbackUrl: zod_1.z.string().optional(),
    scopes: zod_1.z.array(zod_1.z.string()).optional(),
    autoLink: zod_1.z.boolean().optional(),
    allowSignup: zod_1.z.boolean().optional(),
});
exports.socialConfigSchema = zod_1.z.object({
    google: exports.socialProviderConfigSchema.optional(),
    apple: exports.socialProviderConfigSchema.optional(),
    facebook: exports.socialProviderConfigSchema.optional(),
});
// ============================================================================
// MFA Configuration Schemas
// ============================================================================
exports.totpConfigSchema = zod_1.z.object({
    window: zod_1.z.number().optional(),
    stepSeconds: zod_1.z.number().optional(),
    digits: zod_1.z.number().optional(),
    algorithm: zod_1.z.enum(['sha1', 'sha256', 'sha512']).optional(),
});
exports.passkeyConfigSchema = zod_1.z.object({
    rpName: zod_1.z.string(),
    rpId: zod_1.z.string(),
    origin: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    timeout: zod_1.z.number().optional(),
    userVerification: zod_1.z.enum(['required', 'preferred', 'discouraged']).optional(),
    authenticatorAttachment: zod_1.z.enum(['platform', 'cross-platform']).optional(),
});
exports.backupCodesConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    codeCount: zod_1.z.number().optional(),
    codeLength: zod_1.z.number().optional(),
});
exports.riskLevelConfigSchema = zod_1.z.object({
    maxScore: zod_1.z.number(),
    action: zod_1.z.enum(['allow', 'require_mfa', 'block_signin']).optional(),
    notifyUser: zod_1.z.boolean().optional(),
});
exports.adaptiveMFAConfigSchema = zod_1.z.object({
    triggers: zod_1.z
        .array(zod_1.z.enum(['new_device', 'new_ip', 'new_country', 'impossible_travel', 'suspicious_activity']))
        .optional(),
    riskThreshold: zod_1.z.number().optional(), // Deprecated
    riskWeights: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    riskLevels: zod_1.z
        .object({
        low: exports.riskLevelConfigSchema.optional(),
        medium: exports.riskLevelConfigSchema.optional(),
        high: exports.riskLevelConfigSchema.optional(),
    })
        .optional(),
    blockedSignIn: zod_1.z
        .object({
        blockDuration: zod_1.z.number().optional(),
        message: zod_1.z.string().optional(),
        errorCode: zod_1.z.string().optional(),
    })
        .optional(),
    maxTravelSpeed: zod_1.z.number().optional(),
    suspiciousActivityWindow: zod_1.z.number().optional(),
});
exports.mfaConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    enforcement: zod_1.z.enum(['OPTIONAL', 'REQUIRED', 'ADAPTIVE']).optional(),
    gracePeriod: zod_1.z.number().optional(),
    allowedMethods: zod_1.z.array(zod_1.z.enum(['totp', 'sms', 'email', 'passkey'])).optional(),
    requireForSocialLogin: zod_1.z.boolean().optional(),
    rememberDevices: zod_1.z.enum(['always', 'user_opt_in', 'never']).optional(),
    rememberDeviceDays: zod_1.z.number().optional(),
    bypassMFAForTrustedDevices: zod_1.z.boolean().optional(),
    issuer: zod_1.z.string().optional(),
    totp: exports.totpConfigSchema.optional(),
    passkey: exports.passkeyConfigSchema.optional(),
    backup: exports.backupCodesConfigSchema.optional(),
    adaptive: exports.adaptiveMFAConfigSchema.optional(),
});
// ============================================================================
// Token Delivery Configuration Schema
// ============================================================================
exports.tokenDeliveryConfigSchema = zod_1.z.object({
    method: zod_1.z.enum(['json', 'cookies', 'hybrid']).optional(),
    cookieNamePrefix: zod_1.z.string().optional(), // Prefix for all cookie names (default: 'nauth_')
    cookieOptions: zod_1.z
        .object({
        secure: zod_1.z.boolean().optional(),
        sameSite: zod_1.z.enum(['strict', 'lax', 'none']).optional(),
        path: zod_1.z.string().optional(),
        domain: zod_1.z.string().optional(),
    })
        .optional(),
    hybridPolicy: zod_1.z
        .object({
        webOrigins: zod_1.z.array(zod_1.z.string()).optional(),
        nativeOrigins: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .optional(),
});
// ============================================================================
// GeoLocation Configuration Schema
// ============================================================================
exports.geoLocationConfigSchema = zod_1.z.object({
    maxMind: zod_1.z
        .object({
        dbPath: zod_1.z.string().optional(),
        skipDownloads: zod_1.z.boolean().optional(),
        licenseKey: zod_1.z.string().optional(),
        accountId: zod_1.z.number().optional(),
        autoDownloadOnStartup: zod_1.z.boolean().optional(),
        editions: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .optional(),
});
// ============================================================================
// Root Configuration Schema with Cross-Dependency Validation
// ============================================================================
/**
 * Root authentication configuration schema
 *
 * Validates all configuration sections and enforces cross-dependencies:
 * - Email/phone verification requires respective providers
 * - MFA enforcement modes require specific configurations
 * - Social providers require credentials when enabled
 * - JWT algorithm requires appropriate keys
 * - MaxMind geolocation requires credentials for downloads
 */
exports.authConfigSchema = zod_1.z
    .object({
    tablePrefix: zod_1.z.string().optional(),
    jwt: exports.jwtConfigSchema,
    signup: exports.signupConfigSchema.optional(),
    login: exports.loginConfigSchema.optional(),
    password: exports.passwordConfigSchema.optional(),
    lockout: exports.lockoutConfigSchema.optional(),
    session: exports.sessionConfigSchema.optional(),
    security: exports.securityConfigSchema.optional(),
    hooks: exports.lifecycleHooksSchema.optional(),
    auditLogs: zod_1.z
        .object({
        enabled: zod_1.z.boolean().optional(),
        fireAndForget: zod_1.z.boolean().optional(),
    })
        .optional(),
    emailProvider: zod_1.z.any().optional(), // Runtime instance - cannot validate type
    email: exports.emailConfigSchema.optional(),
    smsProvider: zod_1.z.any().optional(), // Runtime instance - cannot validate type
    phone: exports.phoneConfigSchema.optional(),
    storageAdapter: zod_1.z.any().optional(), // Runtime instance - cannot validate type
    social: exports.socialConfigSchema.optional(),
    mfa: exports.mfaConfigSchema.optional(),
    logger: zod_1.z.any().optional(), // LoggerService or NAuthLoggerConfig - runtime instance
    tokenDelivery: exports.tokenDeliveryConfigSchema.optional(),
    geoLocation: exports.geoLocationConfigSchema.optional(),
})
    .superRefine(function (data, ctx) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    // ============================================================================
    // 1. Email Verification Dependencies
    // ============================================================================
    var verificationMethod = ((_a = data.signup) === null || _a === void 0 ? void 0 : _a.verificationMethod) || 'email';
    if ((verificationMethod === 'email' || verificationMethod === 'both') && !data.emailProvider) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'emailProvider is required when email verification is enabled',
            path: ['emailProvider'],
        });
    }
    // ============================================================================
    // 2. Phone Verification Dependencies
    // ============================================================================
    if ((verificationMethod === 'phone' || verificationMethod === 'both') && !data.smsProvider) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'smsProvider is required when phone verification is enabled',
            path: ['smsProvider'],
        });
    }
    // ============================================================================
    // 3. Email Config Requires Provider
    // ============================================================================
    if (data.email && !data.emailProvider) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'emailProvider is required when email configuration is provided',
            path: ['emailProvider'],
        });
    }
    // ============================================================================
    // 4. Phone Config Requires Provider
    // ============================================================================
    if (data.phone && !data.smsProvider) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'smsProvider is required when phone configuration is provided',
            path: ['smsProvider'],
        });
    }
    // ============================================================================
    // 5. MFA ADAPTIVE Enforcement Validation
    // ============================================================================
    if (((_b = data.mfa) === null || _b === void 0 ? void 0 : _b.enforcement) === 'ADAPTIVE') {
        if (!data.mfa.enabled) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'mfa.enabled must be true when enforcement is ADAPTIVE',
                path: ['mfa', 'enabled'],
            });
        }
        if (!data.mfa.adaptive) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'mfa.adaptive configuration is required when enforcement is ADAPTIVE',
                path: ['mfa', 'adaptive'],
            });
        }
    }
    // ============================================================================
    // 6. MFA REQUIRED Enforcement Validation
    // ============================================================================
    if (((_c = data.mfa) === null || _c === void 0 ? void 0 : _c.enforcement) === 'REQUIRED' && data.mfa.gracePeriod === undefined) {
        // Grace period is optional but recommended - just warn, don't fail
        // This is handled at runtime level, not validation level
    }
    // ============================================================================
    // 7. MFA SMS Method Requires SMS Provider
    // ============================================================================
    if (((_e = (_d = data.mfa) === null || _d === void 0 ? void 0 : _d.allowedMethods) === null || _e === void 0 ? void 0 : _e.includes('sms')) && !data.smsProvider) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'smsProvider is required when MFA SMS method is enabled',
            path: ['smsProvider'],
        });
    }
    // ============================================================================
    // 8. MFA Email Method Requires Email Provider
    // ============================================================================
    if (((_g = (_f = data.mfa) === null || _f === void 0 ? void 0 : _f.allowedMethods) === null || _g === void 0 ? void 0 : _g.includes('email')) && !data.emailProvider) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'emailProvider is required when MFA Email method is enabled',
            path: ['emailProvider'],
        });
    }
    // ============================================================================
    // 9. MFA Passkey Requires Passkey Config
    // ============================================================================
    if (((_j = (_h = data.mfa) === null || _h === void 0 ? void 0 : _h.allowedMethods) === null || _j === void 0 ? void 0 : _j.includes('passkey')) && !data.mfa.passkey) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'mfa.passkey configuration is required when passkey method is enabled',
            path: ['mfa', 'passkey'],
        });
    }
    // ============================================================================
    // 10. MFA Remember Devices Validation
    // ============================================================================
    if (((_k = data.mfa) === null || _k === void 0 ? void 0 : _k.rememberDevices) &&
        data.mfa.rememberDevices !== 'never' &&
        data.mfa.rememberDeviceDays === undefined) {
        // Remember device days has default - this is informational only
        // Validation passes, but we could add a warning if needed
    }
    // ============================================================================
    // 11. Social Provider Validation
    // ============================================================================
    ['google', 'apple', 'facebook'].forEach(function (provider) {
        var _a;
        var providerConfig = (_a = data.social) === null || _a === void 0 ? void 0 : _a[provider];
        if (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.enabled) {
            if (!providerConfig.clientId) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "clientId is required when ".concat(provider, " provider is enabled"),
                    path: ['social', provider, 'clientId'],
                });
            }
            if (!providerConfig.clientSecret) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "clientSecret is required when ".concat(provider, " provider is enabled"),
                    path: ['social', provider, 'clientSecret'],
                });
            }
        }
    });
    // ============================================================================
    // 12. MaxMind GeoLocation Validation
    // ============================================================================
    if ((_l = data.geoLocation) === null || _l === void 0 ? void 0 : _l.maxMind) {
        var maxMind = data.geoLocation.maxMind;
        if (!maxMind.skipDownloads && maxMind.autoDownloadOnStartup) {
            if (!maxMind.licenseKey || !maxMind.accountId) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'MaxMind licenseKey and accountId are required when autoDownloadOnStartup is enabled',
                    path: ['geoLocation', 'maxMind', 'licenseKey'],
                });
            }
        }
    }
    // ============================================================================
    // 13. Token Delivery Hybrid Policy Validation
    // ============================================================================
    if (((_m = data.tokenDelivery) === null || _m === void 0 ? void 0 : _m.method) === 'hybrid' && !data.tokenDelivery.hybridPolicy) {
        // Hybrid policy is optional but recommended - validation passes
        // Runtime will handle defaults
    }
});
