/**
 * Account resolution and claim release.
 *
 * The security property under test is that a client never receives more about a user
 * than the granted scopes allow.
 */
import type { Repository } from 'typeorm';
import type { BaseUser } from '@nauth-toolkit/core';
import { createFindAccount } from './find-account';

const makeUser = (over: Partial<BaseUser> = {}): BaseUser =>
  ({
    id: 1,
    sub: 'sub-uuid',
    email: 'ada@example.com',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '+15550001111',
    isEmailVerified: true,
    isPhoneVerified: true,
    isActive: true,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }) as unknown as BaseUser;

const repoFor = (user: BaseUser | null): Repository<BaseUser> =>
  ({ findOne: async () => user }) as unknown as Repository<BaseUser>;

describe('createFindAccount', () => {
  it('resolves an active user by sub', async () => {
    const account = await createFindAccount(repoFor(makeUser()))({}, 'sub-uuid');
    expect(account?.accountId).toBe('sub-uuid');
  });

  it('does not resolve an unknown user', async () => {
    await expect(createFindAccount(repoFor(null))({}, 'nope')).resolves.toBeUndefined();
  });

  it('does not resolve a deactivated user, so no tokens can be minted for them', async () => {
    const account = await createFindAccount(repoFor(makeUser({ isActive: false })))({}, 'sub-uuid');
    expect(account).toBeUndefined();
  });

  it('releases only sub for the openid scope', async () => {
    const account = await createFindAccount(repoFor(makeUser()))({}, 'sub-uuid');
    await expect(account?.claims('id_token', 'openid')).resolves.toEqual({ sub: 'sub-uuid' });
  });

  it('releases email claims only with the email scope', async () => {
    const account = await createFindAccount(repoFor(makeUser()))({}, 'sub-uuid');
    const claims = await account?.claims('id_token', 'openid email');

    expect(claims).toMatchObject({ email: 'ada@example.com', email_verified: true });
    expect(claims?.given_name).toBeUndefined();
    expect(claims?.phone_number).toBeUndefined();
  });

  it('releases name claims only with the profile scope', async () => {
    const account = await createFindAccount(repoFor(makeUser()))({}, 'sub-uuid');
    const claims = await account?.claims('id_token', 'openid profile');

    expect(claims).toMatchObject({
      name: 'Ada Lovelace',
      given_name: 'Ada',
      family_name: 'Lovelace',
      preferred_username: 'ada',
    });
    expect(claims?.email).toBeUndefined();
  });

  it('releases phone claims only with the phone scope', async () => {
    const account = await createFindAccount(repoFor(makeUser()))({}, 'sub-uuid');
    const claims = await account?.claims('id_token', 'openid phone');

    expect(claims).toMatchObject({ phone_number: '+15550001111', phone_number_verified: true });
    expect(claims?.email).toBeUndefined();
  });

  it('omits name claims the user has not set rather than emitting empty strings', async () => {
    const account = await createFindAccount(
      repoFor(makeUser({ firstName: null, lastName: null, username: null } as Partial<BaseUser>)),
    )({}, 'sub-uuid');
    const claims = await account?.claims('id_token', 'openid profile');

    expect(claims).toEqual({ sub: 'sub-uuid', updated_at: expect.any(Number) });
  });

  it('tolerates an empty scope string', async () => {
    const account = await createFindAccount(repoFor(makeUser()))({}, 'sub-uuid');
    await expect(account?.claims('id_token', '')).resolves.toEqual({ sub: 'sub-uuid' });
  });
});
