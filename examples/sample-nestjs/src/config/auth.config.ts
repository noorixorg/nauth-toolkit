import { MFAMethod, NAuthModuleConfig, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';
//import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { Logger } from '@nestjs/common';

// AWS SES SDK imports (install: yarn add @aws-sdk/client-sesv2)

// const smsConfig: AWSSMSConfig = {
//   region: 'ap-southeast-2',
//   originationNumber: 'nauth',
//   // Credentials optional - AWS SDK auto-discovers from IAM role or environment
//   // accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   // secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
// };

export const authConfig: NAuthModuleConfig = {
  tablePrefix: 'nauth_',
  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL || 'redis://localhost:6379'),

  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================
  // Hooks allow you to execute custom logic at specific points in the auth flow
  // preSignup hook can block signup by throwing NAuthException with PRESIGNUP_FAILED
  // Other hooks are non-blocking - errors are logged but don't break the auth flow
  hooks: {
    /**
     * Pre-signup hook
     *
     * Triggered before user account creation for both password and social signups.
     * Can block signup by throwing NAuthException with AuthErrorCode.PRESIGNUP_FAILED.
     *
     * Use cases:
     * - Denylist validation
     * - Invite-only signups
     * - External validation
     * - Domain restrictions
     * - Custom business rules
     *
     * @example
     * ```typescript
     * preSignup: async (data, signupType, provider) => {
     *   // Password signup example
     *   if (signupType === 'password') {
     *     const dto = data as SignupDTO;
     *
     *     // Check denylist
     *     if (await denylistService.isBlocked(dto.email)) {
     *       throw new NAuthException(
     *         AuthErrorCode.PRESIGNUP_FAILED,
     *         'This email address is not allowed to sign up'
     *       );
     *     }
     *
     *     // Invite-only signup
     *     if (!await inviteService.isInvited(dto.email)) {
     *       throw new NAuthException(
     *         AuthErrorCode.PRESIGNUP_FAILED,
     *         'Signup requires an invitation. Please contact support.'
     *       );
     *     }
     *   }
     *
     *   // Social signup example
     *   if (signupType === 'social') {
     *     const profile = data as OAuthUserProfile;
     *
     *     // Block specific domains
     *     if (profile.email?.endsWith('@blocked-domain.com')) {
     *       throw new NAuthException(
     *         AuthErrorCode.PRESIGNUP_FAILED,
     *         'Signups from this email domain are not allowed'
     *       );
     *     }
     *   }
     * }
     * ```
     */
    preSignup: async (data, signupType, provider, adminSignup) => {
      const logger = new Logger('PreSignupHook');
      logger.log(
        `Pre-signup check: type=${signupType}, provider=${provider || 'N/A'}, adminSignup=${adminSignup || false}, email=${signupType === 'password' ? (data as any).email : (data as any).email || 'N/A'}`,
      );

      // Example: Block specific email domains (uncomment and implement)
      // if (signupType === 'password') {
      //   const dto = data as SignupDTO;
      //   if (dto.email.endsWith('@blocked-domain.com')) {
      //     throw new NAuthException(
      //       AuthErrorCode.PRESIGNUP_FAILED,
      //       'Signups from this email domain are not allowed'
      //     );
      //   }
      // }

      // Example: Invite-only signup (uncomment and implement)
      // if (signupType === 'password') {
      //   const dto = data as SignupDTO;
      //   if (!await inviteService.isInvited(dto.email)) {
      //     throw new NAuthException(
      //       AuthErrorCode.PRESIGNUP_FAILED,
      //       'Signup requires an invitation. Please contact support.'
      //     );
      //   }
      // }

      // Example: Social signup domain restriction (uncomment and implement)
      // if (signupType === 'social') {
      //   const profile = data as OAuthUserProfile;
      //   if (profile.email?.endsWith('@blocked-domain.com')) {
      //     throw new NAuthException(
      //       AuthErrorCode.PRESIGNUP_FAILED,
      //       'Signups from this email domain are not allowed'
      //     );
      //   }
      // }
    },
    /**
     * After signup hook
     *
     * Triggered immediately after account creation for both normal and social signups.
     * Called before any challenges are created, so the user account exists but may not be fully verified.
     *
     * Use cases:
     * - Send welcome emails
     * - Create user profiles in external systems
     * - Track analytics
     * - Initialize user data
     * - Send notifications to admins
     *
     * @example
     * ```typescript
     * afterSignup: async (user, metadata) => {
     *   // Send welcome email
     *   await emailService.sendWelcomeEmail(user.email, {
     *     signupType: metadata?.signupType,
     *     provider: metadata?.provider,
     *   });
     *
     *   // Create user profile in external system
     *   await externalService.createProfile({
     *     userId: user.sub,
     *     email: user.email,
     *     firstName: user.firstName,
     *     lastName: user.lastName,
     *     signupType: metadata?.signupType,
     *     provider: metadata?.provider,
     *   });
     *
     *   // Track signup analytics
     *   analytics.track('user_signup', {
     *     userId: user.sub,
     *     email: user.email,
     *     signupType: metadata?.signupType, // 'password' | 'social'
     *     provider: metadata?.provider, // 'google' | 'apple' | 'facebook' (only for social)
     *     requiresVerification: metadata?.requiresVerification,
     *   });
     *
     *   // Initialize user data
     *   await userDataService.initializeUser(user.sub);
     * }
     * ```
     */
    afterSignup: async (user, metadata) => {
      const logger = new Logger('AfterSignupHook');
      logger.log(
        `User signed up: ${user.email} (sub: ${user.sub}), type: ${metadata?.signupType || 'password'}, provider: ${metadata?.provider || 'N/A'}`,
      );

      // Example: Send welcome email (uncomment and implement)
      // try {
      //   await emailService.sendWelcomeEmail(user.email, {
      //     signupType: metadata?.signupType,
      //     provider: metadata?.provider,
      //   });
      // } catch (error) {
      //   logger.error(`Failed to send welcome email: ${error}`);
      // }

      // Example: Create user profile in external system (uncomment and implement)
      // try {
      //   await externalService.createProfile({
      //     userId: user.sub,
      //     email: user.email,
      //     firstName: user.firstName,
      //     lastName: user.lastName,
      //     signupType: metadata?.signupType,
      //     provider: metadata?.provider,
      //   });
      // } catch (error) {
      //   logger.error(`Failed to create external profile: ${error}`);
      // }

      // Example: Track analytics (uncomment and implement)
      // try {
      //   analytics.track('user_signup', {
      //     userId: user.sub,
      //     email: user.email,
      //     signupType: metadata?.signupType,
      //     provider: metadata?.provider,
      //     requiresVerification: metadata?.requiresVerification,
      //   });
      // } catch (error) {
      //   logger.error(`Failed to track analytics: ${error}`);
      // }
    },
  },

  jwt: {
    algorithm: 'HS256',
    issuer: 'com.noorix.nauth',
    audience: ['web', 'mobile'],
    accessToken: { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: '1d',
      rotation: true,
    },
  },

  logger: {
    instance: new Logger('NAuth'),
    enablePiiRedaction: false,
    logLevel: 'debug',
  },

  signup: {
    enabled: true,
    verificationMethod: 'email',
    allowDuplicatePhones: true,
    emailVerification: {
      expiresIn: 3600,
      resendDelay: 0,
      rateLimitMax: 30000,
      rateLimitWindow: 3000,
      // Verification attempt liits (for testing - increase these values)
      maxAttemptsPerIP: 20000, // Max attempts per IP per window (default: 20)
      attemptWindow: 300, // Time window in seconds (default: 3600 = 1 hour)
    },
    phoneVerification: {
      codeLength: 6,
      expiresIn: 300,
      maxAttempts: 3000,
      resendDelay: 0,
      rateLimitMax: 3000,
      rateLimitWindow: 3000,
      maxAttemptsPerUser: 1000,
      maxAttemptsPerIP: 20000,
      attemptWindow: 300,
    },
  },
  mfa: {
    enabled: true,
    enforcement: 'REQUIRED',
    gracePeriod: 0,
    requireForSocialLogin: false,
    allowedMethods: [MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.TOTP, MFAMethod.PASSKEY],
    issuer: 'Nauth App',
    totp: {
      window: 1,
      stepSeconds: 30, // Standard 30 seconds (compatible with Google Authenticator, Authy, etc.)
      digits: 6,
      algorithm: 'sha1',
    },
    passkey: {
      rpName: 'Nauth App',
      rpId: 'angular.dev1.noorix.com',
      origin: ['http://localhost:4200', 'http://localhost:3000', 'https://angular.dev1.noorix.com'],
      timeout: 60000,
      userVerification: 'preferred',
      authenticatorAttachment: undefined,
    },
    adaptive: {
      triggers: ['new_device', 'new_ip', 'new_country', 'impossible_travel'],
      riskLevels: {
        low: { maxScore: 20, action: 'allow', notifyUser: false },
        medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
        high: { maxScore: 100, action: 'block_signin', notifyUser: true },
      },
    },
    rememberDevices: 'user_opt_in',
    rememberDeviceDays: 30,
    bypassMFAForTrustedDevices: true, // does not apply to Adaptptive MFA
  },

  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommon: true,
    historyCount: 5,
    expiryDays: 0,
    specialChars: '$#!@',
    passwordReset: {
      codeLength: 6,
      expiresIn: 900, // 15 minutes
      rateLimitMax: 3,
      rateLimitWindow: 3600, // 1 hour
      maxAttempts: 3,
    },
  },
  tokenDelivery: {
    method: 'cookies',
    cookieOptions: {
      secure: true,
      sameSite: 'strict',
      domain: '.angular.dev1.noorix.com',
    },
  },
  security: {
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
      cookieOptions: {
        domain: '.angular.dev1.noorix.com',
      },
    },
  },
  geoLocation: {
    maxMind: {
      licenseKey: process.env.MAXMIND_LICENSE_KEY,
      accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
      autoDownloadOnStartup: false,
      editions: ['GeoLite2-City', 'GeoLite2-Country'],
    },
  },
  social: {
    redirect: {
      frontendBaseUrl: 'https://angular.dev1.noorix.com',
      allowAbsoluteReturnTo: false,
      allowedReturnToOrigins: ['https://angular.dev1.noorix.com'],
    },
    google: {
      enabled: true, // Enable Google OAuth (default: false)
      clientId: process.env.GOOGLE_IOS_CLIENT_ID
        ? [process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_IOS_CLIENT_ID]
        : process.env.GOOGLE_CLIENT_ID, // Client ID (string or array for multi-platform: web, iOS, Android, e.g., '12345.apps.googleusercontent.com' or ['12345-web.apps.googleusercontent.com', '12345-ios.apps.googleusercontent.com'])
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Client secret (required if enabled)
      callbackUrl: 'https://api.angular.dev1.noorix.com/auth/social/google/callback', // Callback URL (must match provider registration, e.g., 'https://myapp.com/auth/google/callback')
      scopes: ['openid', 'email', 'profile'], // OAuth scopes (default: ['openid', 'email', 'profile'])
      autoLink: true, // Auto-link to existing users by verified email (default: true)
      allowSignup: true, // Allow new user creation (default: true)
    },
    apple: {
      enabled: true, // Enable Apple Sign-In (default: false)
      clientId: process.env.APPLE_SERVICE_ID, // Apple Services ID (e.g., 'com.myapp.services')
      // Apple requires a JWT client secret for web OAuth, which is automatically generated and refreshed
      // by the toolkit from your Apple Developer credentials below.
      // The JWT is stored in the database and refreshed when it has less than 30 days until expiration.
      teamId: process.env.APPLE_TEAM_ID, // Apple Developer Team ID (required for web OAuth)
      keyId: process.env.APPLE_KEY_ID, // Apple Key ID (kid) from your .p8 key (required for web OAuth)
      privateKeyPem: process.env.APPLE_P8_KEY, // Contents of your .p8 private key file in PEM format (required for web OAuth)
      callbackUrl: 'https://api.angular.dev1.noorix.com/auth/social/apple/callback', // Callback URL (must match provider registration)
      scopes: ['name', 'email'], // OAuth scopes (default: ['name', 'email'])
      autoLink: true, // Auto-link to existing users by verified email (default: true)
      allowSignup: true, // Allow new user creation (default: true)
    },
    facebook: {
      enabled: true, // Enable Facebook OAuth (default: false)
      clientId: process.env.FACEBOOK_CLIENT_ID, // Facebook App ID
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET, // Facebook App Secret
      callbackUrl: 'http://localhost:3000/auth/social/facebook/callback', // Callback URL (must match provider registration, e.g., 'https://myapp.com/auth/facebook/callback')
      scopes: ['email', 'public_profile'], // OAuth scopes (default: ['email', 'public_profile'])
      autoLink: true, // Auto-link to existing users by verified email (default: true)
      allowSignup: true, // Allow new user creation (default: true)
    },
  },

  emailProvider: new ConsoleEmailProvider(),

  // emailProvider: new NodemailerEmailProvider({
  //   transport: {
  //     SES: {
  //       sesClient: new SESv2Client({
  //         region: process.env.AWS_REGION || 'ap-southeast-2',
  //       }),
  //       SendEmailCommand,
  //     },
  //   },
  //   defaults: {
  //     from: 'Nauth App <noreply@noorix.com>',
  //   },
  // }),

  email: {
    appName: process.env.APP_NAME || 'Nauth App',
    companyName: process.env.COMPANY_NAME || 'Nauth Company Pty Ltd.',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@noorix.com.au',
    logoUrl: process.env.LOGO_URL || 'https://www.noorix.com.au/images/noorix-logo-social.png',
    dashboardUrl: process.env.DASHBOARD_URL || 'https://app.example.com/dashboard',
    brandColor: process.env.BRAND_COLOR || '#4f46e5',
    footerDisclaimer: process.env.FOOTER_DISCLAIMER, // Optional - uses default if not provided
  },

  //smsProvider: new AWSSMSProvider(smsConfig)
  smsProvider: new ConsoleSMSProvider(),

  // ============================================================================
  // SMS Templates Configuration
  // ============================================================================
  // Showcase SMS template customization features:
  // 1. Global Variables - Available to all templates (appName, companyName, supportPhone)
  // 2. Inline Templates - Templates defined directly in config (verification, mfa, passwordReset)
  // 3. File-based Templates - Templates loaded from files (see sms-templates/ directory)
  // 4. Conditional Rendering - Handlebars-like {{#if variable}}...{{/if}} syntax
  // 5. Variable Injection - Automatic replacement of {{code}}, {{expiryMinutes}}, etc.
  //
  // When SMS is sent, the template engine:
  // - Merges globalVariables with template-specific variables
  // - Renders the template with all variables replaced
  // - Falls back to hard-coded message if template engine not configured (backward compatible)
  sms: {
    templates: {
      // Global variables available to all SMS templates
      globalVariables: {
        appName: process.env.APP_NAME || 'Nauth App',
        companyName: process.env.COMPANY_NAME || 'Nauth Company Pty Ltd.',
        supportPhone: process.env.SUPPORT_PHONE || '1300-123-4567',
      },
      // Custom templates (override defaults)
      customTemplates: {
        // Example 1: Inline template for verification codes
        // Shows conditional rendering ({{#if appName}}) and multiple variables (code, expiryMinutes, supportPhone)
        verification: {
          content:
            '{{#if appName}}{{appName}}: {{/if}}Your verification code is {{code}}. Valid for {{expiryMinutes}} minutes. Need help? Call {{supportPhone}}.',
        },
        // Example 2: Inline template for MFA codes
        // Shows simpler template with just code and expiry
        mfa: {
          content:
            '{{#if appName}}{{appName}}: {{/if}}Your MFA code is {{code}}. Expires in {{expiryMinutes}} minutes.',
        },
        // Example 3: File-based template for password reset
        // Uncomment to use file-based template instead of inline:
        // passwordReset: {
        //   contentPath: './sms-templates/password-reset.txt.hbs',
        // },
        // Example 4: Inline template for password reset (currently active)
        passwordReset: {
          content:
            '{{#if appName}}{{appName}}: {{/if}}Your password reset code is {{code}}. Valid for {{expiryMinutes}} minutes.',
        },
      },
    },
  },

  lockout: { enabled: true, maxAttempts: 5, duration: 900, resetOnSuccess: true },
  session: {
    maxConcurrent: 2,
    disallowMultipleSessions: false,
    maxLifetime: '30d',
  },
  challenge: {
    maxAttempts: 3, // Default: 3 attempts (4th failure causes error)
  },
  auditLogs: { enabled: true, fireAndForget: true },
} satisfies NAuthModuleConfig;
