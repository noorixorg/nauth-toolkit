/**
 * Hook Decorator Unit Tests
 *
 * Tests hook decorator functionality.
 */

import {
  PreSignupHook,
  PostSignupHook,
  UserProfileUpdatedHook,
  PasswordChangedHook,
  MFADeviceRemovedHook,
  AdaptiveMFARiskDetectedHook,
  AccountStatusChangedHook,
  EmailChangedHook,
  SessionsRevokedHook,
  MFAFirstEnabledHook,
  HOOK_METADATA_KEY,
} from './hook.decorator';
import { Reflector } from '@nestjs/core';

describe('Hook Decorators', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('PreSignupHook', () => {
    it('should set metadata', () => {
      @PreSignupHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'preSignup',
      });
    });
  });

  describe('PostSignupHook', () => {
    it('should set metadata', () => {
      @PostSignupHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'postSignup',
      });
    });
  });

  describe('UserProfileUpdatedHook', () => {
    it('should set metadata', () => {
      @UserProfileUpdatedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'userProfileUpdated',
      });
    });
  });

  describe('PasswordChangedHook', () => {
    it('should set metadata', () => {
      @PasswordChangedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'passwordChanged',
      });
    });
  });

  describe('MFADeviceRemovedHook', () => {
    it('should set metadata', () => {
      @MFADeviceRemovedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'mfaDeviceRemoved',
      });
    });
  });

  describe('AdaptiveMFARiskDetectedHook', () => {
    it('should set metadata', () => {
      @AdaptiveMFARiskDetectedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'adaptiveMfaRiskDetected',
      });
    });
  });

  describe('AccountStatusChangedHook', () => {
    it('should set metadata', () => {
      @AccountStatusChangedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'accountStatusChanged',
      });
    });
  });

  describe('EmailChangedHook', () => {
    it('should set metadata', () => {
      @EmailChangedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'emailChanged',
      });
    });
  });

  describe('SessionsRevokedHook', () => {
    it('should set metadata', () => {
      @SessionsRevokedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'sessionsRevoked',
      });
    });
  });

  describe('MFAFirstEnabledHook', () => {
    it('should set metadata', () => {
      @MFAFirstEnabledHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'mfaFirstEnabled',
      });
    });
  });
});
