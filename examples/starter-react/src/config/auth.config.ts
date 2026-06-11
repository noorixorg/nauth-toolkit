import type { NAuthClientConfig } from '@nauth-toolkit/client';

const authConfig: NAuthClientConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  authPathPrefix: '/auth',

  // Use 'cookies' for web (httpOnly cookies, CSRF protection).
  // Switch to 'json' and update the endpoints below for mobile/hybrid apps.
  tokenDelivery: 'cookies',

  debug: import.meta.env.DEV,

  csrf: {
    cookieName: 'nauth_csrf_token',
    headerName: 'x-csrf-token',
  },

  // Disable SDK-driven hard redirects for login/challenge flows.
  // The SDK's challengeRouter calls window.location.replace() after login/challenge
  // responses, which conflicts with React Router navigation (loses route state and
  // causes ProtectedRoute to see isAuthenticated=false on fresh page load).
  // Setting onAuthResponse to a no-op hands full navigation control to the app.
  // sessionExpired and oauthError still use hard redirects via navigateToError().
  onAuthResponse: () => {},
  redirects: {
    sessionExpired: '/login',
    oauthError: '/login',
  },
};

export default authConfig;
