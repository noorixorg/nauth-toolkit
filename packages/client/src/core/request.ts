import { NAuthEndpoints } from '../types/config.types';
import { ResolvedNAuthClientConfig } from './config';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';

/**
 * Result of an HTTP request.
 */
export interface HttpResult<T> {
  data: T;
  status: number;
}

/**
 * Build a full URL from base and path.
 */
const buildUrl = (baseUrl: string, path: string): string => {
  if (path.startsWith('http')) return path;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

/**
 * Determine if running in a browser context.
 */
const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Add CSRF header when in cookies mode on web.
 */
const addCsrfHeader = (
  headers: Headers,
  config: ResolvedNAuthClientConfig,
  tokenDelivery: 'json' | 'cookies',
): void => {
  if (!isBrowser()) return;
  if (tokenDelivery === 'json') return;
  const csrfCookieName = config.csrf.cookieName;
  const headerName = config.csrf.headerName;
  const cookies = document.cookie?.split(';').map((c) => c.trim()) ?? [];
  const csrfCookie = cookies.find((c) => c.startsWith(`${csrfCookieName}=`));
  if (!csrfCookie) return;
  const value = csrfCookie.split('=')[1];
  if (value) {
    headers.set(headerName, value);
  }
};

/**
 * Get device token from storage (for JSON mode).
 */
const getDeviceToken = async (config: ResolvedNAuthClientConfig): Promise<string | null> => {
  try {
    const token = await config.storage.getItem(config.deviceTrust.storageKey);
    return token || null;
  } catch {
    return null;
  }
};

/**
 * Execute an HTTP request with auth-aware headers.
 */
/**
 * Execute an HTTP request with auth-aware headers.
 *
 * - Cookies mode: Sets credentials='include', adds CSRF header, no Authorization
 * - JSON mode: Adds Authorization header, device token header, no credentials
 */
export const httpRequest = async <T>(
  config: ResolvedNAuthClientConfig,
  _endpoints: NAuthEndpoints, // Kept for future use (URL validation)
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    accessToken?: string | null;
    tokenDelivery: 'json' | 'cookies';
    signal?: AbortSignal;
  },
): Promise<HttpResult<T>> => {
  const url = buildUrl(config.baseUrl, path);
  const headers = new Headers(config.headers);

  if (options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  // JSON mode: Add Authorization header with Bearer token
  if (options.tokenDelivery === 'json' && options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  // JSON mode: Add device token header if available (for trusted device feature)
  // Device token is sent on all requests (including login/signup) to identify trusted devices
  if (options.tokenDelivery === 'json') {
    const deviceToken = await getDeviceToken(config);
    if (deviceToken) {
      headers.set(config.deviceTrust.headerName, deviceToken);
    }
  }

  // Cookies mode: Device token is automatically sent via httpOnly cookie (nauth_device_token)
  // No manual header needed - browser handles it automatically

  // Cookies mode: Add CSRF header for mutating requests
  // Note: Device token is handled automatically via httpOnly cookie (nauth_device_token)
  addCsrfHeader(headers, config, options.tokenDelivery);

  const fetchOptions: RequestInit = {
    method: options.method,
    headers,
    signal: options.signal,
  };

  // Cookies mode: Include credentials for httpOnly cookie transmission
  if (options.tokenDelivery === 'cookies') {
    fetchOptions.credentials = 'include';
  }

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    throw new NAuthClientError(NAuthErrorCode.INTERNAL_ERROR, 'Network request failed', {
      isNetworkError: true,
      details: { url, message: (error as Error).message },
    });
  }

  const status = response.status;
  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const errorData = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const code =
      typeof errorData['code'] === 'string' ? (errorData.code as NAuthErrorCode) : NAuthErrorCode.INTERNAL_ERROR;
    const message =
      typeof errorData['message'] === 'string' ? (errorData.message as string) : `Request failed with status ${status}`;
    const timestamp = typeof errorData['timestamp'] === 'string' ? errorData.timestamp : undefined;
    const details = errorData['details'] as Record<string, unknown> | undefined;

    throw new NAuthClientError(code, message, {
      statusCode: status,
      timestamp,
      details,
    });
  }

  return { data: data as T, status };
};
