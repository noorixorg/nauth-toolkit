import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import {
  NAUTH_CLIENT_CONFIG,
  type NAuthClientConfig,
  authInterceptor,
  AuthService,
  AngularHttpAdapter,
} from '@nauth-toolkit/client-angular/standalone';
import { environment } from '../environments/environment';

import { routes } from './app.routes';

/**
 * Custom preset with blue color palette matching nauth-docs theme
 * Based on: https://primeng.org/theming/styled
 */
const NauthPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
    },
  },
  primitive: {
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3D85F7',
      600: '#2E6BE8',
      700: '#1F52D9',
      800: '#1038CA',
      900: '#081E9B',
      950: '#040F5C',
    },
  },
});

/**
 * Application configuration
 *
 * Configures:
 * - PrimeNG theme (Aura)
 * - HTTP client with nauth authentication interceptor
 * - NAuth client configuration
 *
 * @example
 * ```typescript
 * bootstrapApplication(App, appConfig);
 * ```
 */
export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({
      theme: {
        preset: NauthPreset,
        options: {
          darkModeSelector: false, // Disable dark mode
        },
      },
      inputStyle: 'filled',
    }),
    MessageService,
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        baseUrl: `${environment.apiBaseUrl}`,
        authPathPrefix: '/auth',
        tokenDelivery: 'cookies',
        debug: true,
        csrf: {
          cookieName: 'nauth_csrf_token',
          headerName: 'x-csrf-token',
        },
        // CSRF not needed in JSON mode (Bearer tokens are CSRF-safe)
        // Only configure csrf when using tokenDelivery: 'cookies' or 'hybrid'
        endpoints: {
          // profile: '/profile',
          // login: '/login/mobile',
          // refresh: '/refresh/mobile',
          // signup: '/signup/mobile',
          // logout: '/logout/mobile',
          // respondChallenge: '/respond-challenge/mobile',
          // isTrustedDevice: '/auth/is-trusted-device',
          // trustDevice: '/auth/trust-device',
          // auditHistory: '/auth/audit/history',
          // updateProfile: '/auth/profile',
          // changePassword: '/auth/change-password',
          // requestPasswordChange: '/auth/request-password-change',
          // forgotPassword: '/auth/forgot-password/',
          // confirmForgotPassword: '/auth/forgot-password/confirm',
          // confirmAdminResetPassword: '/auth/admin/reset-password/confirm',
          // socialRedirectStart: '/auth/social/:provider/redirect',
          // socialExchange: '/auth/social/exchange',
          // socialLinked: '/auth/social/linked',
          // socialLink: '/auth/social/link',
          // socialUnlink: '/auth/social/unlink',
          // socialVerify: '/auth/social/:provider/verify',
          // mfaStatus: '/auth/mfa/status',
          // mfaDevices: '/auth/mfa/devices',
          // mfaSetupData: '/auth/mfa/setup-data',
          // mfaVerifySetup: '/auth/mfa/verify-setup',
          // mfaRemove: '/auth/mfa/method',
          // mfaPreferred: '/auth/mfa/preferred-method',
          // mfaBackupCodes: '/auth/mfa/backup-codes/generate',
          // mfaExemption: '/auth/mfa/exemption',
        },

        redirects: {
          success: '/dashboard',
          sessionExpired: '/login',
          oauthError: '/login',
          challengeBase: '/auth/challenge',
        },
        admin: {
          pathPrefix: '/admin',
        },
      } satisfies NAuthClientConfig,
    },
    AngularHttpAdapter,
    AuthService,
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
