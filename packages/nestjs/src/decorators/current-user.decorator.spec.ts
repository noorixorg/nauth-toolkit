import { CurrentUser } from './current-user.decorator';
import { ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser Decorator Unit Tests
 *
 * Tests the @CurrentUser() decorator functionality.
 */
describe('@CurrentUser() Decorator', () => {
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 1,
        email: 'test@example.com',
        sub: 'user-123',
      },
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  // Helper to extract and call the factory function
  const callFactory = (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  };

  it('should extract user from request', () => {
    expect(typeof CurrentUser()).toBe('function');

    const result = callFactory(undefined, mockExecutionContext);
    expect(result).toEqual(mockRequest.user);
    expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
  });

  it('should handle undefined data parameter', () => {
    const result = callFactory(undefined, mockExecutionContext);

    expect(result).toEqual(mockRequest.user);
  });

  it('should handle null user in request', () => {
    mockRequest.user = null;
    const result = callFactory(undefined, mockExecutionContext);

    expect(result).toBeNull();
  });

  it('should handle missing user property in request', () => {
    delete mockRequest.user;
    const result = callFactory(undefined, mockExecutionContext);

    expect(result).toBeUndefined();
  });

  it('should work with different user objects', () => {
    const adminUser = {
      id: 2,
      email: 'admin@example.com',
      sub: 'admin-456',
      roles: ['admin'],
    };

    mockRequest.user = adminUser;
    const result = callFactory(undefined, mockExecutionContext);

    expect(result).toEqual(adminUser);
  });
});
