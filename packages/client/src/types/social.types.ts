/**
 * Social provider identifiers.
 */
export type SocialProvider = 'google' | 'apple' | 'facebook';

/**
 * Request to obtain social auth URL.
 */
export interface SocialAuthUrlRequest {
  provider: SocialProvider;
  state?: string;
}

/**
 * Response containing social auth URL.
 */
export interface SocialAuthUrlResponse {
  url: string;
}

/**
 * Social callback parameters.
 */
export interface SocialCallbackRequest {
  provider: SocialProvider;
  code: string;
  state: string;
}

/**
 * Linked social accounts response.
 */
export interface LinkedAccountsResponse {
  providers: SocialProvider[];
}

/**
 * Native social verification request (mobile).
 */
export interface SocialVerifyRequest {
  provider: SocialProvider;
  idToken?: string;
  accessToken?: string;
  authorizationCode?: string;
}
