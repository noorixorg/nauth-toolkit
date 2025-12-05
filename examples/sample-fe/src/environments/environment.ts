/**
 * Development Environment Configuration
 *
 * This file defines environment variables for development.
 * For production, see environment.prod.ts
 */

export const environment = {
  production: false,

  /**
   * Backend API Base URL
   */
  //apiUrl: 'http://localhost:300',
  apiUrl: 'https://api.angular.dev1.noorix.com',

  /**
   * Token Delivery Mode
   *
   * When true, the frontend always relies on httpOnly cookies for authentication
   * (both web browser and Capacitor native builds). Tokens are never stored in
   * JavaScript; the backend issues and rotates cookies via CookieTokenInterceptor.
   *
   * Backend must be configured with tokenDelivery.method === 'cookies' or 'hybrid'
   * and CORS must allow credentials.
   */
  useCookies: true,

  /**
   * Social OAuth Provider Client IDs
   *
   * These are PUBLIC client IDs that can be safely exposed in the frontend.
   * For security:
   * - Google: Public client ID (safe to expose)
   * - Facebook: Public app ID (safe to expose)
   * - Apple: Service ID (safe to expose)
   *
   * NEVER put client secrets here - those are only used on the backend.
   */
  socialAuth: {
    google: {
      clientId: '1010280037829-ccl2aoaflruq2ao22gkpkbj4jpkj6fn4.apps.googleusercontent.com', // Set your Google Client ID here
      ioClientId: '1010280037829-0b8tfd7h23bp1onjr03rp9p25albkraq.apps.googleusercontent.com',
      enabled: true, // Set to false to disable Google sign-in
    },
    facebook: {
      clientId: '9612640992193714', // Set your Facebook App ID here
      clientToken: '71d139ded04d03eff091810720d7a67b', // Set your Facebook Client Token here (found in Facebook Developer Console > Settings > Basic)
      enabled: true, // Set to false to disable Facebook sign-in
    },
    apple: {
      serviceId: '', // Set your Apple Service ID here
      enabled: false, // Set to false to disable Apple sign-in
    },
  },
};
