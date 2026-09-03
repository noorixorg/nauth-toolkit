/**
 * Confirms the ESM-only `oidc-provider` can be loaded from this repo's CommonJS
 * Jest runtime. If this ever fails, every integration spec here has to move to a
 * mocked provider — so it is worth asserting explicitly rather than discovering it
 * indirectly.
 */
import { loadProviderCtor } from './create-provider';

describe('loadProviderCtor', () => {
  it('loads the ESM-only oidc-provider under a CommonJS test runtime', async () => {
    const Ctor = await loadProviderCtor();
    expect(typeof Ctor).toBe('function');
    expect(Ctor.name).toBe('Provider');
  });
});
