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

import { z } from 'zod';

// ============================================================================
// JWT Configuration Schemas
// ============================================================================

/**
 * Access token configuration schema
 */
const accessTokenConfigSchema = z.object({
  secret: z.string().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
  expiresIn: z.union([z.string(), z.number()]),
});

/**
 * Refresh token configuration schema
 */
const refreshTokenConfigSchema = z.object({
  secret: z.string().min(32, 'Refresh token secret must be at least 32 characters (256 bits) for security'),
  expiresIn: z.union([z.string(), z.number()]),
  rotation: z.boolean().optional(),
  reuseDetection: z.boolean().optional(),
});

/**
 * JWT configuration schema
 */
export const jwtConfigSchema = z
  .object({
    algorithm: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).optional(),
    accessToken: accessTokenConfigSchema,
    refreshToken: refreshTokenConfigSchema,
    issuer: z.string().optional(),
    audience: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .superRefine((data, ctx) => {
    const algorithm = data.algorithm || 'HS256';
    const symmetricAlgorithms = ['HS256', 'HS384', 'HS512'];
    const asymmetricAlgorithms = ['RS256', 'RS384', 'RS512'];

    if (symmetricAlgorithms.includes(algorithm)) {
      if (!data.accessToken.secret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `jwt.accessToken.secret is required for symmetric algorithm ${algorithm}`,
          path: ['accessToken', 'secret'],
        });
      } else if (data.accessToken.secret.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT access token secret must be at least 32 characters (256 bits) for security',
          path: ['accessToken', 'secret'],
        });
      }
    } else if (asymmetricAlgorithms.includes(algorithm)) {
      if (!data.accessToken.privateKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `jwt.accessToken.privateKey is required for asymmetric algorithm ${algorithm}`,
          path: ['accessToken', 'privateKey'],
        });
      }
      if (!data.accessToken.publicKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `jwt.accessToken.publicKey is required for asymmetric algorithm ${algorithm}`,
          path: ['accessToken', 'publicKey'],
        });
      }
    }
  });

// ============================================================================
// Signup Configuration Schema
// ============================================================================

export const signupConfigSchema = z.object({
  enabled: z.boolean().optional(),
  verificationMethod: z.enum(['none', 'email', 'phone', 'both']).optional(),
  allowDuplicatePhones: z.boolean().optional(),
  emailVerification: z
    .object({
      expiresIn: z.number().optional(),
      maxAttempts: z.number().optional(),
      resendDelay: z.number().optional(),
      rateLimitMax: z.number().optional(),
      rateLimitWindow: z.number().optional(),
      maxAttemptsPerUser: z.number().optional(),
      maxAttemptsPerIP: z.number().optional(),
      attemptWindow: z.number().optional(),
    })
    .optional(),
  phoneVerification: z
    .object({
      codeLength: z.number().optional(),
      expiresIn: z.number().optional(),
      maxAttempts: z.number().optional(),
      resendDelay: z.number().optional(),
      rateLimitMax: z.number().optional(),
      rateLimitWindow: z.number().optional(),
      maxAttemptsPerUser: z.number().optional(),
      maxAttemptsPerIP: z.number().optional(),
      attemptWindow: z.number().optional(),
    })
    .optional(),
});

// ============================================================================
// Login Configuration Schema
// ============================================================================

export const loginConfigSchema = z.object({
  identifierType: z.enum(['email', 'username', 'phone', 'email_or_username']).optional(),
});

// ============================================================================
// Password Configuration Schema
// ============================================================================

export const passwordConfigSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumbers: z.boolean().optional(),
  requireSpecialChars: z.boolean().optional(),
  specialChars: z.string().optional(),
  preventCommon: z.boolean().optional(),
  preventUserInfo: z.boolean().optional(),
  historyCount: z.number().optional(),
  expiryDays: z.number().optional(),
  passwordReset: z
    .object({
      codeLength: z.number().optional(),
      expiresIn: z.number().optional(),
      rateLimitMax: z.number().optional(),
      rateLimitWindow: z.number().optional(),
      maxAttempts: z.number().optional(),
    })
    .optional(),
});

// ============================================================================
// Lockout Configuration Schema
// ============================================================================

