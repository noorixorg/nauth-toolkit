/** Counter feeding the per-call cache-buster below. */
let loadCounter = 0;

/**
 * Load an ESM-only dependency from this CommonJS build.
 *
 * The import is built through `Function` so TypeScript does not rewrite it back into a
 * `require`, which is the only way to reach a genuine dynamic `import()` from CommonJS
 * output. Under Jest — which runs with `--experimental-vm-modules` here — that import is
 * serviced by the test runner, so the module is instantiated *inside the test's realm*.
 * That matters for `oidc-provider`: it type-checks the configuration object it is handed,
 * and a config built in one realm fails those checks in another. Loading it through
 * Node's own `require`/`createRequire` instead puts it in the main realm and breaks with
 * `features.attestClientAuth must be an own property`.
 *
 * The body carries a unique comment on every call because V8 caches compiled `Function`
 * bodies by source text. Two Jest test files evaluating byte-identical source share one
 * compiled function, and with it the module-resolution context of whichever file ran
 * first; once that file's environment is torn down, the other fails with "Test
 * environment has been torn down". Which file loses depends only on execution order, so
 * it reproduces on CI's shared workers but seldom on a dev machine with more cores.
 * Making each body unique forces a fresh compile bound to the calling context.
 *
 * @param specifier - The package to load
 * @returns The module namespace, exactly as the host resolves it (no `default`
 *   unwrapping — that differs per package, so it is left to the caller)
 *
 * @example
 * ```typescript
 * const client = await loadESM<typeof import('openid-client')>('openid-client');
 * ```
 */
export function loadESM<T>(specifier: string): Promise<T> {
  loadCounter += 1;
  const cacheBuster = `${loadCounter}_${Math.random().toString(36).slice(2)}`;
  const nativeImport = new Function('m', `return import(m); /* ${cacheBuster} */`) as (m: string) => Promise<T>;

  return nativeImport(specifier);
}
