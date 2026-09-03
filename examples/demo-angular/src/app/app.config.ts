import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { PENDING_INTERACTION_KEY } from './oidc/interaction.component';
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
  provideRecaptcha,
} from '@nauth-toolkit/client-angular/standalone';
import { environment } from '../environments/environment';

import { routes } from './app.routes';

// ============================================================================
// Token Delivery Mode Configuration
// ============================================================================
type TokenMode = 'cookies' | 'json';

// Read from environment configuration (injected during Docker build)
const TOKEN_MODE: TokenMode = environment.tokenMode;

/**
 * Smart config builder that automatically adjusts endpoints, CSRF, and redirects based on token delivery mode
 *
 * IMPORTANT: Backend can be in 'hybrid' mode to support both client types.
 * Frontend must choose 'cookies' or 'json' and use the appropriate endpoints.
 *
 * - JSON mode (web): OAuth redirects with exchangeToken
 *   - Flow: loginWithSocial() → backend redirects to provider → callback with exchangeToken →
 *     frontend calls /social/exchange to get tokens in response body
 *   - Use for: SPAs that store tokens in memory/localStorage
 *
 * - Cookie mode (web): OAuth redirects with automatic cookie setting
 *   - Flow: loginWithSocial() → backend redirects to provider → callback sets cookies automatically
 *   - Use for: Traditional web apps with server-side rendering
 *
 * Note: Native mobile apps use socialVerify endpoint (not shown here)
 *
 * @param mode - Token delivery mode
 * @returns Configured NAuthClientConfig
 */
const buildNAuthConfig = (mode: TokenMode, router: Router): NAuthClientConfig => {
  const baseConfig = {
    baseUrl: environment.apiBaseUrl,
    authPathPrefix: '/auth',
    tokenDelivery: mode,
    debug: true,
    recaptcha: {
      enabled: environment.recaptchaEnabled && !!environment.recaptchaSiteKey,
      version: 'enterprise' as const,
      siteKey: environment.recaptchaSiteKey || '',
      autoLoadScript: false,
    },
    redirects: {
      loginSuccess: '/dashboard',
      sessionExpired: '/login',
      oauthError: '/login',
      challengeBase: '/auth/challenge',
    },
    admin: {
      pathPrefix: '/admin',
    },

    /**
     * Return the user to a pending OpenID Connect request after they log in.
     *
     * The SDK navigates on its own — through the challenge chain, then to
     * `redirects.loginSuccess`. This is the single chokepoint for all of it, so it is
     * the one place that can divert the *terminal* navigation without disturbing the
     * challenge steps in between.
     *
     * A query parameter would not survive: the SDK builds challenge URLs itself and
     * drops anything it does not recognise. `sessionStorage` rides through untouched.
     */
    navigationHandler: (url: string): void => {
      if (url.startsWith('/auth/challenge')) {
        void router.navigateByUrl(url);
        return;
      }

      const pending = sessionStorage.getItem(PENDING_INTERACTION_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_INTERACTION_KEY);
        void router.navigateByUrl(`/interaction/${pending}`);
        return;
      }

      void router.navigateByUrl(url);
    },
  };

  // Mode-specific configurations
  if (mode === 'json') {
    return {
      ...baseConfig,
      // JSON mode: Use /mobile endpoints (no cookies, pure JSON with Bearer tokens)
      endpoints: {
        profile: '/profile',
        login: '/login/mobile',
        refresh: '/refresh/mobile',
        signup: '/signup/mobile',
        logout: '/logout/mobile',
        respondChallenge: '/respond-challenge/mobile',
        // Social auth in JSON mode (web): OAuth redirects + manual exchange
        // Uses /mobile endpoints to force JSON token delivery in hybrid backend
        socialRedirectStart: '/social/:provider/redirect/mobile',
        socialExchange: '/social/exchange',
      },
      // CSRF not needed in JSON mode (Bearer tokens are CSRF-safe)
    } as NAuthClientConfig;
  }

  // Cookie mode
  return {
    ...baseConfig,
    // Cookie mode: Use standard endpoints (cookie-based auth)
    endpoints: {
      profile: '/profile',
      login: '/login',
      refresh: '/refresh',
      signup: '/signup',
      logout: '/logout',
      respondChallenge: '/respond-challenge',
      // Social auth in cookie mode: OAuth redirects with automatic cookie setting
      socialRedirectStart: '/social/:provider/redirect',
    },
    csrf: {
      cookieName: 'nauth_csrf_token',
      headerName: 'x-csrf-token',
    },
  } as NAuthClientConfig;
};

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
      useFactory: (router: Router) => buildNAuthConfig(TOKEN_MODE, router),
      deps: [Router],
    },
    AngularHttpAdapter,
    AuthService,
    provideRecaptcha(),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
