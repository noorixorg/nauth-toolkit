/**
 * reCAPTCHA Decorator Integration Tests
 *
 * Tests the full flow from decorator metadata -> interceptor -> context -> core validation.
 */

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { NAuthContextGuard } from '../guards/nauth-context.guard';
import { CookieTokenInterceptor } from '../interceptors/cookie-token.interceptor';
import { TokenDeliveryHttpService } from '../services/token-delivery-http.service';
import { ContextStorage, NAuthConfig, NAuthRequest } from '@nauth-toolkit/core';
import { REQUIRE_RECAPTCHA_KEY } from './recaptcha.decorator';

describe('reCAPTCHA Decorator Integration', () => {
  let guard: NAuthContextGuard;
  let interceptor: CookieTokenInterceptor;
  let mockConfig: NAuthConfig;
  let tokenDeliveryHttp: jest.Mocked<TokenDeliveryHttpService>;
  let reflector: Reflector;
  let mockRequest: Record<string, unknown>;
  let mockResponse: Record<string, unknown>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      tokenDelivery: {
        method: 'cookies',
      },
    } as NAuthConfig;

    guard = new NAuthContextGuard(mockConfig);

    // Mock TokenDeliveryHttpService
    tokenDeliveryHttp = {
      resolveEffectiveDelivery: jest.fn().mockReturnValue('cookies'),
      setAuthCookies: jest.fn(),
      setCsrfCookie: jest.fn(),
      setDeviceTokenCookie: jest.fn(),
    } as unknown as jest.Mocked<TokenDeliveryHttpService>;

    reflector = new Reflector();
    interceptor = new CookieTokenInterceptor(tokenDeliveryHttp, reflector);

    mockRequest = {
      headers: { 'user-agent': 'Mozilla/5.0' },
      cookies: {},
      ip: '1.2.3.4',
      body: {},
    };

    mockResponse = {};

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ result: 'success' })),
    };
  });

  function createExecutionContextWithDecorator(_decoratorMetadata?: {
    [REQUIRE_RECAPTCHA_KEY]?: boolean;
  }): ExecutionContext {
    const handler = () => {};
    return {
      getType: () => 'http',
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  }

  describe('@RequireRecaptcha() decorator integration', () => {
    it('should set nauthRequireRecaptcha attribute that core validation can read', async () => {
      // Simulate @RequireRecaptcha() decorator
      const mockContext = createExecutionContextWithDecorator({});

      // Mock reflector to return true for REQUIRE_RECAPTCHA_KEY (simulating @RequireRecaptcha())
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === REQUIRE_RECAPTCHA_KEY) return true;
        return undefined;
      });

      // Step 1: Guard initializes context and stores wrapped REQUEST
      await guard.canActivate(mockContext);

      // Step 2: Interceptor reads decorator metadata and sets _nauthAttributes
      await interceptor.intercept(mockContext, mockCallHandler).toPromise();

      // Step 3: Verify that REQUEST in ContextStorage has the attribute accessible
      // This mimics what auth-service-internal-helpers.ts does:
      //   const req = ContextStorage.get<NAuthRequest>('REQUEST');
      //   if (req?.attributes.nauthRequireRecaptcha === true) { ... }

      const store = (mockRequest as Record<symbol, unknown>)[Symbol.for('nauth.contextStore')] as
        | Map<string, unknown>
        | undefined;
      expect(store).toBeDefined();

      await ContextStorage.enterStore(store!, async () => {
        const req = ContextStorage.get<NAuthRequest>('REQUEST');
        expect(req).toBeDefined();
        expect(req?.attributes.nauthRequireRecaptcha).toBe(true);
      });
    });

  });

  describe('REQUEST wrapper attribute mapping', () => {
    it('should correctly map _nauthAttributes to attributes getter', async () => {
      const mockContext = createExecutionContextWithDecorator({});

      await guard.canActivate(mockContext);

      // Manually set _nauthAttributes (simulating what interceptor does)
      (mockRequest as { _nauthAttributes?: Record<string, unknown> })._nauthAttributes = {
        nauthRequireRecaptcha: true,
        nauthTokenDeliveryOverride: 'json',
        customAttribute: 'test-value',
      };

      const store = (mockRequest as Record<symbol, unknown>)[Symbol.for('nauth.contextStore')] as
        | Map<string, unknown>
        | undefined;

      await ContextStorage.enterStore(store!, async () => {
        const req = ContextStorage.get<NAuthRequest>('REQUEST');
        expect(req?.attributes.nauthRequireRecaptcha).toBe(true);
        expect(req?.attributes.nauthTokenDeliveryOverride).toBe('json');
        expect(req?.attributes.customAttribute).toBe('test-value');
      });
    });
  });
});
