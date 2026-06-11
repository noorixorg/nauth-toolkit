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
  AccountLockedHook,
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
    it('should set metadata with default priority', () => {
      @PreSignupHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'preSignup',
        priority: 100,
      });
    });

    it('should set metadata with custom priority', () => {
      @PreSignupHook({ priority: 50 })
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'preSignup',
        priority: 50,
      });
    });
  });

  describe('PostSignupHook', () => {
    it('should set metadata', () => {
      @PostSignupHook({ priority: 10 })
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'postSignup',
        priority: 10,
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
        priority: 100,
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
        priority: 100,
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
        priority: 100,
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
        priority: 100,
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
        priority: 100,
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
        priority: 100,
      });
    });
  });

  describe('AccountLockedHook', () => {
    it('should set metadata', () => {
      @AccountLockedHook()
      class TestHook {}

      const metadata = reflector.get(HOOK_METADATA_KEY, TestHook);
      expect(metadata).toEqual({
        type: 'accountLocked',
        priority: 100,
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
        priority: 100,
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
        priority: 100,
      });
    });
  });
});
