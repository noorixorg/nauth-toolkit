/**
 * Single logout.
 *
 * The provider keeps its own SSO session alongside nauth's. Without terminating it,
 * signing out of the application leaves that session standing and the next
 * authorization request silently issues a fresh code for a user who believes they
 * signed out.
 */
import { MemoryStorageAdapter } from '@nauth-toolkit/core';
import type { AdapterPayload } from 'oidc-provider';
import { createOIDCStorageAdapter, NAuthOIDCAdapter } from './storage.adapter';
import { OIDCSessionTerminator } from './session-termination';

describe('OIDCSessionTerminator', () => {
  let storage: MemoryStorageAdapter;
  let factory: (name: string) => NAuthOIDCAdapter;
  let terminator: OIDCSessionTerminator;

  const payload = (over: Partial<AdapterPayload>): AdapterPayload =>
    ({ jti: 'x', iat: 1, exp: 2, ...over }) as AdapterPayload;

  /** Give a user a session, a grant, and a live token pair. */
  const seed = async (sub: string): Promise<void> => {
    await factory('Session').upsert(`s-${sub}`, payload({ kind: 'Session', accountId: sub, uid: `u-${sub}` }), 60);
    await factory('Grant').upsert(`g-${sub}`, payload({ kind: 'Grant', accountId: sub }), 60);
    await factory('AccessToken').upsert(`at-${sub}`, payload({ kind: 'AccessToken', accountId: sub }), 60);
    await factory('RefreshToken').upsert(`rt-${sub}`, payload({ kind: 'RefreshToken', accountId: sub }), 60);
  };

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    await storage.initialize();
    factory = createOIDCStorageAdapter(storage) as (name: string) => NAuthOIDCAdapter;
    terminator = new OIDCSessionTerminator(storage);
  });

  afterEach(async () => {
    await storage.disconnect();
  });

  it('destroys the sessions and grants of the named user only', async () => {
    await seed('sub-1');
    await seed('sub-2');

    const result = await terminator.terminateFor('sub-1');

    expect(result).toEqual({ sessions: 1, grants: 1 });
    await expect(factory('Session').find('s-sub-1')).resolves.toBeUndefined();
    await expect(factory('Grant').find('g-sub-1')).resolves.toBeUndefined();

    // Everyone else is untouched.
    await expect(factory('Session').find('s-sub-2')).resolves.toMatchObject({ accountId: 'sub-2' });
    await expect(factory('Grant').find('g-sub-2')).resolves.toMatchObject({ accountId: 'sub-2' });
  });

  it('leaves tokens already issued to clients alone', async () => {
    await seed('sub-1');
    await terminator.terminateFor('sub-1');

    // A third party holding a valid access token should not lose it because the user
    // closed a browser tab. Those expire, or are revoked explicitly.
    await expect(factory('AccessToken').find('at-sub-1')).resolves.toMatchObject({ kind: 'AccessToken' });
    await expect(factory('RefreshToken').find('rt-sub-1')).resolves.toMatchObject({ kind: 'RefreshToken' });
  });

  it('revokes tokens too when the stronger form is used', async () => {
    await seed('sub-1');
    await seed('sub-2');

    const result = await terminator.terminateAndRevokeFor('sub-1');

    expect(result).toMatchObject({ sessions: 1, grants: 1, accessTokens: 1, refreshTokens: 1 });
    await expect(factory('AccessToken').find('at-sub-1')).resolves.toBeUndefined();
    await expect(factory('RefreshToken').find('rt-sub-1')).resolves.toBeUndefined();

    await expect(factory('AccessToken').find('at-sub-2')).resolves.toMatchObject({ kind: 'AccessToken' });
  });

  it('is harmless for a user with nothing outstanding', async () => {
    await expect(terminator.terminateFor('never-signed-in')).resolves.toEqual({ sessions: 0, grants: 0 });
  });
});
