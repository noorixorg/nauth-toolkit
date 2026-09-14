/**
 * Entra ID tenant helpers
 *
 * The `tenant` segment of a Microsoft authority URL decides which population may sign
 * in. Every endpoint this package talks to is derived from it, and several security
 * checks depend on telling a pinned single-tenant deployment apart from a multi-tenant
 * one, so the logic lives in one place.
 */

/**
 * Well-known tenant id carried by personal Microsoft accounts (outlook.com, hotmail.com,
 * live.com) — as opposed to work or school accounts, which carry their own directory's id.
 *
 * Microsoft documents this GUID as stable. It is the only reliable way to tell the two
 * populations apart when `tenant` is `common`.
 */
export const MSA_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

/**
 * Base of the Microsoft identity platform.
 */
export const ENTRA_AUTHORITY_HOST = 'https://login.microsoftonline.com';

/**
 * Microsoft's standards-compliant OIDC userinfo endpoint.
 *
 * Unlike Graph's `/v1.0/me`, this needs only `openid`/`profile`/`email` and no
 * `User.Read` permission grant.
 */
export const ENTRA_USERINFO_ENDPOINT = 'https://graph.microsoft.com/oidc/userinfo';

/**
 * The non-GUID tenant values Microsoft accepts in an authority URL.
 *
 * - `common` — work/school accounts from any directory **and** personal accounts
 * - `organizations` — work/school accounts from any directory
 * - `consumers` — personal accounts only
 */
export type EntraTenantAlias = 'common' | 'organizations' | 'consumers';

const TENANT_ALIASES: readonly string[] = ['common', 'organizations', 'consumers'];

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a configured tenant value is a specific directory id rather than an alias.
 *
 * A GUID means the deployment is pinned to exactly one organisation, which is what makes
 * email-based auto-linking safe and lets the issuer be validated up front.
 *
 * @param tenant - Configured tenant value
 * @returns True when the value is a tenant GUID
 *
 * @example
 * ```typescript
 * isTenantGuid('9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f'); // true
 * isTenantGuid('common');                               // false
 * ```
 */
export function isTenantGuid(tenant: string): boolean {
  return GUID_PATTERN.test(tenant);
}

/**
 * Whether a configured tenant value is one of Microsoft's aliases.
 *
 * @param tenant - Configured tenant value
 * @returns True when the value is `common`, `organizations` or `consumers`
 */
export function isTenantAlias(tenant: string): tenant is EntraTenantAlias {
  return TENANT_ALIASES.includes(tenant);
}

/**
 * Whether a tenant value is accepted by this package.
 *
 * Microsoft also accepts a verified domain name (`contoso.onmicrosoft.com`) in the
 * authority, so that form is permitted too.
 *
 * @param tenant - Configured tenant value
 * @returns True when the value can be used to build an authority URL
 */
export function isValidTenant(tenant: string): boolean {
  if (isTenantAlias(tenant) || isTenantGuid(tenant)) return true;
  // A verified domain, e.g. 'contoso.onmicrosoft.com'.
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i.test(tenant);
}

/**
 * Build the OAuth 2.0 authorization endpoint for a tenant.
 *
 * @param tenant - Configured tenant value
 * @returns Fully qualified v2.0 authorize endpoint
 */
export function authorizeEndpoint(tenant: string): string {
  return `${ENTRA_AUTHORITY_HOST}/${tenant}/oauth2/v2.0/authorize`;
}

/**
 * Build the OAuth 2.0 token endpoint for a tenant.
 *
 * @param tenant - Configured tenant value
 * @returns Fully qualified v2.0 token endpoint
 */
export function tokenEndpoint(tenant: string): string {
  return `${ENTRA_AUTHORITY_HOST}/${tenant}/oauth2/v2.0/token`;
}

/**
 * Build the JWKS endpoint used to verify ID token signatures.
 *
 * For a pinned tenant this returns that directory's key set. For the aliases it returns
 * the `common` key set, which serves the signing keys used across directories — the
 * per-directory check is then done on the issuer, not on the key source.
 *
 * @param tenant - Configured tenant value
 * @returns Fully qualified v2.0 JWKS endpoint
 */
export function jwksEndpoint(tenant: string): string {
  const segment = isTenantGuid(tenant) ? tenant : 'common';
  return `${ENTRA_AUTHORITY_HOST}/${segment}/discovery/v2.0/keys`;
}

/**
 * The issuer a v2.0 token from a given directory must carry.
 *
 * With a multi-tenant authority a valid signature proves only that *some* Microsoft
 * directory issued the token. Binding `iss` to the token's own `tid` is what turns that
 * into a statement about which directory, and is a prerequisite for trusting `tid` in
 * any access decision.
 *
 * @param tid - Directory id from the token's `tid` claim
 * @returns The expected `iss` value
 *
 * @example
 * ```typescript
 * expectedIssuer('9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f');
 * // 'https://login.microsoftonline.com/9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f/v2.0'
 * ```
 */
export function expectedIssuer(tid: string): string {
  return `${ENTRA_AUTHORITY_HOST}/${tid}/v2.0`;
}

/**
 * Whether a directory id belongs to the personal-Microsoft-account population.
 *
 * @param tid - Directory id from the token's `tid` claim
 * @returns True for personal accounts, false for work or school accounts
 */
export function isPersonalAccountTenant(tid: string): boolean {
  return tid.toLowerCase() === MSA_TENANT_ID;
}
