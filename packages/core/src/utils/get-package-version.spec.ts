import { getCoreVersion } from './get-package-version';

describe('getCoreVersion', () => {
  it('resolves the @nauth-toolkit/core version from package.json', () => {
    const version = getCoreVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('is memoized (same value on repeat calls)', () => {
    expect(getCoreVersion()).toBe(getCoreVersion());
  });
});
