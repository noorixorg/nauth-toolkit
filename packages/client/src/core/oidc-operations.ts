import { ResolvedNAuthClientConfig } from './config';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';
import type { NAuthStorageAdapter } from '../storage/interface';
import type { OIDCInteractionState, OIDCInteractionRedirect, OIDCConsentDecision } from '../types/oidc.types';

const hasWindow = (): boolean =>
  typeof globalThis !== 'undefined' && typeof (globalThis as { window?: unknown }).window !== 'undefined';

/** Storage key holding the interaction to return to after a login detour. */
export const PENDING_INTERACTION_KEY = 'nauth_pending_interaction';

/** Frontend route that renders the consent screen, when none is configured. */
export const DEFAULT_INTERACTION_ROUTE = '/interaction';

/**
 * OpenID Connect interaction operations. Accessed via `client.oidc.*`.
 *
 * These drive the consent screen of an application that *is* an OpenID Connect
 * provider — one running `@nauth-toolkit/oidc-provider`. A relying party signing in
 * with someone else's provider needs none of this; use an OIDC client library.
 *
 * Calls the interaction routes your backend mounts. With NestJS those are shipped by
 * `OIDCProviderModule.forRoot()` and default to `/oidc/interaction`, which is what
 * `basePath` assumes; point `oidc.basePath` elsewhere if you moved them.
 *
 * Every method answers with a `redirectTo` rather than following a redirect itself,
 * because the browser has to leave the single-page app entirely at that point:
 * `window.location.assign(redirectTo)`, not `router.navigate`.
 *
 * @example
 * ```typescript
 * const state = await client.oidc.getInteraction(uid);
 *
 * if (state.gate === 'login_required') {
 *   await client.oidc.setPendingInteraction(uid);
 *   router.navigate(['/login']);
 * } else if (state.prompt === 'login') {
 *   const { redirectTo } = await client.oidc.completeLogin(uid);
 *   window.location.assign(redirectTo);
 * }
 * ```
 */
export class OIDCOperations {
  private readonly config: ResolvedNAuthClientConfig;
  private readonly storage: NAuthStorageAdapter;
  private readonly basePath: string;

  /** Frontend route rendering the consent screen, with the id appended. */
  readonly interactionPath: string;

  /**
   * @param config - Resolved client configuration
   * @param storage - Ephemeral (session-scoped) storage for the pending interaction
   * @param basePath - Base path for the interaction routes (default: `{baseUrl}/oidc/interaction`)
   */
  constructor(config: ResolvedNAuthClientConfig, storage: NAuthStorageAdapter, basePath?: string) {
    this.config = config;
    this.storage = storage;
    this.basePath = basePath ?? config.oidc?.basePath ?? `${config.baseUrl}/oidc/interaction`;
    this.interactionPath = config.oidc?.interactionPath ?? DEFAULT_INTERACTION_ROUTE;
  }

  /**
   * The in-app route that renders the consent screen for a given interaction.
   *
   * One place for the convention, so a route guard, a navigation handler and a
   * component all agree on where the consent screen lives.
   *
   * @param uid - The pending interaction id
   * @returns A route path such as `/interaction/abc123`
   */
  interactionRoute(uid: string): string {
    return `${this.interactionPath.replace(/\/$/, '')}/${encodeURIComponent(uid)}`;
  }

  /**
   * Read a pending interaction, so the page can decide what to render.
   *
   * Answers for a signed-out caller too — a `login_required` gate is precisely the
   * signal to send the user through login.
   *
   * @param uid - The pending interaction id, from the route the provider redirected to
   * @returns What the request needs, and nauth's verdict on the current session
   */
  async getInteraction(uid: string): Promise<OIDCInteractionState> {
    return this.get<OIDCInteractionState>(this.url(uid));
  }

  /**
   * Complete the login step for the currently authenticated user.
   *
   * Used when `getInteraction` reports `prompt === 'login'` and the gate is
   * `authenticated`: nothing needs showing, the interaction just needs resolving.
   *
   * @param uid - The pending interaction id
   * @returns Where to send the browser to resume the authorization request
   */
  async completeLogin(uid: string): Promise<OIDCInteractionRedirect> {
    return this.post<OIDCInteractionRedirect>(this.url(uid, 'login'), {});
  }

  /**
   * Grant the client what it asked for.
   *
   * @param uid - The pending interaction id
   * @param scopes - A narrowed set of scopes to grant; omit to grant everything asked for
   * @returns Where to send the browser next
   */
  async approve(uid: string, scopes?: string[]): Promise<OIDCInteractionRedirect> {
    const body: OIDCConsentDecision & { approve: true } = { approve: true };
    if (scopes) {
      body.scopes = scopes;
    }
    return this.post<OIDCInteractionRedirect>(this.url(uid, 'confirm'), body);
  }

  /**
   * Refuse the request. The client is told `access_denied`.
   *
   * @param uid - The pending interaction id
   * @returns Where to send the browser next
   */
  async deny(uid: string): Promise<OIDCInteractionRedirect> {
    return this.post<OIDCInteractionRedirect>(this.url(uid, 'confirm'), { approve: false });
  }

  /**
   * Abandon a pending interaction, so the client gets a clean protocol error rather
   * than waiting on a browser tab that is never coming back.
   *
   * @param uid - The pending interaction id
   * @returns Where to send the browser
   */
  async abort(uid: string): Promise<OIDCInteractionRedirect> {
    return this.post<OIDCInteractionRedirect>(this.url(uid, 'abort'), {});
  }

  // ==========================================================================
  // The login detour
  // ==========================================================================

  /**
   * Remember an interaction to return to once the user has finished logging in.
   *
   * Stored in session-scoped storage rather than a query parameter, because the login
   * that follows may run several challenge steps — forced password change, email or
   * phone verification, MFA setup — each with its own URL. A query parameter does not
   * survive that; this does.
   *
   * @param uid - The pending interaction id
   */
  async setPendingInteraction(uid: string): Promise<void> {
    try {
      await this.storage.setItem(PENDING_INTERACTION_KEY, uid);
    } catch {
      // Non-fatal: storage can be unavailable (private browsing, blocked site data).
    }
  }

  /**
   * The interaction waiting to be resumed, if any.
   *
   * @returns The pending interaction id, or null
   */
  async getPendingInteraction(): Promise<string | null> {
    try {
      return await this.storage.getItem(PENDING_INTERACTION_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Forget the pending interaction.
   *
   * Call this once you have acted on it, so a later visit to the same page is not
   * diverted a second time.
   */
  async clearPendingInteraction(): Promise<void> {
    try {
      await this.storage.removeItem(PENDING_INTERACTION_KEY);
    } catch {
      // Non-fatal, as above.
    }
  }

  /**
   * Take the pending interaction and forget it in one step.
   *
   * The read-then-clear a navigation handler or route guard wants: whoever gets the id
   * owns the resumption, and no one else is sent there afterwards.
   *
   * @returns The pending interaction id, or null
   */
  async takePendingInteraction(): Promise<string | null> {
    const uid = await this.getPendingInteraction();
    if (uid) {
      await this.clearPendingInteraction();
    }
    return uid;
  }

  // ==========================================================================
  // Internal request helpers (mirror ApiKeyOperations)
  // ==========================================================================

  private url(uid: string, action?: string): string {
    const base = `${this.basePath}/${encodeURIComponent(uid)}`;
    return action ? `${base}/${action}` : base;
  }

  private async buildHeaders(method: 'GET' | 'POST'): Promise<Record<string, string>> {
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

    if (this.config.tokenDelivery === 'cookies' && hasWindow() && method === 'POST') {
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