export const lockoutConfigSchema = z.object({
  enabled: z.boolean().optional(),
  maxAttempts: z.number().optional(),
  duration: z.number().optional(),
  resetOnSuccess: z.boolean().optional(),
});

// ============================================================================
// Session Configuration Schema
// ============================================================================

export const sessionConfigSchema = z.object({
  maxConcurrent: z.number().optional(),
  disallowMultipleSessions: z.boolean().optional(),
  maxLifetime: z.union([z.string(), z.number()]).optional(),
});

// ============================================================================
// Security Configuration Schema
// ============================================================================

export const securityConfigSchema = z.object({
  csrf: z
    .object({
      cookieName: z.string().optional(),
      headerName: z.string().optional(),
      tokenLength: z.number().optional(),
      excludedPaths: z.array(z.string()).optional(),
      cookieOptions: z
        .object({
          // httpOnly is always false (hardcoded) - CSRF token must be readable by JavaScript
          secure: z.boolean().optional(),
          sameSite: z.enum(['strict', 'lax', 'none']).optional(),
          domain: z.string().optional(),
          path: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// ============================================================================
// Lifecycle Hooks Schema
// ============================================================================

// Note: Functions cannot be validated by Zod, so we use z.any() for hooks
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
const customTemplateDefinitionSchema = z
  .object({
    htmlPath: z.string().optional(),
    html: z.string().optional(),
    textPath: z.string().optional(),
    text: z.string().optional(),
    subject: z.string().optional(),
  })
  .refine((data) => !!(data.htmlPath || data.html), {
    message: 'Must provide either "htmlPath" or "html" content',
  })
  .refine((data) => !(data.htmlPath && data.html), {
    message: 'Cannot provide both "htmlPath" and "html". Use one or the other.',
  })
  .refine((data) => !(data.textPath && data.text), {
    message: 'Cannot provide both "textPath" and "text". Use one or the other.',
  });

/**
 * Template configuration schema
 *
 * Validates template configuration:
 * - Global variables for branding
 * - Custom templates with required parameters
 */
const templateConfigSchema = z.object({
  engine: z.any().optional(), // TemplateEngine instance - runtime validation
  globalVariables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  customTemplates: z.record(customTemplateDefinitionSchema).optional(),
});

/**
 * Email configuration schema
 */
export const emailConfigSchema = z.object({
  appName: z.string().optional(),
  companyName: z.string().optional(),
  logoUrl: z.string().optional(),
  supportEmail: z.string().email().optional(),
  dashboardUrl: z.string().url().optional(),
  brandColor: z.string().optional(),
  footerDisclaimer: z.string().optional(),
  templates: templateConfigSchema.optional(),
});

// ============================================================================
// SMS Template Configuration Schema
// ============================================================================

/**
 * Custom SMS template definition schema
 *
 * Validates template definition structure:
 * - Must have either contentPath OR content (not both)
 */
const customSMSTemplateDefinitionSchema = z
  .object({
    contentPath: z.string().optional(),
    content: z.string().optional(),
  })
  .refine((data) => !!(data.contentPath || data.content), {
    message: 'Must provide either "contentPath" or "content"',
  })
  .refine((data) => !(data.contentPath && data.content), {
    message: 'Cannot provide both "contentPath" and "content". Use one or the other.',
  });

/**
 * SMS template configuration schema
 *
 * Validates SMS template configuration:
 * - Global variables for branding
 * - Custom templates with required parameters
 */
const smsTemplateConfigSchema = z.object({
  engine: z.any().optional(), // SMSTemplateEngine instance - runtime validation
  globalVariables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  customTemplates: z.record(customSMSTemplateDefinitionSchema).optional(),
});

/**
 * SMS configuration schema
 */
export const smsConfigSchema = z.object({
  templates: smsTemplateConfigSchema.optional(),
});

// ============================================================================
// Phone Configuration Schema
// ============================================================================

export const phoneConfigSchema = z.object({
  // verification section removed - moved to signup.phoneVerification
  // Kept empty for backwards compatibility
});

// ============================================================================
// Social Provider Configuration Schema
// ============================================================================

export const socialProviderConfigSchema = z.object({
  enabled: z.boolean().optional(),
  clientId: z.union([z.string(), z.array(z.string())]).optional(),
  clientSecret: z.string().optional(),
  callbackUrl: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  autoLink: z.boolean().optional(),
  allowSignup: z.boolean().optional(),
});

/**
 * Apple-specific social provider configuration schema
 *
 * Apple requires teamId, keyId, and privateKeyPem instead of a static clientSecret.
 * The toolkit will automatically generate and refresh the JWT client secret.
 */
export const appleSocialProviderConfigSchema = socialProviderConfigSchema.omit({ clientSecret: true }).extend({
  teamId: z.string().optional(),
  keyId: z.string().optional(),
  privateKeyPem: z.string().optional(),
});

export const socialRedirectConfigSchema = z.object({
  frontendBaseUrl: z.string().optional(),
  allowAbsoluteReturnTo: z.boolean().optional(),
  allowedReturnToOrigins: z.array(z.string()).optional(),
});

export const socialConfigSchema = z.object({
  google: socialProviderConfigSchema.optional(),
  apple: appleSocialProviderConfigSchema.optional(),
  facebook: socialProviderConfigSchema.optional(),
  redirect: socialRedirectConfigSchema.optional(),
});

// ============================================================================
// MFA Configuration Schemas
// ============================================================================

export const totpConfigSchema = z.object({
  window: z.number().optional(),
  stepSeconds: z.number().optional(),
  digits: z.number().optional(),
  algorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
});

export const passkeyConfigSchema = z.object({
  rpName: z.string(),
  rpId: z.string(),
  origin: z.union([z.string(), z.array(z.string())]).optional(),
  timeout: z.number().optional(),
  userVerification: z.enum(['required', 'preferred', 'discouraged']).optional(),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
});

export const backupCodesConfigSchema = z.object({
  enabled: z.boolean().optional(),
  codeCount: z.number().optional(),
  codeLength: z.number().optional(),
});

export const riskLevelConfigSchema = z.object({
  maxScore: z.number(),
  action: z.enum(['allow', 'require_mfa', 'block_signin']).optional(),
  notifyUser: z.boolean().optional(),
});

export const adaptiveMFAConfigSchema = z.object({
  triggers: z
    .array(
      z.enum([
        'new_device',
        'new_ip',
        'new_country',
        'impossible_travel',
        'suspicious_activity',
        'recent_password_reset',
      ]),
    )
    .optional(),
  riskThreshold: z.number().optional(), // Deprecated
  riskWeights: z.record(z.string(), z.number()).optional(),
  riskLevels: z
    .object({
      low: riskLevelConfigSchema.optional(),
      medium: riskLevelConfigSchema.optional(),
      high: riskLevelConfigSchema.optional(),
    })
    .optional(),
  blockedSignIn: z
    .object({
      blockDuration: z.number().optional(),
      message: z.string().optional(),
      errorCode: z.string().optional(),
    })
    .optional(),
  maxTravelSpeed: z.number().optional(),
  countryChangeThreshold: z.number().optional(),
  suspiciousActivityWindow: z.number().optional(),
});

export const mfaConfigSchema = z.object({
  enabled: z.boolean().optional(),
  enforcement: z.enum(['OPTIONAL', 'REQUIRED', 'ADAPTIVE']).optional(),
  gracePeriod: z.number().optional(),
  allowedMethods: z.array(z.enum(['totp', 'sms', 'email', 'passkey'])).optional(),
  requireForSocialLogin: z.boolean().optional(),
  rememberDevices: z.enum(['always', 'user_opt_in', 'never']).optional(),
  rememberDeviceDays: z.number().optional(),
  bypassMFAForTrustedDevices: z.boolean().optional(),
  issuer: z.string().optional(),
  totp: totpConfigSchema.optional(),
  passkey: passkeyConfigSchema.optional(),
  backup: backupCodesConfigSchema.optional(),
  adaptive: adaptiveMFAConfigSchema.optional(),
});

// ============================================================================
// Token Delivery Configuration Schema
// ============================================================================

export const tokenDeliveryConfigSchema = z.object({
  method: z.enum(['json', 'cookies', 'hybrid']).optional(),
  cookieNamePrefix: z.string().optional(), // Prefix for all cookie names (default: 'nauth_')
  cookieOptions: z
    .object({
      secure: z.boolean().optional(),
      sameSite: z.enum(['strict', 'lax', 'none']).optional(),
      path: z.string().optional(),
      domain: z.string().optional(),
    })
    .optional(),
  hybridPolicy: z
    .object({
      webOrigins: z.array(z.string()).optional(),
      nativeOrigins: z.array(z.string()).optional(),
    })
    .optional(),
});

// ============================================================================
// Challenge Configuration Schema
// ============================================================================

export const challengeConfigSchema = z.object({
  maxAttempts: z.number().int().positive().optional(),
});

// ============================================================================
// GeoLocation Configuration Schema
// ============================================================================

export const geoLocationConfigSchema = z.object({
  maxMind: z
    .object({
      dbPath: z.string().optional(),
      skipDownloads: z.boolean().optional(),
      licenseKey: z.string().optional(),
      accountId: z.number().optional(),
      autoDownloadOnStartup: z.boolean().optional(),
      editions: z.array(z.string()).optional(),
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
export const authConfigSchema = z
  .object({
    tablePrefix: z.string().optional(),
    jwt: jwtConfigSchema,
    signup: signupConfigSchema.optional(),
    login: loginConfigSchema.optional(),
    password: passwordConfigSchema.optional(),
    lockout: lockoutConfigSchema.optional(),
    session: sessionConfigSchema.optional(),
    security: securityConfigSchema.optional(),
    auditLogs: z
      .object({
        enabled: z.boolean().optional(),
        fireAndForget: z.boolean().optional(),
      })
      .optional(),
    emailProvider: z.any().optional(), // Runtime instance - cannot validate type
    email: emailConfigSchema.optional(),
    smsProvider: z.any().optional(), // Runtime instance - cannot validate type
    sms: smsConfigSchema.optional(),
    phone: phoneConfigSchema.optional(),
    storageAdapter: z.any().optional(), // Runtime instance - cannot validate type
    social: socialConfigSchema.optional(),
    mfa: mfaConfigSchema.optional(),
    logger: z.any().optional(), // LoggerService or NAuthLoggerConfig - runtime instance
    tokenDelivery: tokenDeliveryConfigSchema.optional(),
    challenge: challengeConfigSchema.optional(),
    geoLocation: geoLocationConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // ============================================================================
    // 1. Email Verification Dependencies
    // ============================================================================
    const verificationMethod = data.signup?.verificationMethod || 'email';
    if ((verificationMethod === 'email' || verificationMethod === 'both') && !data.emailProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailProvider is required when email verification is enabled',
        path: ['emailProvider'],
      });
    }

    // ============================================================================
    // 2. Phone Verification Dependencies
    // ============================================================================
    if ((verificationMethod === 'phone' || verificationMethod === 'both') && !data.smsProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'smsProvider is required when phone verification is enabled',
        path: ['smsProvider'],
      });
    }

    // ============================================================================
    // 3. Email Config Requires Provider
    // ============================================================================
    if (data.email && !data.emailProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailProvider is required when email configuration is provided',
        path: ['emailProvider'],
      });
    }

    // ============================================================================
    // 4. Phone Config Requires Provider
    // ============================================================================
    if (data.phone && !data.smsProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'smsProvider is required when phone configuration is provided',
        path: ['smsProvider'],
      });
    }

    // ============================================================================
    // 5. MFA ADAPTIVE Enforcement Validation
    // ============================================================================
    if (data.mfa?.enforcement === 'ADAPTIVE') {
      if (!data.mfa.enabled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mfa.enabled must be true when enforcement is ADAPTIVE',
          path: ['mfa', 'enabled'],
        });
      }
      if (!data.mfa.adaptive) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mfa.adaptive configuration is required when enforcement is ADAPTIVE',
          path: ['mfa', 'adaptive'],
        });
      }
    }

    // ============================================================================
    // 6. MFA REQUIRED Enforcement Validation
    // ============================================================================
    if (data.mfa?.enforcement === 'REQUIRED' && data.mfa.gracePeriod === undefined) {
      // Grace period is optional but recommended - just warn, don't fail
      // This is handled at runtime level, not validation level
    }

    // ============================================================================
    // 7. MFA SMS Method Requires SMS Provider
    // ============================================================================
    if (data.mfa?.allowedMethods?.includes('sms') && !data.smsProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'smsProvider is required when MFA SMS method is enabled',
        path: ['smsProvider'],
      });
    }

    // ============================================================================
    // 8. MFA Email Method Requires Email Provider
    // ============================================================================
    if (data.mfa?.allowedMethods?.includes('email') && !data.emailProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailProvider is required when MFA Email method is enabled',
        path: ['emailProvider'],
      });
    }

    // ============================================================================
    // 9. MFA Passkey Requires Passkey Config
    // ============================================================================
    if (data.mfa?.allowedMethods?.includes('passkey') && !data.mfa.passkey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mfa.passkey configuration is required when passkey method is enabled',
        path: ['mfa', 'passkey'],
      });
    }

    // ============================================================================
    // 10. MFA Remember Devices Validation
    // ============================================================================
    if (
      data.mfa?.rememberDevices &&
      data.mfa.rememberDevices !== 'never' &&
      data.mfa.rememberDeviceDays === undefined
    ) {
      // Remember device days has default - this is informational only
      // Validation passes, but we could add a warning if needed
    }

    // ============================================================================
    // 11. Social Provider Validation
    // ============================================================================
    let anySocialEnabled = false;
    ['google', 'apple', 'facebook'].forEach((provider) => {
      const providerConfig = data.social?.[provider as 'google' | 'apple' | 'facebook'];
      if (providerConfig?.enabled) {
        anySocialEnabled = true;
        if (!providerConfig.clientId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `clientId is required when ${provider} provider is enabled`,
            path: ['social', provider, 'clientId'],
          });
        }
        // Apple requires teamId, keyId, and privateKeyPem instead of clientSecret
        if (provider === 'apple') {
          const appleConfig = providerConfig as { teamId?: string; keyId?: string; privateKeyPem?: string };
          if (!appleConfig.teamId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'teamId is required when Apple provider is enabled (for web OAuth)',
              path: ['social', 'apple', 'teamId'],
            });
          }
          if (!appleConfig.keyId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'keyId is required when Apple provider is enabled (for web OAuth)',
              path: ['social', 'apple', 'keyId'],
            });
          }
          if (!appleConfig.privateKeyPem) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'privateKeyPem is required when Apple provider is enabled (for web OAuth)',
              path: ['social', 'apple', 'privateKeyPem'],
            });
          }
        } else {
          // Google and Facebook require clientSecret
          // Type assertion needed because TypeScript doesn't know which provider config type we have
          const standardConfig = providerConfig as { clientSecret?: string };
          if (!standardConfig.clientSecret) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `clientSecret is required when ${provider} provider is enabled`,
              path: ['social', provider, 'clientSecret'],
            });
          }
        }
      }
    });

    // Redirect-first social login requires frontendBaseUrl when any provider is enabled
    if (anySocialEnabled) {
      const frontendBaseUrl = data.social?.redirect?.frontendBaseUrl;
      if (!frontendBaseUrl || typeof frontendBaseUrl !== 'string' || frontendBaseUrl.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'social.redirect.frontendBaseUrl is required when any social provider is enabled',
          path: ['social', 'redirect', 'frontendBaseUrl'],
        });
      }
    }

    // ============================================================================
    // 12. MaxMind GeoLocation Validation
    // ============================================================================
    if (data.geoLocation?.maxMind) {
      const maxMind = data.geoLocation.maxMind;
      if (!maxMind.skipDownloads && maxMind.autoDownloadOnStartup) {
        if (!maxMind.licenseKey || !maxMind.accountId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'MaxMind licenseKey and accountId are required when autoDownloadOnStartup is enabled',
            path: ['geoLocation', 'maxMind', 'licenseKey'],
          });
        }
      }
    }

    // ============================================================================
    // 13. Token Delivery Hybrid Policy Validation
    // ============================================================================
    if (data.tokenDelivery?.method === 'hybrid' && !data.tokenDelivery.hybridPolicy) {
      // Hybrid policy is optional but recommended - validation passes
      // Runtime will handle defaults
    }
  });

/**
 * Type inference from Zod schema
 * This provides type safety while Zod provides runtime validation
 */
export type NAuthConfig = z.infer<typeof authConfigSchema>;
