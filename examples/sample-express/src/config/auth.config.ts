import { MFAMethod, NAuthConfig, createRedisStorageAdapter } from '@nauth-toolkit/core';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';
import { NodemailerEmailProvider } from '@nauth-toolkit/email-nodemailer';
import { RecaptchaV3Provider } from '@nauth-toolkit/recaptcha';
import { createPinoLogger, createPinoLoggerAdapter } from '../utils/pino-logger.adapter';

// ============================================================================
// Pino Logger Setup
// ============================================================================
// Create Pino logger with pino-pretty for development-friendly output
const pinoLogger = createPinoLogger({
  level: process.env.LOG_LEVEL || 'debug',
});

// Create adapter for nauth-toolkit
const pinoLoggerAdapter = createPinoLoggerAdapter(pinoLogger);

export const authConfig: NAuthConfig = {
  tablePrefix: 'nauth_',
  storageAdapter: createRedisStorageAdapter(process.env.REDIS_URL || 'redis://localhost:6379'),

  jwt: {
    algorithm: 'HS256',
    issuer: 'com.noorix.nauth',
    audience: ['web', 'mobile'],
    accessToken: { secret: process.env.JWT_SECRET, expiresIn: '5m' },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: '7d',
      rotation: true,
      reuseDetection: true,
    },
  },

  logger: {
    instance: pinoLoggerAdapter,
    enablePiiRedaction: true, // Enable PII redaction for security compliance
    logLevel: 'debug',
  },

  signup: {
    enabled: true,
    verificationMethod: 'both',
    allowDuplicatePhones: false,
    emailVerification: {
      expiresIn: 3600,
      resendDelay: 0,
      rateLimitMax: 30000,
      rateLimitWindow: 3000,
      maxAttemptsPerIP: 20000,
      attemptWindow: 300,
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
      stepSeconds: 30,
      digits: 6,
      algorithm: 'sha1',
    },
    passkey: {
      rpName: 'Nauth App',
      rpId: process.env.NODE_ENV === 'production' ? 'angular.dev1.noorix.com' : 'localhost',
      origin:
        process.env.NODE_ENV === 'production'
          ? ['https://angular.dev1.noorix.com', 'https://api.angular.dev1.noorix.com']
          : ['http://localhost:4200', 'http://localhost:3000'],
      timeout: 60000,
      userVerification: 'preferred',
      authenticatorAttachment: undefined,
    },
    adaptive: {
      triggers: ['new_device', 'new_ip', 'new_country', 'impossible_travel'],
      riskLevels: {
        low: { maxScore: 20, action: 'allow', notifyUser: false },
        medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
        high: { maxScore: 100, action: 'require_mfa', notifyUser: true },
      },
    },
    rememberDevices: 'user_opt_in',
    rememberDeviceDays: 2,
    bypassMFAForTrustedDevices: true,
  },

  tokenDelivery: {
    method: 'cookies',
    cookieOptions: {
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
    },
  },

  security: {
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
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
      enabled: true,
      clientId: process.env.GOOGLE_IOS_CLIENT_ID
        ? [process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_IOS_CLIENT_ID]
        : process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl:
        process.env.NODE_ENV === 'production'
          ? 'https://api.angular.dev1.noorix.com/auth/social/google/callback'
          : 'http://localhost:3000/auth/social/google/callback',
      scopes: ['openid', 'email', 'profile'],
      autoLink: true,
      allowSignup: true,
    },

    facebook: {
      enabled: true,
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackUrl:
        process.env.NODE_ENV === 'production'
          ? 'https://api.angular.dev1.noorix.com/auth/social/facebook/callback'
          : 'http://localhost:3000/auth/social/facebook/callback',
      scopes: ['email', 'public_profile'],
      autoLink: true,
      allowSignup: true,
    },
  },

  emailProvider: new NodemailerEmailProvider({
    transport: {
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PASS as string,
      },
    },
    defaults: {
      from: 'Nauth App <noreply@noorix.com>',
    },
  }),

  email: {
    globalVariables: {
      appName: process.env.APP_NAME || 'Nauth App',
      companyName: process.env.COMPANY_NAME || 'Nauth Company Pty Ltd.',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@noorix.com',
      logoUrl: process.env.LOGO_URL || 'https://www.noorix.com.au/images/noorix-logo-social.png',
      dashboardUrl: process.env.DASHBOARD_URL || 'https://app.example.com/dashboard',
      brandColor: process.env.BRAND_COLOR || '#4f46e5',
      footerDisclaimer: process.env.FOOTER_DISCLAIMER,
    },
  },

  smsProvider: new ConsoleSMSProvider(),

  // reCAPTCHA v3 (optional): set RECAPTCHA_SECRET_KEY to enable. Get keys from https://www.google.com/recaptcha/admin
  ...(process.env.RECAPTCHA_SECRET_KEY && {
    recaptcha: {
      enabled: true,
      provider: new RecaptchaV3Provider({ secretKey: process.env.RECAPTCHA_SECRET_KEY }),
      enforceFor: ['cookies'] as const,
      minimumScore: 0.5,
    },
  }),

  lockout: { enabled: false, maxAttempts: 5, duration: 900, resetOnSuccess: true },
  session: {
    maxConcurrent: 5,
    disallowMultipleSessions: false,
  },
  auditLogs: { enabled: true },
};
