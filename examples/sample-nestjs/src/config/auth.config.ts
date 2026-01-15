import { MFAMethod, NAuthModuleConfig, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { Logger } from '@nestjs/common';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

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

  jwt: {
    algorithm: 'HS256',
    issuer: 'com.noorix.nauth',
    audience: ['web', 'mobile'],
    accessToken: { secret: process.env.JWT_SECRET, expiresIn: '10s' },
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
    verificationMethod: 'both',
    allowDuplicatePhones: true,
    emailVerification: {
      expiresIn: 3600,
      resendDelay: 0,
      rateLimitMax: 30000,
      rateLimitWindow: 3000,
      // Verification attempt liits (for testing - increase these values)
      maxAttemptsPerIP: 20000, // Max attempts per IP per window (default: 20)
      attemptWindow: 300, // Time window in seconds (default: 3600 = 1 hour)
      baseUrl: 'http://localhost:4200', // Include verification link in emails
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
    enforcement: 'OPTIONAL',
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
        low: { maxScore: 20, action: 'allow', notifyUser: true },
        medium: { maxScore: 40, action: 'require_mfa', notifyUser: true },
        high: { maxScore: 100, action: 'block_signin', notifyUser: true },
      },
      blockedSignIn: {
        // Block only the suspicious IP (not the whole user) and auto-expire quickly.
        // This reduces lockout DoS risk while still protecting against repeated attempts.
        scope: 'ip',
        blockDuration: 15, // minutes
        message: 'Sign-in blocked due to suspicious activity. Please try again shortly or contact support.',
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
    method: 'hybrid',
    cookieOptions: {
      secure: true,
      sameSite: 'none',
      // domain: '.angular.dev1.noorix.com',
    },
  },
  security: {
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
      // cookieOptions: {
      //   domain: '.angular.dev1.noorix.com',
      // },
    },
  },
  geoLocation: {
    maxMind: {
      licenseKey: process.env.MAXMIND_LICENSE_KEY,
      accountId: parseInt(process.env.MAXMIND_ACCOUNT_ID || '0', 10),
      dbPath: './maxmind',
      autoDownloadOnStartup: false,
      editions: ['GeoLite2-City', 'GeoLite2-Country'],
    },
  },
  social: {
    redirect: {
      frontendBaseUrl: 'http://localhost:4200',
      allowAbsoluteReturnTo: false,
      allowedReturnToOrigins: ['https://angular.dev1.noorix.com', 'http://localhost:4200', 'http://localhost:3000'],
    },
    google: {
      enabled: true, // Enable Google OAuth (default: false)
      clientId: process.env.GOOGLE_IOS_CLIENT_ID
        ? [process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_IOS_CLIENT_ID]
        : process.env.GOOGLE_CLIENT_ID, // Client ID (string or array for multi-platform: web, iOS, Android, e.g., '12345.apps.googleusercontent.com' or ['12345-web.apps.googleusercontent.com', '12345-ios.apps.googleusercontent.com'])
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Client secret (required if enabled)
      callbackUrl: 'http://localhost:3000/auth/social/google/callback', // Callback URL (must match provider registration, e.g., 'https://myapp.com/social/google/callback')
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
      callbackUrl: 'https://api.angular.dev1.noorix.com/social/apple/callback', // Callback URL (must match provider registration)
      scopes: ['name', 'email'], // OAuth scopes (default: ['name', 'email'])
      autoLink: true, // Auto-link to existing users by verified email (default: true)
      allowSignup: true, // Allow new user creation (default: true)
    },
    facebook: {
      enabled: true, // Enable Facebook OAuth (default: false)
      clientId: process.env.FACEBOOK_CLIENT_ID, // Facebook App ID
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET, // Facebook App Secret
      callbackUrl: 'http://localhost:3000/social/facebook/callback', // Callback URL (must match provider registration, e.g., 'https://myapp.com/social/facebook/callback')
      scopes: ['email', 'public_profile'], // OAuth scopes (default: ['email', 'public_profile'])
      autoLink: true, // Auto-link to existing users by verified email (default: true)
      allowSignup: true, // Allow new user creation (default: true)
    },
  },

  // emailProvider: new ConsoleEmailProvider(),

  emailProvider: new NodemailerEmailProvider({
    transport: {
      SES: {
        sesClient: new SESv2Client({
          region: process.env.AWS_REGION || 'ap-southeast-2',
        }),
        SendEmailCommand,
      },
    },
    defaults: {
      from: 'Nauth App <noreply@noorix.com>',
    },
  }),

  email: {
    // Canonical template globals location (no templates.globalVariables)
    globalVariables: {
      appName: process.env.APP_NAME || 'Nauth App',
      companyName: process.env.COMPANY_NAME || 'Nauth Company Pty Ltd.',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@noorix.com.au',
      logoUrl: process.env.LOGO_URL || 'https://www.noorix.com.au/images/noorix-logo-social.png',
      dashboardUrl: process.env.DASHBOARD_URL || 'https://app.example.com/dashboard',
      brandColor: process.env.BRAND_COLOR || '#4f46e5',
      footerDisclaimer: process.env.FOOTER_DISCLAIMER, // Optional - uses default if not provided
    },
    templates: {
      // All email templates are enabled by default when emailProvider is configured
      // You can override specific templates here if needed:
      customTemplates: {
        // Custom verification template to test template override functionality
        verification: {
          htmlPath: './resources/email-templates/verification.html.hbs',
          textPath: './resources/email-templates/verification.text.hbs',
        },
        // welcome: {
        //   htmlPath: './email-templates/welcome.html.hbs',
        //   textPath: './email-templates/welcome.text.hbs',
        // },
      },
    },
  },

  // ============================================================================
  // Email Notifications Configuration
  // ============================================================================
  // Controls which lifecycle notification emails are sent
  // Most optional notifications are DISABLED by default (opt-in)
  // Code emails (verification, password reset) are ENABLED by default
  emailNotifications: {
    enabled: true, // Global kill switch - set to false to disable all emails
    suppress: {
      // Optional lifecycle notifications (set to false to ENABLE)
      welcome: false, // Enable welcome email after signup
      passwordChanged: false, // Enable password changed security alert
      mfaDeviceRemoved: false, // Enable MFA device removed alert
      adaptiveMfaRiskDetected: false, // Enable adaptive MFA risk detection alerts
      accountDisabled: false, // Enable account disabled notification
      accountEnabled: false, // Enable account enabled notification
      emailChangedOld: false, // Enable email changed alert (sent to old address)
      emailChangedNew: false, // Enable email changed confirmation (sent to new address)
      accountLockout: false, // Enable account lockout notification
      sessionsRevoked: false, // Enable sessions revoked alert
      mfaFirstEnabled: false, // Enable MFA first enabled confirmation
      // Note: Code emails (emailVerification, passwordReset, adminPasswordReset)
      // cannot be suppressed and are always sent when enabled: true
    },
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

  lockout: { enabled: false, maxAttempts: 5, duration: 300, resetOnSuccess: true },
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
