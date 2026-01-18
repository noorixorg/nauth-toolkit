/**
 * Token Delivery Decorator Unit Tests
 *
 * Tests token delivery decorator functionality.
 */

import { TokenDelivery, TOKEN_DELIVERY_KEY } from './token-delivery.decorator';
import { Reflector } from '@nestjs/core';

describe('TokenDelivery Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('should set metadata for cookies mode', () => {
    class TestController {
      @TokenDelivery('cookies')
      testMethod() {}
    }

    const metadata = reflector.get(TOKEN_DELIVERY_KEY, TestController.prototype.testMethod);
    expect(metadata).toBe('cookies');
  });

  it('should set metadata for json mode', () => {
    class TestController {
      @TokenDelivery('json')
      testMethod() {}
    }

    const metadata = reflector.get(TOKEN_DELIVERY_KEY, TestController.prototype.testMethod);
    expect(metadata).toBe('json');
  });
});
