/**
 * Types for driving an OpenID Connect interaction from the browser.
 *
 * These mirror what `@nauth-toolkit/oidc-provider`'s interaction bridge returns. They
 * are only needed by an application that hosts the consent screen for its own OpenID
 * Connect provider — a relying party signing in *with* such a provider uses an OIDC
 * client library instead.
 */

/**
 * nauth's verdict on the session behind an interaction request.
 *
 * - `authenticated` — a completed login stands behind the request
 * - `login_required` — recoverable: send the user through login and come back
 * - `denied` — the account may not be issued credentials at all
 */
export type OIDCGateStatus = 'authenticated' | 'login_required' | 'denied';

/** The client application an authorization request is being made on behalf of. */
export interface OIDCInteractionClient {
  /** Public client identifier. */
  clientId: string;
  /** Human-readable name, when the client registered one. */
  clientName?: string;
  /** Logo to show on the consent screen. */
  logoUri?: string;
  /** The client's home page. */
  clientUri?: string;
}

/** What the consent screen needs in order to ask the user. */
export interface OIDCInteractionState {
  /** The pending interaction id. */
  uid: string;
  /** What the provider is asking for: a login, or consent for scopes. */
  prompt: 'login' | 'consent' | string;
  /** The client making the request, as the user should see it. */
  client: OIDCInteractionClient;
  /** Scopes the client asked for. */
  scopes: string[];
  /** Scopes still needing consent — the rest are already granted. */
  missingScopes: string[];
  /** nauth's verdict on the current session. */
  gate: OIDCGateStatus;
  /** Why, when the gate is not `authenticated`. */
  gateReason?: string;
  /** External identifier of the signed-in user, when there is one. */
  sub?: string;
}

/** Where to send the browser after a decision. */
export interface OIDCInteractionRedirect {
  /** Absolute URL to navigate to. Leave the SPA — the provider takes over from here. */
  redirectTo: string;
}

/** The user's answer to a consent screen. */
export interface OIDCConsentDecision {
  /** A narrowed set of scopes to grant. Omit to grant everything that was asked for. */
  scopes?: string[];
}
