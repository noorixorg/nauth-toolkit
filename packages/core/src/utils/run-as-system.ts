/**
 * Trusted system context
 *
 * Privileged service methods resolve their actor from request context. Code that runs
 * outside a request — a seeding script, a data migration, a queue worker — has no
 * actor, and is denied rather than waved through: "no context means trusted" would
 * silently authorize any background job reachable from user input.
 *
 * `runAsSystem` is the deliberate, greppable exception.
 */

import { ContextStorage } from './context-storage';

/**
 * Context key marking the current execution as trusted system work.
 *
 * Not exported from the package root: the only supported way to set it is
 * {@link runAsSystem}, so every bypass is visible at its call site.
 */
const SYSTEM_ACTOR_KEY = 'NAUTH_SYSTEM_ACTOR';

/**
 * Run trusted work that bypasses authorization.
 *
 * Everything inside the callback — including nested async calls, since the flag rides
 * on `AsyncLocalStorage` — skips the authorization provider entirely. The provider is
 * not consulted with a null actor; it is not consulted at all.
 *
 * **Never call this on a request path.** It defeats the authorization model completely.
 * It exists for code with no authenticated caller and no business having one: database
 * seeds, migrations, scheduled jobs, tests.
 *
 * Nests safely, and restores the previous state on exit even if the callback throws.
 *
 * @param fn - The work to run as the system
 * @returns Whatever `fn` returns, including a promise if it is async
 *
 * @example
 * ```typescript
 * // A seeding script: no HTTP request, no signed-in admin.
 * await runAsSystem(async () => {
 *   await adminAuthService.signup({ email: 'owner@example.com', password: seed });
 *   await adminAuthService.setMustChangePassword({ sub, mustChangePassword: true });
 * });
 * ```
 */
export function runAsSystem<T>(fn: () => T): T {
  const store = ContextStorage.getStore();

  // Already inside a context: set the flag on it and restore afterwards, so nesting
  // and a surrounding request context both behave.
  if (store) {
    const previous = store.get(SYSTEM_ACTOR_KEY);
    store.set(SYSTEM_ACTOR_KEY, true);

    try {
      const result = fn();

      // Restore only once an async callback has actually settled, otherwise the flag
      // would be cleared while the work it protects is still running.
      if (isPromise(result)) {
        return result.finally(() => restore(store, previous)) as unknown as T;
      }

      restore(store, previous);
      return result;
    } catch (error) {
      restore(store, previous);
      throw error;
    }
  }

  // No context at all - the common case for a standalone script.
  return ContextStorage.run(() => {
    ContextStorage.set(SYSTEM_ACTOR_KEY, true);
    return fn();
  });
}

/**
 * Whether the current execution was marked trusted by {@link runAsSystem}.
 *
 * @returns true when authorization should be bypassed
 */
export function isSystemContext(): boolean {
  return ContextStorage.get<boolean>(SYSTEM_ACTOR_KEY) === true;
}

/**
 * Restore a previously captured flag value, removing it when there was none.
 *
 * @param store - The context store to restore into
 * @param previous - The value captured before the bypass began
 */
function restore(store: Map<string, unknown>, previous: unknown): void {
  if (previous === undefined) {
    store.delete(SYSTEM_ACTOR_KEY);
    return;
  }
  store.set(SYSTEM_ACTOR_KEY, previous);
}

/**
 * Narrow a value to a promise without assuming it is one.
 *
 * @param value - Any callback result
 * @returns true when the value is thenable
 */
function isPromise<T>(value: T): value is T & Promise<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}
