import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { withCredentialsInterceptor } from './services/with-credentials.interceptor';

import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';
import { csrfInterceptor } from './services/csrf.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Interceptor order matters:
    // 1. withCredentialsInterceptor - ensures cookies are sent
    // 2. csrfInterceptor - reads CSRF token from cookie and adds to header
    // 3. authInterceptor - handles auth tokens and refresh logic
    provideHttpClient(
      withInterceptors([withCredentialsInterceptor, csrfInterceptor, authInterceptor]),
    ),
  ],
};
