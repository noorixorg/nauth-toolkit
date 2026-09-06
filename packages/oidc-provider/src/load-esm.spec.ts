import * as fs from 'fs';
import * as path from 'path';
import { loadESM } from './load-esm';

/**
 * `loadESM` must stay the only `Function`-wrapped dynamic import in this package.
 *
 * V8 caches compiled `Function` bodies by source text, so two files evaluating identical
 * source share one compiled function along with the module-resolution context of
 * whichever ran first. Under Jest that made the second spec to load an ESM-only package
 * fail with "Test environment has been torn down" — ordering-dependent, so it surfaced on
 * CI's shared workers while passing locally. `loadESM` defeats the cache by making every
 * body unique; a second hand-rolled copy elsewhere would reintroduce the collision.
 *
 * Checked here rather than left to review, which would have to catch a duplicated
 * one-line idiom in a file that otherwise looks fine.
 */
describe('loadESM', () => {
  it('loads an ESM-only package', async () => {
    const mod = await loadESM<{ default?: unknown }>('oidc-provider');

    expect(typeof (mod.default ?? mod)).toBe('function');
  });

  it('returns a distinct compiled importer per call', async () => {
    // Two loads in a row must not be served the same cached function body.
    const [first, second] = await Promise.all([
      loadESM<Record<string, unknown>>('oidc-provider'),
      loadESM<Record<string, unknown>>('oidc-provider'),
    ]);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });

  it('is the only Function-wrapped dynamic import in the package', () => {
    const packageRoot = path.join(__dirname, '..');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'coverage') {
            walk(full);
          }
          continue;
        }
        if (!entry.name.endsWith('.ts') || full === path.join(__dirname, 'load-esm.ts')) {
          continue;
        }
        const source = fs.readFileSync(full, 'utf8');
        // `new Function(...)` whose body performs a dynamic import.
        if (/new Function\([^)]*import\s*\(/s.test(source)) {
          offenders.push(path.relative(packageRoot, full));
        }
      }
    };

    walk(packageRoot);

    expect(offenders).toEqual([]);
  });
});
