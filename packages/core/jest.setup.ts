/**
 * Jest setup file for reflect-metadata support
 * Required for TypeORM decorators to work in tests
 */
import 'reflect-metadata';

/**
 * Provide a `fail()` helper for tests that use Jasmine-style `fail(...)`.
 *
 * Jest (node environment) does not always expose `fail` globally, so we define it
 * to avoid ReferenceError when a test needs to hard-fail after an unexpected code path.
 */
const g = globalThis as unknown as { fail?: (error?: unknown) => never };
if (typeof g.fail !== 'function') {
  g.fail = (message?: unknown): never => {
    throw new Error(typeof message === 'string' ? message : 'Test failed');
  };
}

