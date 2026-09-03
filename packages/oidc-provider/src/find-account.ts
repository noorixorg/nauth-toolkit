import type { AccountClaims } from 'oidc-provider';
import type { Repository } from 'typeorm';
import type { BaseUser } from '@nauth-toolkit/core';

/** Claims released for the `profile` scope, per OIDC Core §5.4. */
type ProfileClaims = {
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  updated_at?: number;
};

/**
 * The shape `oidc-provider` expects back from `findAccount`.
 */
export interface OIDCAccount {
  accountId: string;
  claims(use: string, scope: string): Promise<AccountClaims>;
  /** `oidc-provider` allows arbitrary extra account properties. */
  [key: string]: unknown;
}

/**
 * Build the `findAccount` function that resolves an nauth user for `oidc-provider`.
 *
 * This is one of only two seams between nauth and the provider, and it is a pure data
 * lookup — no HTTP, no request context. The account identifier is the user's external
 * `sub`, never the internal row id.
 *
 * Claims are released strictly by granted scope: `sub` always, email claims only for
 * `email`, name claims only for `profile`, phone claims only for `phone`. A client
 * therefore never learns more about a user than it was consented to.
 *
 * @param userRepository - nauth's user repository
 * @returns A `findAccount` implementation for the provider configuration
 *
 * @example
 * ```typescript
 * new Provider(issuer, { findAccount: createFindAccount(userRepository) });
 * ```
 */
export function createFindAccount(
  userRepository: Repository<BaseUser>,
): (ctx: unknown, sub: string) => Promise<OIDCAccount | undefined> {
  return async (_ctx: unknown, sub: string): Promise<OIDCAccount | undefined> => {
    const user = await userRepository.findOne({ where: { sub } });

    // A disabled or deleted account resolves to nothing, so the provider drops the
    // session rather than minting tokens for it.
    if (!user || !user.isActive) {
      return undefined;
    }

    return {
      accountId: user.sub,
      async claims(_use: string, scope: string): Promise<AccountClaims> {
        const scopes = new Set((scope ?? '').split(/\s+/).filter(Boolean));
        const claims: AccountClaims = { sub: user.sub };

        if (scopes.has('email')) {
          claims.email = user.email;
          claims.email_verified = user.isEmailVerified;
        }

        if (scopes.has('profile')) {
          const profile: ProfileClaims = {};
          const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
          if (full) {
            profile.name = full;
          }
          if (user.firstName) {
            profile.given_name = user.firstName;
          }
          if (user.lastName) {
            profile.family_name = user.lastName;
          }
          if (user.username) {
            profile.preferred_username = user.username;
          }
          if (user.updatedAt) {
            profile.updated_at = Math.floor(new Date(user.updatedAt).getTime() / 1000);
          }
          Object.assign(claims, profile);
        }

        if (scopes.has('phone') && user.phone) {
          claims.phone_number = user.phone;
          claims.phone_number_verified = user.isPhoneVerified;
        }

        return claims;
      },
    };
  };
}
