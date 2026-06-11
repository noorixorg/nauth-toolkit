import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';
import { createDatabaseStorageAdapter, MFAMethod, NAuthModuleConfig } from '@nauth-toolkit/nestjs';
import { Logger } from '@nestjs/common';

/**
 * Returns allowed origins for social OAuth returnTo and CORS.
 * Includes common localhost ports so any local dev server works out of the box.
 */
const getAllowedOrigins = (): string[] => {
  const fromEnv = [process.env.FRONTEND_BASE_URL, process.env.API_BASE_URL].filter(Boolean) as string[];
  const localhost = [3000, 4200, 5173, 5174, 8080, 8100].map((p) => `http://localhost:${p}`);
  return [...new Set([...fromEnv, ...localhost])];
};

/**
 * nauth-toolkit configuration.
 *
 * This example uses:
 * - Database storage (no Redis required)
 * - Console email provider (logs emails to stdout — swap for Nodemailer/SES in production)
 * - Console SMS provider (logs SMS to stdout — swap for AWS SNS / Twilio in production)
 * - Google OAuth (disable by leaving GOOGLE_CLIENT_ID unset)
 * - Email + SMS MFA
 * - Custom email verification template (see resources/email-templates/)
 *
 * For production, replace:
 * - DatabaseStorageAdapter → Redis (lower latency for sessions/challenges)
 * - ConsoleEmailProvider → NodemailerEmailProvider or SES
 * - ConsoleSMSProvider → AwsSNSSMSProvider or TwilioSMSProvider
 */
export const authConfig: NAuthModuleConfig = {
  tablePrefix: 'nauth_',

  // Sessions and challenge state are stored here.
  // DatabaseStorageAdapter uses your existing PostgreSQL connection — no Redis needed.
  // For production with high traffic, consider @nauth-toolkit/storage-redis.
  storageAdapter: createDatabaseStorageAdapter(),

  jwt: {
    algorithm: 'HS256',
    issuer: 'nauth-example',
    audience: ['web'],
    accessToken: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d',
      rotation: true,
      reuseDetection: true,
    },
  },

  logger: {
    instance: new Logger('NAuth'),
    enablePiiRedaction: true,
    logLevel: 'log',
  },

  signup: {
    enabled: true,
    verificationMethod: 'email',   // email | phone | both | none
    allowDuplicatePhones: true,
    emailVerification: {
      expiresIn: 3600,
      resendDelay: 0,
      rateLimitMax: 30000,
      rateLimitWindow: 300,
      maxAttempts: 1000,
      maxAttemptsPerUser: 10000,
      maxAttemptsPerIP: 10000,
      attemptWindow: 60,
      baseUrl: `${process.env.FRONTEND_BASE_URL || 'http://localhost:4200'}/auth/verify-email`,
    },
    phoneVerification: {
      resendDelay: 0,
      rateLimitMax: 10000,
      rateLimitWindow: 60,
      maxAttempts: 1000,
      maxAttemptsPerUser: 10000,
      maxAttemptsPerIP: 10000,
      attemptWindow: 60,
    },
  },

  mfa: {
    enabled: true,
    enforcement: 'OPTIONAL',        // OPTIONAL | REQUIRED
    allowedMethods: [MFAMethod.EMAIL, MFAMethod.SMS],
    rememberDevices: 'user_opt_in',
    rememberDeviceDays: 30,
    bypassMFAForTrustedDevices: true,
  },

  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommon: true,
    historyCount: 5,
    specialChars: '$#!@',
    passwordReset: {
      codeLength: 6,
      expiresIn: 900,
      rateLimitMax: 1000,
      rateLimitWindow: 60,
      maxAttempts: 100,
    },
  },

  // 'hybrid' allows cookie delivery by default AND supports JSON token exchange
  // (required for the /auth/social/exchange endpoint used when MFA is triggered
  // after a social login — the exchange token carries the pending challenge state).
  tokenDelivery: {
    method: 'hybrid',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  },

  security: {
    maskSensitiveData: true,
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
    },
  },

  // Google OAuth — enabled automatically when GOOGLE_CLIENT_ID is set.
  social: {
    redirect: {
      frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
      // Allow absolute returnTo so the React dev server (any port) can pass its full origin URL.
      allowAbsoluteReturnTo: true,
      allowedReturnToOrigins: getAllowedOrigins(),
    },
    google: {
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/auth/social/google/callback`,
      scopes: ['openid', 'email', 'profile'],
      autoLink: true,
      allowSignup: true,
    },
  },

  // Console email provider — prints emails to stdout.
  // Replace with NodemailerEmailProvider for real email delivery:
  //
  //   import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
  //   emailProvider: new NodemailerEmailProvider({
  //     transport: { host: 'smtp.example.com', port: 587, auth: { user: '...', pass: '...' } },
  //     defaults: { from: 'My App <noreply@example.com>' },
  //   }),
  emailProvider: new ConsoleEmailProvider(),

  email: {
    globalVariables: {
      appName: process.env.APP_NAME || 'My App',
      companyName: process.env.COMPANY_NAME || 'My Company',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
    },
    templates: {
      // Custom email templates — see resources/email-templates/ for examples.
      customTemplates: {
        verification: {
          htmlPath: './resources/email-templates/verification.html.hbs',
          textPath: './resources/email-templates/verification.text.hbs',
        },
      },
    },
  },

  emailNotifications: {
    enabled: true,
    suppress: {
      welcome: false,
      passwordChanged: false,
    },
  },

  // Console SMS provider — prints SMS to stdout.
  // Replace with AwsSNSSMSProvider or TwilioSMSProvider for real SMS delivery.
  smsProvider: new ConsoleSMSProvider(),

  lockout: {
    enabled: false,
    maxAttempts: 100,
    duration: 10,
    resetOnSuccess: true,
  },

  session: {
    maxConcurrent: 5,
    disallowMultipleSessions: false,
    maxLifetime: '30d',
  },

  challenge: {
    maxAttempts: 100,
  },

  auditLogs: {
    enabled: true,
    fireAndForget: true,
  },
} satisfies NAuthModuleConfig;
