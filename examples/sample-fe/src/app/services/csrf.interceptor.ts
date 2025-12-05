import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PlatformService } from './platform.service';
import { environment } from '../../environments/environment';

/**
 * CSRF Token Interceptor
 *
 * Automatically reads CSRF token from cookie and adds it to request headers
 * for state-changing HTTP methods (POST, PUT, DELETE, PATCH).
 *
 * Requirements:
 * - Only applies when using cookie-based token delivery (useCookies: true)
 * - CSRF token must be in cookie named 'nauth_csrf_token' (set by backend on login/refresh)
 * - Token is added to 'x-csrf-token' header for state-changing requests (POST, PUT, PATCH, DELETE)
 * - Safe methods (GET, HEAD, OPTIONS) skip CSRF token
 *
 * Security:
 * - CSRF token is read from cookie (not httpOnly, so JavaScript can access it)
 * - Token is sent in header to match cookie value (Double Submit Cookie pattern)
 * - Prevents Cross-Site Request Forgery attacks
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const platformService = inject(PlatformService);

  // Only apply CSRF protection when using cookie-based token delivery
  const isWebCookieMode = platformService.isWebPlatform() && environment.useCookies === true;

  if (!isWebCookieMode) {
    return next(req);
  }

  // Skip safe HTTP methods (GET, HEAD, OPTIONS) - these don't require CSRF protection
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next(req);
  }

  // Skip login/signup endpoints - CSRF token is set on these responses
  // Note: Refresh endpoint should include CSRF token (it's a POST request)
  // Check both full URL and relative URL (Angular might use full URLs in some cases)
  const url = req.url.toLowerCase();
  const isInitialAuthEndpoint =
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/login') ||
    url.includes('/signup');
  if (isInitialAuthEndpoint) {
    return next(req);
  }

  // Read CSRF token from cookie
  const csrfToken = getCsrfTokenFromCookie();

  // For state-changing requests (POST, PUT, PATCH, DELETE), CSRF token is required
  if (!csrfToken) {
    // Token not found - backend will handle the error with clear message
    return next(req);
  }

  // Add CSRF token to request header
  // Use lowercase header name to match backend expectation (x-csrf-token)
  // Angular's setHeaders automatically merges with existing headers
  const requestWithCsrf = req.clone({
    setHeaders: {
      'x-csrf-token': csrfToken, // Lowercase to match backend guard
    },
  });

  return next(requestWithCsrf);
};

/**
 * Get CSRF token from cookie
 *
 * Reads the CSRF token from the CSRF cookie.
 * Cookie must not be httpOnly for JavaScript to access it.
 *
 * @returns CSRF token string or null if not found
 */
function getCsrfTokenFromCookie(): string | null {
  // Cookie name matches backend config (default: 'nauth_csrf_token' with prefix 'nauth_')
  // Note: If backend uses custom prefix, this should be configured via environment variable
  const cookieName = 'nauth_csrf_token';

  // Check if we're in a browser environment
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }

  // Parse cookies
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (!trimmed) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const name = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();

    // Match cookie name (case-sensitive)
    if (name === cookieName && value) {
      // Decode URI component in case cookie value is encoded
      try {
        const decoded = decodeURIComponent(value);
        // Return decoded value if valid, otherwise return raw value
        return decoded || value;
      } catch {
        // If decoding fails, return raw value
        return value;
      }
    }
  }

  return null;
}
