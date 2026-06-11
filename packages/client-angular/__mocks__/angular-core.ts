/**
 * Minimal mock for @angular/core for Jest (avoids ESM/import in node_modules).
 */
export class InjectionToken {
  constructor(public _desc: string) {}
}

export function Injectable() {
  return (target: unknown) => target;
}

export function Inject(_token: unknown) {
  return (_target: unknown, _propertyKey: string | symbol, _parameterIndex: number) => {};
}

export function Optional() {
  return (_target: unknown, _propertyKey: string | symbol, _parameterIndex: number) => {};
}

export function inject(_token: unknown, _options?: { optional?: boolean }): unknown {
  // This will be overridden in tests
  return undefined;
}

export const PLATFORM_ID = 'browser';

export function NgModule(_metadata?: any) {
  return (target: unknown) => target;
}
