import { MFAMethod, NAuthModuleConfig, createRedisStorageAdapter } from '@nauth-toolkit/nestjs';
import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';
// import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { Logger } from '@nestjs/common';

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
    accessToken: { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: '1d',
      rotation: true,
      reuseDetection: true,
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
    enabled: false,
    enforcement: 'OPTIONAL',
    gracePeriod: 0,
    requireForSocialLogin: true,
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
      clientId: process.env.APPLE_CLIENT_ID || 'com.noorix.nauth', // Apple Services ID (e.g., 'com.myapp.services')
      clientSecret: process.env.APPLE_CLIENT_SECRET, // Client secret JWT (not needed for native iOS, required for web)
      callbackUrl: 'http://localhost:3000/auth/social/apple/callback', // Callback URL (must match provider registration)
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
  //     host: process.env.SMTP_HOST,
  //     port: 587,
  //     secure: false,
  //     auth: {
  //       user: process.env.SMTP_USER as string,
  //       pass: process.env.SMTP_PASS as string,
  //     },
  //   },
  //   defaults: {
  //     from: 'Nauth App <noreply@noorix.com>',
  //   },
  // }),

  email: {
    appName: process.env.APP_NAME || 'Nauth App',
    companyName: process.env.COMPANY_NAME || 'Nauth Company Pty Ltd.',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@noorix.com',
    logoUrl: process.env.LOGO_URL || 'https://www.noorix.com.au/images/noorix-logo-social.png',
    dashboardUrl: process.env.DASHBOARD_URL || 'https://app.example.com/dashboard',
    brandColor: process.env.BRAND_COLOR || '#4f46e5',
    footerDisclaimer: process.env.FOOTER_DISCLAIMER, // Optional - uses default if not provided
  },

  //smsProvider: new AWSSMSProvider(smsConfig)
  smsProvider: new ConsoleSMSProvider(),

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
