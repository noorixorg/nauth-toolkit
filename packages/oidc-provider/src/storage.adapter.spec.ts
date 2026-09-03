/**
 * Storage adapter conformance.
 *
 * Runs against the real `MemoryStorageAdapter` rather than a mock, because the whole
 * point of this adapter is that nauth's storage primitives are sufficient — a mock
 * would assert the design rather than test it.
 */
import { MemoryStorageAdapter } from '@nauth-toolkit/core';
import type { AdapterPayload } from 'oidc-provider';
import { createOIDCStorageAdapter, NAuthOIDCAdapter } from './storage.adapter';

describe('NAuthOIDCAdapter', () => {
  let storage: MemoryStorageAdapter;
  let factory: (name: string) => NAuthOIDCAdapter;

  const payload = (over: Partial<AdapterPayload> = {}): AdapterPayload =>
    ({ jti: 'x', kind: 'AccessToken', iat: 1, exp: 2, ...over }) as AdapterPayload;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    await storage.initialize();
    factory = createOIDCStorageAdapter(storage) as (name: string) => NAuthOIDCAdapter;
  });

  afterEach(async () => {
    // The memory adapter runs a sweep interval; leaving it armed keeps the worker alive.
    await storage.disconnect();
  });

  it('round-trips a payload', async () => {
    const a = factory('AccessToken');
    await a.upsert('id-1', payload({ accountId: 'sub-1' }), 60);
    await expect(a.find('id-1')).resolves.toMatchObject({ jti: 'x', accountId: 'sub-1' });
  });

  it('returns undefined for unknown ids', async () => {
    await expect(factory('AccessToken').find('nope')).resolves.toBeUndefined();
  });

  it('keeps models in separate namespaces', async () => {
    await factory('AccessToken').upsert('same-id', payload({ kind: 'AccessToken' }), 60);
    await factory('RefreshToken').upsert('same-id', payload({ kind: 'RefreshToken' }), 60);

    await expect(factory('AccessToken').find('same-id')).resolves.toMatchObject({ kind: 'AccessToken' });
    await expect(factory('RefreshToken').find('same-id')).resolves.toMatchObject({ kind: 'RefreshToken' });
  });

  it('finds a Session by uid', async () => {
    const s = factory('Session');
    await s.upsert('sid', payload({ kind: 'Session', uid: 'the-uid' }), 60);
    await expect(s.findByUid('the-uid')).resolves.toMatchObject({ uid: 'the-uid' });
    await expect(s.findByUid('other')).resolves.toBeUndefined();
  });

  it('finds a DeviceCode by user code', async () => {
    const d = factory('DeviceCode');
    await d.upsert('dc', payload({ kind: 'DeviceCode', userCode: 'WDJB-MJHT' }), 60);
    await expect(d.findByUserCode('WDJB-MJHT')).resolves.toMatchObject({ userCode: 'WDJB-MJHT' });
  });

  it('marks a payload consumed while preserving its remaining lifetime', async () => {
    const a = factory('AuthorizationCode');
    await a.upsert('code-1', payload({ kind: 'AuthorizationCode' }), 60);

    await a.consume('code-1');

    const found = await a.find('code-1');
    expect(found?.consumed).toEqual(expect.any(Number));
    // Still present and still expiring — consume must not clear the TTL.
    await expect(storage.ttl('oidc:AuthorizationCode:code-1')).resolves.toBeGreaterThan(0);
  });

  it('consume is a no-op for an unknown id', async () => {
    await expect(factory('AuthorizationCode').consume('nope')).resolves.toBeUndefined();
  });

  it('destroys a payload', async () => {
    const a = factory('AccessToken');
    await a.upsert('id-1', payload(), 60);
    await a.destroy('id-1');
    await expect(a.find('id-1')).resolves.toBeUndefined();
  });

  it('revokes every artifact sharing a grant, across models', async () => {
    const grantId = 'grant-42';
    await factory('AccessToken').upsert('at-1', payload({ kind: 'AccessToken', grantId }), 60);
    await factory('RefreshToken').upsert('rt-1', payload({ kind: 'RefreshToken', grantId }), 60);
    await factory('AuthorizationCode').upsert('ac-1', payload({ kind: 'AuthorizationCode', grantId }), 60);
    // A different grant must survive.
    await factory('AccessToken').upsert('at-2', payload({ kind: 'AccessToken', grantId: 'other' }), 60);

    await factory('AccessToken').revokeByGrantId(grantId);

    await expect(factory('AccessToken').find('at-1')).resolves.toBeUndefined();
    await expect(factory('RefreshToken').find('rt-1')).resolves.toBeUndefined();
    await expect(factory('AuthorizationCode').find('ac-1')).resolves.toBeUndefined();
    await expect(factory('AccessToken').find('at-2')).resolves.toMatchObject({ kind: 'AccessToken' });
  });

  it('revoking an unknown grant is harmless', async () => {
    await expect(factory('AccessToken').revokeByGrantId('never-existed')).resolves.toBeUndefined();
  });

  it('handles ids containing colons when sweeping a grant', async () => {
    // Marker keys are `oidc:g:{grantId}:{model}:{id}` and ids are not colon-free in
    // every deployment, so the sweep must not split naively on ':'.
    const grantId = 'g-1';
    await factory('AccessToken').upsert('a:b:c', payload({ kind: 'AccessToken', grantId }), 60);
    await factory('AccessToken').revokeByGrantId(grantId);
    await expect(factory('AccessToken').find('a:b:c')).resolves.toBeUndefined();
  });

  it('revokes every artifact belonging to an account', async () => {
    await factory('Session').upsert('s-1', payload({ kind: 'Session', accountId: 'sub-1', uid: 'u1' }), 60);
    await factory('Session').upsert('s-2', payload({ kind: 'Session', accountId: 'sub-2', uid: 'u2' }), 60);

    const removed = await factory('Session').revokeByAccountId('sub-1');

    expect(removed).toBe(1);
    await expect(factory('Session').find('s-1')).resolves.toBeUndefined();
    await expect(factory('Session').find('s-2')).resolves.toMatchObject({ accountId: 'sub-2' });
  });

  it('treats unparseable stored data as absent rather than throwing', async () => {
    await storage.set('oidc:AccessToken:broken', '{not json', 60);
    await expect(factory('AccessToken').find('broken')).resolves.toBeUndefined();
  });
});
