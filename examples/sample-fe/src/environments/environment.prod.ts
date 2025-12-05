/**
 * Production Environment Configuration
 *
 * This file defines environment variables for production.
 * Replace placeholder values with your actual production credentials.
 */

export const environment = {
  production: true,

  /**
   * Backend API Base URL
   * For Android testing, use your machine's IP address (192.168.50.39)
   */
  apiUrl: 'http://192.168.50.39:3000',

  /**
   * Token Delivery Mode
   *
   * - true: Use httpOnly cookies (web browser - most secure, XSS-proof)
   * - false: Use Bearer tokens in Authorization header (mobile/Capacitor)
   *
   * Automatically detects Capacitor platform and uses Bearer tokens even if
   * useCookies is true (mobile devices don't support httpOnly cookies properly).
   *
   * @default false for mobile (auto-detected)
   */
  useCookies: false,

  /**
   * Social OAuth Provider Client IDs
   *
   * These are PUBLIC client IDs that can be safely exposed in the frontend.
   * Replace with your actual production OAuth credentials.
   */
  socialAuth: {
    google: {
      clientId: '1010280037829-ccl2aoaflruq2ao22gkpkbj4jpkj6fn4.apps.googleusercontent.com', // Set your Google Client ID here
      ioClientId: '1010280037829-0b8tfd7h23bp1onjr03rp9p25albkraq.apps.googleusercontent.com',

      enabled: true,
    },
    facebook: {
      clientId: '9612640992193714', // Your production Facebook App ID
      clientToken: '71d139ded04d03eff091810720d7a67b', // Set your Facebook Client Token here (found in Facebook Developer Console > Settings > Basic)
      enabled: true,
    },
    apple: {
      serviceId: '', // Your production Apple Service ID
      enabled: false,
    },
  },
};
