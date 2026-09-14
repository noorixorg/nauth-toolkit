import { OAuthClient, OAuthConfig, OAuthUserProfile, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
import { ENTRA_USERINFO_ENDPOINT, authorizeEndpoint, isValidTenant, tokenEndpoint } from './entra-tenant';

/**
 * Microsoft token endpoint response.
 */
interface MicrosoftTokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * Microsoft error response, shared by the token endpoint and Graph.
 */
interface MicrosoftErrorResponse {
  error?: string;
  error_description?: string;
}

/**
 * Response from Microsoft's OIDC userinfo endpoint.
 */
interface MicrosoftUserInfoResponse {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

/**
 * Configuration for the Microsoft OAuth client.
 */
export interface MicrosoftOAuthConfig extends OAuthConfig {
  /**
   * Tenant segment of the authority URL: a directory GUID, a verified domain, or one of
   * `common` / `organizations` / `consumers`.
   */
  tenant: string;
}

/**
 * Microsoft OAuth Client Implementation (Platform-Agnostic)
 *
 * Handles the OAuth 2.0 authorization code flow against the Microsoft identity platform
 * v2.0 endpoints, which serve both personal Microsoft accounts and Entra ID work or
 * school accounts depending on the configured tenant.
 *
 * Every endpoint is derived from `tenant`, so a deployment pinned to one organisation
 * never talks to the multi-tenant authority.
 *
 * This is a plain TypeScript class with no framework dependencies.
 *
 * @example
 * ```typescript
 * const client = new MicrosoftOAuthClient({
 *   clientId: 'app-registration-client-id',
 *   clientSecret: 'client-secret',
 *   redirectUri: 'https://myapp.com/auth/social/microsoft/callback',
 *   tenant: 'common',
 * });
 *
 * const tokens = await client.exchangeCodeForToken(code, redirectUri);
 * ```
 */
export class MicrosoftOAuthClient implements OAuthClient {
  private readonly config: MicrosoftOAuthConfig;
  private readonly tokenEndpoint: string;
  private readonly authorizeEndpoint: string;

  constructor(config: MicrosoftOAuthConfig) {
    if (!isValidTenant(config.tenant)) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Invalid Microsoft tenant '${config.tenant}'. Expected a tenant GUID, a verified domain, or one of: common, organizations, consumers.`,
      );
    }

    this.config = {
      scopes: ['openid', 'email', 'profile'],
      ...config,
    };
    this.tokenEndpoint = tokenEndpoint(config.tenant);
    this.authorizeEndpoint = authorizeEndpoint(config.tenant);
  }

  /**
   * Exchange an authorization code for tokens.
   *
   * The `id_token` is the part this provider actually depends on — every identity and
   * access-gate decision is made from its claims — so it is returned alongside the
   * access token rather than discarded.
   *
   * @param code - Authorization code from the Microsoft OAuth callback
   * @param redirectUri - Redirect URI used in the OAuth flow
   * @returns Access token, ID token, and optional refresh token
   * @throws {NAuthException} When the token exchange fails
   *
   * @example
   * ```typescript
   * const tokens = await client.exchangeCodeForToken(code, redirectUri);
   * console.log(tokens.idToken);
   * ```
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: this.config.scopes?.join(' ') || 'openid email profile',
    });

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as MicrosoftErrorResponse;
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Token exchange failed: ${errorData.error_description || errorData.error}`,
        );
      }

      const data = (await response.json()) as MicrosoftTokenResponse;

      return {
        accessToken: data.access_token,
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      if (error instanceof NAuthException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new NAuthException(
          AuthErrorCode.SOCIAL_TOKEN_INVALID,
          `Microsoft token exchange failed: ${error.message}`,
        );
      }
      throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Microsoft token exchange failed: Unknown error');
    }
  }

  /**
   * Get a user profile from Microsoft's OIDC userinfo endpoint.
   *
   * Present to satisfy the `OAuthClient` contract and available for callers that hold
   * only an access token. The redirect flow does not use it — it reads the verified ID
   * token instead, because userinfo carries neither `tid` nor the claims the access gate
   * depends on.
   *
   * @param accessToken - OAuth access token
   * @returns User profile data
   * @throws {NAuthException} When the API call fails or the token is invalid
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await fetch(ENTRA_USERINFO_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new NAuthException(AuthErrorCode.SOCIAL_TOKEN_INVALID, 'Invalid or expired access token');
        }
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          `Microsoft userinfo call failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as MicrosoftUserInfoResponse;

      return {
        id: data.sub,
        email: data.email || null,
        // ?? not ||: preserve "" from provider (|| would coerce to null)
        firstName: data.given_name ?? null,
        lastName: data.family_name ?? null,
        picture: data.picture || null,
        // userinfo carries no tenant context, so email ownership cannot be established here
        verified: false,
        raw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (error instanceof NAuthException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, `Microsoft profile fetch failed: ${error.message}`);
      }
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Microsoft profile fetch failed: Unknown error');
    }
  }

  /**
   * Generate the Microsoft OAuth authorization URL.
   *
   * @param state - Optional state parameter for CSRF protection
   * @param oauthParams - Optional OAuth parameters to append to the URL
   * @returns Authorization URL to redirect the user to
   *
   * @example
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('random-state');
   * ```
   *
   * @example With OAuth params
   * ```typescript
   * const authUrl = client.getAuthorizationUrl('state', { prompt: 'select_account' });
   * ```
   */
  getAuthorizationUrl(state?: string, oauthParams?: Record<string, string>): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes?.join(' ') || 'openid email profile',
      response_type: 'code',
      response_mode: 'query',
    });

    if (state) {
      params.append('state', state);
    }

    // Apply additional OAuth params (from config or per-request)
    if (oauthParams) {
      Object.entries(oauthParams).forEach(([key, value]) => {
        params.append(key, value);
      });
    }

    return `${this.authorizeEndpoint}?${params.toString()}`;
  }
}
