/**
 * Challenge Helpers Unit Tests
 */

import {
  requiresPhoneCollection,
  getMaskedDestination,
  getMFAMethod,
  getChallengeInstructions,
  isOTPChallenge,
} from './challenge-helpers';
import { AuthResponse, AuthChallenge } from '../types/auth.types';

describe('Challenge Helpers', () => {
  describe('requiresPhoneCollection', () => {
    it('should return true for VERIFY_PHONE challenge with requiresPhoneCollection', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_PHONE,
        challengeParameters: {
          requiresPhoneCollection: 'true',
        },
      } as AuthResponse;

      expect(requiresPhoneCollection(challenge)).toBe(true);
    });

    it('should return false for other challenge types', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        challengeParameters: {},
      } as AuthResponse;

      expect(requiresPhoneCollection(challenge)).toBe(false);
    });
  });

  describe('getMaskedDestination', () => {
    it('should return maskedPhone for SMS MFA', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          preferredMethod: 'sms',
          maskedPhone: '***-***-7890',
        },
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBe('***-***-7890');
    });

    it('should return maskedEmail for Email MFA', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          preferredMethod: 'email',
          maskedEmail: 'u***r@example.com',
        },
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBe('u***r@example.com');
    });

    it('should return codeDeliveryDestination for VERIFY_EMAIL', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        challengeParameters: {
          codeDeliveryDestination: 'u***r@example.com',
        },
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBe('u***r@example.com');
    });

    it('should return null when no destination available', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {},
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBeNull();
    });
  });

  describe('getMFAMethod', () => {
    it('should return method from preferredMethod', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          preferredMethod: 'totp',
        },
      } as AuthResponse;

      expect(getMFAMethod(challenge)).toBe('totp');
    });

    it('should return undefined for non-MFA challenges', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        challengeParameters: {},
      } as AuthResponse;

      expect(getMFAMethod(challenge)).toBeUndefined();
    });
  });

  describe('getChallengeInstructions', () => {
    it('should return instructions from parameters', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          instructions: 'Enter your TOTP code',
        },
      } as AuthResponse;

      expect(getChallengeInstructions(challenge)).toBe('Enter your TOTP code');
    });

    it('should return undefined when instructions not available', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {},
      } as AuthResponse;

      expect(getChallengeInstructions(challenge)).toBeUndefined();
    });
  });

  describe('isOTPChallenge', () => {
    it('should return true for VERIFY_EMAIL', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
      } as AuthResponse;

      expect(isOTPChallenge(challenge)).toBe(true);
    });

    it('should return true for VERIFY_PHONE', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_PHONE,
      } as AuthResponse;

      expect(isOTPChallenge(challenge)).toBe(true);
    });

    it('should return true for MFA_REQUIRED', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
      } as AuthResponse;

      expect(isOTPChallenge(challenge)).toBe(true);
    });

    it('should return false for other challenge types', () => {
      const challenge: AuthResponse = {
        challengeName: 'UNKNOWN' as AuthChallenge,
      } as AuthResponse;

      expect(isOTPChallenge(challenge)).toBe(false);
    });
  });

  describe('getMaskedDestination edge cases', () => {
    it('should return null when challengeParameters is null', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: null as any,
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBeNull();
    });

    it('should return null when challengeParameters is undefined', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBeNull();
    });

    it('should return maskedPhone when method is not specified but maskedPhone exists', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          maskedPhone: '***-***-7890',
        },
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBe('***-***-7890');
    });

    it('should return maskedEmail when method is not specified but maskedEmail exists', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          maskedEmail: 'u***r@example.com',
        },
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBe('u***r@example.com');
    });

    it('should return codeDeliveryDestination for VERIFY_PHONE', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_PHONE,
        challengeParameters: {
          codeDeliveryDestination: '***-***-7890',
        },
      } as AuthResponse;

      expect(getMaskedDestination(challenge)).toBe('***-***-7890');
    });
  });

  describe('getMFAMethod edge cases', () => {
    it('should return method from method field when preferredMethod not available', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: {
          method: 'sms',
        },
      } as AuthResponse;

      expect(getMFAMethod(challenge)).toBe('sms');
    });

    it('should return undefined when challengeParameters is null', () => {
      const challenge: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        challengeParameters: null as any,
      } as AuthResponse;

      expect(getMFAMethod(challenge)).toBeUndefined();
    });
  });
});
