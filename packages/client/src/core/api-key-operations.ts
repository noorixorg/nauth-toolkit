import { ResolvedNAuthClientConfig } from './config';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';
import type { ApiKeyInfo, CreateApiKeyRequest, UpdateApiKeyRequest, CreateApiKeyResult } from '../types/api-key.types';

const hasWindow = (): boolean =>
  typeof globalThis !== 'undefined' && typeof (globalThis as { window?: unknown }).window !== 'undefined';

/**
 * Build a headers object that attaches an API key for machine-to-machine calls.
 *
 * Useful when a script or service authenticates with an API key instead of a session.
 *
 * @param key - The plaintext API key
 * @param headerName - Header name (defaults to 'X-API-Key'; must match server config)
 * @returns A headers object to merge into requests
 *
 * @example
 * ```typescript
 * const client = new NAuthClient({
 *   baseUrl: 'https://api.example.com/auth',
 *   tokenDelivery: 'json',
 *   headers: apiKeyHeader(process.env.NAUTH_API_KEY!),
 * });
 * ```
 */
export function apiKeyHeader(key: string, headerName = 'X-API-Key'): Record<string, string> {
  return { [headerName]: key };
}

/**
 * API key management operations. Accessed via `client.apiKeys.*`.
 *
 * Calls the API-key management endpoints your backend mounts (defaults to `{baseUrl}/api-keys`).
 * The backend `ApiKeyService` powers these; there are no built-in routes, so ensure your
 * controllers are mounted at the expected paths (or pass a custom `basePath`).
 */
export class ApiKeyOperations {
  private readonly config: ResolvedNAuthClientConfig;
  private readonly basePath: string;

  /**
   * @param config - Resolved client configuration
   * @param basePath - Base path for API-key endpoints (default: `{baseUrl}/api-keys`)
   */
  constructor(config: ResolvedNAuthClientConfig, basePath?: string) {
    this.config = config;
    this.basePath = basePath ?? `${config.baseUrl}/api-keys`;
  }

  /**
   * Create a new API key. The plaintext key is returned once.
   *
   * @param request - Key options (mandatory expiry; optional IP allowlist)
   */
  async create(request: CreateApiKeyRequest): Promise<CreateApiKeyResult> {
    return this.post<CreateApiKeyResult>(this.basePath, request);
  }

  /**
   * List the current user's API keys (sanitized).
   */
  async list(): Promise<ApiKeyInfo[]> {
    return this.get<ApiKeyInfo[]>(this.basePath);
  }

  /**
   * Update a key's label and/or IP allowlist.
   *
   * @param keyId - External key identifier
   * @param request - Fields to update
   */
  async update(keyId: string, request: UpdateApiKeyRequest): Promise<ApiKeyInfo> {
    return this.patch<ApiKeyInfo>(`${this.basePath}/${encodeURIComponent(keyId)}`, request);
  }

  /**
   * Revoke (soft-delete) a key.
   *
   * @param keyId - External key identifier
   */
  async revoke(keyId: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(`${this.basePath}/${encodeURIComponent(keyId)}/revoke`, {});
  }

  /**
   * Permanently delete a key.
   *
   * @param keyId - External key identifier
   */
  async remove(keyId: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`${this.basePath}/${encodeURIComponent(keyId)}`);
  }

  // ==========================================================================
  // Internal request helpers (mirror AdminOperations)
  // ==========================================================================

  private async buildHeaders(method: 'GET' | 'POST' | 'PATCH' | 'DELETE'): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...this.config.headers };

    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    if (this.config.tokenDelivery === 'json') {
      try {
        const token = await this.config.storage.getItem('nauth_access_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Non-fatal: storage can fail in restricted environments
      }
    }

    const mutating: readonly string[] = ['POST', 'PATCH', 'DELETE'];
    if (this.config.tokenDelivery === 'cookies' && hasWindow() && mutating.includes(method)) {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        headers[this.config.csrf.headerName] = csrfToken;
      }
    }

    return headers;
  }

  private getCsrfToken(): string | null {
    if (!hasWindow() || typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${this.config.csrf.cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  }

  private async get<T>(path: string): Promise<T> {
    const headers = await this.buildHeaders('GET');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';
    try {
      const response = await this.config.httpAdapter.request<T>({ method: 'GET', url: path, headers, credentials });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.buildHeaders('POST');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';
    try {
      const response = await this.config.httpAdapter.request<T>({
        method: 'POST',
        url: path,
        headers,
        body,
        credentials,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.buildHeaders('PATCH');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';
    try {
      const response = await this.config.httpAdapter.request<T>({
        method: 'PATCH',
        url: path,
        headers,
        body,
        credentials,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async delete<T>(path: string): Promise<T> {
    const headers = await this.buildHeaders('DELETE');
    const credentials = this.config.tokenDelivery === 'cookies' ? 'include' : 'omit';
    try {
      const response = await this.config.httpAdapter.request<T>({
        method: 'DELETE',
        url: path,
        headers,
        credentials,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): NAuthClientError {
    if (error instanceof NAuthClientError) {
      return error;
    }
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { status?: number; data?: unknown } };
      const status = httpError.response?.status ?? 500;
      const errorData =
        typeof httpError.response?.data === 'object' && httpError.response.data !== null
          ? (httpError.response.data as Record<string, unknown>)
          : {};
      const code =
        typeof errorData['code'] === 'string' ? (errorData['code'] as NAuthErrorCode) : NAuthErrorCode.INTERNAL_ERROR;
      const message =
        typeof errorData['message'] === 'string'
          ? (errorData['message'] as string)
          : `Request failed with status ${status}`;
      return new NAuthClientError(code, message, { statusCode: status, details: errorData });
    }
    return new NAuthClientError(
      NAuthErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
