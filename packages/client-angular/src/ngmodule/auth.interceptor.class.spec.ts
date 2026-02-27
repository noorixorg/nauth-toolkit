/**
 * Auth Interceptor Class Unit Tests
 */
import 'reflect-metadata';
import { HttpRequest, HttpHandler } from '@angular/common/http';
import { of } from 'rxjs';
import { AuthInterceptorClass } from './auth.interceptor.class';
import { AuthService } from './auth.service';
import { createNAuthAuthHttpInterceptor } from '../lib/auth-interceptor.shared';

jest.mock('../lib/auth-interceptor.shared', () => ({
  createNAuthAuthHttpInterceptor: jest.fn(),
}));

describe('AuthInterceptorClass', () => {
  let interceptor: AuthInterceptorClass;
  let mockConfig: any;
  let mockHttp: any;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRouter: any;
  let mockRequest: HttpRequest<unknown>;
  let mockNext: HttpHandler;
  let mockResponse: any;

  beforeEach(() => {
    mockResponse = of({});
    mockRequest = new HttpRequest('GET', '/api/test');
    mockNext = {
      handle: jest.fn().mockReturnValue(mockResponse),
    } as any;

    mockConfig = { baseUrl: 'http://localhost:3000' };
    mockHttp = {};
    mockAuthService = {} as any;
    mockRouter = {};

    (createNAuthAuthHttpInterceptor as jest.Mock).mockReturnValue(mockResponse);

    interceptor = new AuthInterceptorClass(mockConfig, mockHttp, mockAuthService, mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call createNAuthAuthHttpInterceptor with correct parameters', () => {
    const result = interceptor.intercept(mockRequest, mockNext);

    expect(createNAuthAuthHttpInterceptor).toHaveBeenCalledWith({
      config: mockConfig,
      http: mockHttp,
      authService: mockAuthService,
      router: mockRouter,
      req: mockRequest,
      next: expect.any(Function),
    });
    expect(result).toBe(mockResponse);
  });

  it('should pass next.handle to createNAuthAuthHttpInterceptor', () => {
    interceptor.intercept(mockRequest, mockNext);

    const callArgs = (createNAuthAuthHttpInterceptor as jest.Mock).mock.calls[0][0];
    const nextFn = callArgs.next;
      const testRequest = new HttpRequest('GET', '/api/test2');

    nextFn(testRequest);

    expect(mockNext.handle).toHaveBeenCalledWith(testRequest);
  });
});
