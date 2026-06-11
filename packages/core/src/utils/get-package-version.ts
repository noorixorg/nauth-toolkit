import * as fs from 'fs';
import * as path from 'path';

/**
 * Memoized result of the package.json version lookup.
 * `undefined` means "not yet resolved"; a string (possibly 'unknown') is final.
 */
let cachedVersion: string | undefined;

/**
 * Resolve the installed @nauth-toolkit/core version at runtime.
 *
 * Walks up from the compiled file location (dist/utils at runtime, src/utils
 * under ts-jest) for up to three levels looking for the package's own
 * package.json. Reading at runtime keeps the reported version in sync with
 * the published package — a compiled-in constant would go stale because the
 * release script bumps versions outside the TypeScript build.
 *
 * Never throws; returns 'unknown' when the manifest cannot be found or read.
 *
 * @returns The semver version string of @nauth-toolkit/core, or 'unknown'
 */
export function getCoreVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }

  let dir = __dirname;
  for (let i = 0; i < 3; i++) {
    dir = path.dirname(dir);
    try {
      const manifestPath = path.join(dir, 'package.json');
      if (fs.existsSync(manifestPath)) {
        const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (
          typeof manifest === 'object' &&
          manifest !== null &&
          (manifest as { name?: unknown }).name === '@nauth-toolkit/core' &&
          typeof (manifest as { version?: unknown }).version === 'string'
        ) {
          cachedVersion = (manifest as { version: string }).version;
          return cachedVersion;
        }
      }
    } catch {
      // Unreadable or malformed manifest — keep walking up, fall through to 'unknown'.
    }
  }

  cachedVersion = 'unknown';
  return cachedVersion;
}
