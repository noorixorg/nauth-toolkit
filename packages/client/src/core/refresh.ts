import { TokenResponse } from '../types/auth.types';
import { NAuthStorageAdapter } from '../types/config.types';
import { NAuthClientError } from './errors';
import { NAuthErrorCode } from '../types/error.types';

const ACCESS_TOKEN_KEY = 'nauth_access_token';
const REFRESH_TOKEN_KEY = 'nauth_refresh_token';
const ACCESS_EXPIRES_AT_KEY = 'nauth_access_token_expires_at';
const REFRESH_EXPIRES_AT_KEY = 'nauth_refresh_token_expires_at';
const USER_KEY = 'nauth_user';
const CHALLENGE_KEY = 'nauth_challenge_session';

/**
 * Token state persisted in storage.
 */
export interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt?: number | null;
  refreshTokenExpiresAt?: number | null;
}

/**
 * Manage token persistence and refresh queuing.
 */
export class TokenManager {
  private readonly storage: NAuthStorageAdapter;
  private refreshPromise: Promise<TokenResponse> | null = null;
  private readonly isBrowser = typeof window !== 'undefined';

  /**
   * @param storage - storage adapter
   */
  constructor(storage: NAuthStorageAdapter) {
    this.storage = storage;
  }

  /**
   * Load tokens from storage.
   */
  async getTokens(): Promise<TokenState> {
    const [accessToken, refreshToken, accessExpRaw, refreshExpRaw] = await Promise.all([
      this.storage.getItem(ACCESS_TOKEN_KEY),
      this.storage.getItem(REFRESH_TOKEN_KEY),
      this.storage.getItem(ACCESS_EXPIRES_AT_KEY),
      this.storage.getItem(REFRESH_EXPIRES_AT_KEY),
    ]);
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessExpRaw ? Number(accessExpRaw) : null,
      refreshTokenExpiresAt: refreshExpRaw ? Number(refreshExpRaw) : null,
    };
  }

  /**
   * Persist tokens.
   *
   * @param tokens - new token pair
   */
  async setTokens(tokens: TokenResponse): Promise<void> {
    await Promise.all([
      this.storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
      this.storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
      this.storage.setItem(ACCESS_EXPIRES_AT_KEY, tokens.accessTokenExpiresAt.toString()),
      this.storage.setItem(REFRESH_EXPIRES_AT_KEY, tokens.refreshTokenExpiresAt.toString()),
    ]);
    this.broadcastStorage();
  }

  /**
   * Clear tokens and related auth state.
   */
  async clearTokens(): Promise<void> {
    await Promise.all([
      this.storage.removeItem(ACCESS_TOKEN_KEY),
      this.storage.removeItem(REFRESH_TOKEN_KEY),
      this.storage.removeItem(ACCESS_EXPIRES_AT_KEY),
      this.storage.removeItem(REFRESH_EXPIRES_AT_KEY),
      this.storage.removeItem(USER_KEY),
      this.storage.removeItem(CHALLENGE_KEY),
    ]);
    this.broadcastStorage();
  }

  /**
   * Ensure only one refresh in flight.
   *
   * @param refreshFn - function performing refresh request
   */
  async refreshOnce(refreshFn: () => Promise<TokenResponse>): Promise<TokenResponse> {
    if (!this.refreshPromise) {
      this.refreshPromise = refreshFn()
        .then(async (tokens) => {
          await this.setTokens(tokens);
          return tokens;
        })
        .catch((error) => {
          throw error;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  /**
   * Validate that a refresh token exists before attempting refresh.
   */
  async assertHasRefreshToken(): Promise<void> {
    const state = await this.getTokens();
    if (!state.refreshToken) {
      throw new NAuthClientError(NAuthErrorCode.AUTH_SESSION_NOT_FOUND, 'No refresh token available');
    }
  }

  /**
   * Broadcast a no-op write to trigger storage listeners in other tabs.
   */
  private broadcastStorage(): void {
    if (!this.isBrowser) return;
    try {
      window.localStorage.setItem('nauth_sync', Date.now().toString());
    } catch {
      // Best-effort; ignore if storage unavailable
    }
  }
}
