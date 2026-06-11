import { RequireRecaptcha, REQUIRE_RECAPTCHA_KEY } from './recaptcha.decorator';
import { Reflector } from '@nestjs/core';

describe('Recaptcha Decorators', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('@RequireRecaptcha()', () => {
    it('should set require recaptcha metadata to true', () => {
      class TestController {
        @RequireRecaptcha()
        testMethod() {
          return 'test';
        }
      }

      const metadata = reflector.get(REQUIRE_RECAPTCHA_KEY, TestController.prototype.testMethod);
      expect(metadata).toBe(true);
    });
  });

  describe('metadata keys', () => {
    it('should export correct metadata key', () => {
      expect(REQUIRE_RECAPTCHA_KEY).toBe('NAUTH_REQUIRE_RECAPTCHA');
    });
  });
});
