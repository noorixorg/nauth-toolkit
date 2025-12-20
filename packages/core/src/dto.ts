/**
 * DTO barrel export (shim)
 *
 * This file exists to ensure TypeScript's emitted declaration paths (e.g. `./dto.js`)
 * resolve correctly for consumers using Node's `exports`/ESM-style resolution.
 *
 * Without a top-level `dto.ts` file, `export * from './dto'` may emit `./dto.js` in
 * `dist/index.d.ts` while the build output only contains `dist/dto/index.js`, causing
 * missing exports in downstream packages.
 */
export * from './dto/index';


