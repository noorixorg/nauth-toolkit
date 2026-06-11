import {
  FetchAdapter,
  NAuthClientError,
  type HttpAdapter,
  type HttpRequest,
  type HttpResponse,
  type NAuthClient,
} from '@nauth-toolkit/client';

/**
 * HTTP adapter that wraps FetchAdapter and adds automatic 401-triggered token refresh.
 *
 * Why this exists:
 * The SDK's built-in request methods (get, post, etc.) explicitly delegate 401 handling
 * to "framework interceptors (Angular) or manually". The FetchAdapter makes a single
 * request and throws NAuthClientError on non-2xx — it does not retry after refresh.
 *
 * How it works:
 * 1. Makes the request via FetchAdapter.
 * 2. If the response is 401 and the failing URL is not the refresh endpoint:
 *    - Calls client.refreshTokens() (in cookies mode the browser sends the httpOnly
 *      refresh cookie; the server sets new access/refresh cookies in the response).
 *    - Multiple concurrent 401s share a single in-flight refresh promise so only
 *      one refresh request hits the backend.
 *    - After refresh, retries the original request exactly once.
 * 3. If refresh fails (session truly expired), the SDK emits auth:session_expired,
 *    which our AuthContext listener catches to clear user state and let ProtectedRoute
 *    redirect to /login.
 *
 * Circular dependency is broken via setClient() — call it once after NAuthClient
 * is constructed.
 */
export class RefreshingFetchAdapter implements HttpAdapter {
  private readonly inner = new FetchAdapter();
  private client: NAuthClient | null = null;
  private refreshPromise: Promise<void> | null = null;

  /** Wire up the client after construction to avoid circular dependency. */
  setClient(client: NAuthClient): void {
    this.client = client;
  }

  async request<T>(config: HttpRequest): Promise<HttpResponse<T>> {
    try {
      return await this.inner.request<T>(config);
    } catch (err) {
      const is401 = err instanceof NAuthClientError && err.statusCode === 401;
      const isRefreshEndpoint = config.url.includes('/refresh');
      const canRefresh = this.client !== null;

      if (is401 && !isRefreshEndpoint && canRefresh) {
        await this.doRefresh();
        // Retry once — new auth cookies are already set by the browser after refresh.
        return this.inner.request<T>(config);
      }

      throw err;
    }
  }

  /**
   * Ensures only one refresh request is in flight at a time.
   * Concurrent callers await the same promise.
   */
  private doRefresh(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.client!
        .refreshTokens()
        .then(() => undefined)
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }
}
