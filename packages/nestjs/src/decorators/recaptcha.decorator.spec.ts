import { SkipRecaptcha, RequireRecaptcha, SKIP_RECAPTCHA_KEY, REQUIRE_RECAPTCHA_KEY } from './recaptcha.decorator';
import { Reflector } from '@nestjs/core';

describe('Recaptcha Decorators', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('@SkipRecaptcha()', () => {
    it('should set skip recaptcha metadata to true', () => {
      class TestController {
        @SkipRecaptcha()
        testMethod() {
          return 'test';
        }
      }

      const metadata = reflector.get(SKIP_RECAPTCHA_KEY, TestController.prototype.testMethod);
      expect(metadata).toBe(true);
    });

    it('should work with multiple decorators', () => {
      class TestController {
        @SkipRecaptcha()
        @RequireRecaptcha()
        testMethod() {
          return 'test';
        }
      }

      const skipMetadata = reflector.get(SKIP_RECAPTCHA_KEY, TestController.prototype.testMethod);
      const requireMetadata = reflector.get(REQUIRE_RECAPTCHA_KEY, TestController.prototype.testMethod);

      expect(skipMetadata).toBe(true);
      expect(requireMetadata).toBe(true);
    });
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
    it('should export correct metadata keys', () => {
      expect(SKIP_RECAPTCHA_KEY).toBe('NAUTH_SKIP_RECAPTCHA');
      expect(REQUIRE_RECAPTCHA_KEY).toBe('NAUTH_REQUIRE_RECAPTCHA');
    });
  });
});
