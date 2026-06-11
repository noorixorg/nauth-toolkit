import { ConsoleEmailProvider } from '@nauth-toolkit/email-console';
import { MFAMethod, NAuthConfig } from '@nauth-toolkit/core';
import { DatabaseStorageAdapter } from '@nauth-toolkit/storage-database';
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

/**
 * Returns a list of allowed origins for passkey RP and social OAuth returnTo.
 * Includes common localhost ports so any local dev server can work.
 */
const getAllowedOrigins = (): string[] => {
  const fromEnv = [process.env.FRONTEND_BASE_URL, process.env.API_BASE_URL].filter(Boolean) as string[];
  const localhost = [3000, 4200, 5173, 5174, 8080, 8100].map((p) => `http://localhost:${p}`);
  return [...new Set([...fromEnv, ...localhost])];
};

export const authConfig: NAuthConfig = {
  tablePrefix: 'nauth_',
  // DatabaseStorageAdapter stores transient state (rate limits, sessions, locks)
  // in the same PostgreSQL database — no Redis required.
  // Requires getNAuthTransientStorageEntities() to be registered in the DataSource.
  storageAdapter: new DatabaseStorageAdapter(null, null),

  jwt: {
    algorithm: 'HS256',
    issuer: 'com.noorix.nauth',
    audience: ['web', 'mobile'],
    accessToken: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h',
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
      rotation: true,
    },
  },

  logger: {
    instance: {
      log: (msg: string) => console.log(`[NAuth] ${msg}`),
      error: (msg: string, trace?: string) => console.error(`[NAuth ERROR] ${msg}`, trace || ''),
      warn: (msg: string) => console.warn(`[NAuth WARN] ${msg}`),
      debug: (msg: string) => console.debug(`[NAuth DEBUG] ${msg}`),
      verbose: (msg: string) => console.log(`[NAuth VERBOSE] ${msg}`),
    },
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
      maxAttemptsPerIP: 20000,
      attemptWindow: 300,
      baseUrl: `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/auth/challenge/verify-email`,
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
    gracePeriod: 2,
    requireForSocialLogin: false,
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
    expiryDays: 0,
    specialChars: '$#!@',
    passwordReset: {
      codeLength: 6,
      expiresIn: 900,
      rateLimitMax: 30000,
      rateLimitWindow: 300,
      maxAttempts: 1000,
    },
  },

  tokenDelivery: {
    method: 'cookies',
    cookieOptions: {
      // On localhost (HTTP) use lax + insecure. For production HTTPS cross-site
      // deployments set COOKIE_SECURE=true, COOKIE_SAME_SITE=none, COOKIE_DOMAIN=.yourdomain.com
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
    },
  },

  security: {
    maskSensitiveData: false,
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
    },
  },

  social: {
    redirect: {
      frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
      // Allow frontends to pass their own full callback URL (e.g. http://localhost:5173/auth/callback)
      // so any local dev server works without changing FRONTEND_BASE_URL.
      allowAbsoluteReturnTo: true,
      allowedReturnToOrigins: getAllowedOrigins(),
    },
    google: {
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_IOS_CLIENT_ID
        ? [process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_IOS_CLIENT_ID]
        : process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/auth/social/google/callback`,
      scopes: ['openid', 'email', 'profile'],
      autoLink: true,
      allowSignup: true,
      oauthParams: {
        prompt: 'select_account',
      },
    },
  },

  emailProvider: new ConsoleEmailProvider(),

  email: {
    globalVariables: {
      appName: process.env.APP_NAME || 'Nauth App',
      companyName: process.env.COMPANY_NAME || 'Nauth Company',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
    },
  },

  emailNotifications: { enabled: true },

  smsProvider: new ConsoleSMSProvider(),

  sms: {
    templates: {
      globalVariables: {
        appName: process.env.APP_NAME || 'Nauth App',
      },
    },
  },

  lockout: { enabled: false, maxAttempts: 5, duration: 300, resetOnSuccess: true },

  session: {
    maxConcurrent: 5,
    disallowMultipleSessions: false,
    maxLifetime: '30d',
  },

  challenge: {
    maxAttempts: 100,
  },

  auditLogs: { enabled: true, fireAndForget: true },
} satisfies NAuthConfig;
