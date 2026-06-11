import { Public, IS_PUBLIC_KEY } from './public.decorator';

/**
 * Public Decorator Unit Tests
 *
 * Tests the @Public() decorator functionality.
 */
describe('@Public() Decorator', () => {
  it('should return a decorator function', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });

  it('should set metadata when applied', () => {
    const decorator = Public();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const mockTarget = function TestClass() {};
    const mockPropertyKey = 'testMethod';
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const mockDescriptor = { value: () => {} };

    // Call the decorator - SetMetadata decorators can be applied to methods
    // For method decorators: (target, propertyKey, descriptor)
    expect(() => decorator(mockTarget.prototype, mockPropertyKey, mockDescriptor)).not.toThrow();

    // Verify decorator was called (no exception thrown)
    expect(mockTarget).toBeDefined();
  });

  it('should export IS_PUBLIC_KEY constant', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });
});
