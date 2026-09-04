/**
 * Re-export shim for the routes module.
 *
 * Mirrors the existing `dto.ts` / `adapters.ts` shims so emitted declaration paths
 * resolve for consumers importing from the package root.
 *
 * @packageDocumentation
 */

export * from './routes/index';
