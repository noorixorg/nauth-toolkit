/**
 * Auth Flow Rules Unit Tests
 *
 * Tests authentication flow rule builder and rules.
 */

import { RuleBuilder, Rules } from './auth-flow-rules';
import { AuthFlowContext } from './auth-flow-state-machine.types';
import { NAuthConfig } from '../interfaces/config.interface';
import { IUser } from '../interfaces/entities.interface';

describe('RuleBuilder', () => {
  const createMockContext = (overrides: Partial<AuthFlowContext> = {}): AuthFlowContext => {
    const mockUser: IUser = {
      id: 1,
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      email: 'test@example.com',
      username: 'testuser',
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: new Date(),
      passwordHistory: [],
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
      mustChangePassword: false,
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lastLoginAt: null,
      lastLoginIp: null,
      hasSocialAuth: false,
      socialProviders: null,
      mfaEnabled: false,
      mfaMethods: null,
      preferredMfaMethod: null,
      backupCodes: null,
      mfaExempt: false,
      metadata: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
    };

    const mockConfig: NAuthConfig = {
      jwt: {
        accessToken: {
          secret: 'test-secret',
          expiresIn: 3600,
        },
        refreshToken: {
          secret: 'test-secret',
          expiresIn: 86400,
        },
      },
    } as NAuthConfig;

    return {
      user: mockUser,
      config: mockConfig,
      authMethod: 'password',
      computed: {
        isEmailVerificationRequired: false,
        isPhoneVerificationRequired: false,
        isPhoneCollectionNeeded: false,
        isMFAExempt: false,
        isMFASetupRequired: false,
        isMFAVerificationRequired: false,
        isDeviceTrusted: false,
        isGracePeriodActive: false,
        isBlocked: false,
        riskScore: 0,
        riskLevel: 'low',
      },
      ...overrides,
    };
  };

  describe('all', () => {
    it('should return true when all rules are true', () => {
      const rule1 = () => true;
      const rule2 = () => true;
      const combined = RuleBuilder.all([rule1, rule2]);
      const context = createMockContext();
      expect(combined(context)).toBe(true);
    });

    it('should return false when any rule is false', () => {
      const rule1 = () => true;
      const rule2 = () => false;
      const combined = RuleBuilder.all([rule1, rule2]);
      const context = createMockContext();
      expect(combined(context)).toBe(false);
    });
  });

  describe('any', () => {
    it('should return true when any rule is true', () => {
      const rule1 = () => false;
      const rule2 = () => true;
      const combined = RuleBuilder.any([rule1, rule2]);
      const context = createMockContext();
      expect(combined(context)).toBe(true);
    });

    it('should return false when all rules are false', () => {
      const rule1 = () => false;
      const rule2 = () => false;
      const combined = RuleBuilder.any([rule1, rule2]);
      const context = createMockContext();
      expect(combined(context)).toBe(false);
    });
  });

  describe('not', () => {
    it('should return true when rule returns false', () => {
      const rule = () => false;
      const negated = RuleBuilder.not(rule);
      const context = createMockContext();
      expect(negated(context)).toBe(true);
    });

    it('should return false when rule returns true', () => {
      const rule = () => true;
      const negated = RuleBuilder.not(rule);
      const context = createMockContext();
      expect(negated(context)).toBe(false);
    });
  });
});

describe('Rules', () => {
  const createMockContext = (overrides: Partial<AuthFlowContext> = {}): AuthFlowContext => {
    const mockUser: IUser = {
      id: 1,
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      email: 'test@example.com',
      username: 'testuser',
      phone: null,
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
      passwordChangedAt: new Date(),
      passwordHistory: [],
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
      mustChangePassword: false,
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lastLoginAt: null,
      lastLoginIp: null,
      hasSocialAuth: false,
      socialProviders: null,
      mfaEnabled: false,
      mfaMethods: null,
      preferredMfaMethod: null,
      backupCodes: null,
      mfaExempt: false,
      metadata: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
    };

    const mockConfig: NAuthConfig = {
      jwt: {
        accessToken: {
          secret: 'test-secret',
          expiresIn: 3600,
        },
        refreshToken: {
          secret: 'test-secret',
          expiresIn: 86400,
        },
      },
    } as NAuthConfig;

    return {
      user: mockUser,
      config: mockConfig,
      authMethod: 'password',
      computed: {
        isEmailVerificationRequired: false,
        isPhoneVerificationRequired: false,
        isPhoneCollectionNeeded: false,
        isMFAExempt: false,
        isMFASetupRequired: false,
        isMFAVerificationRequired: false,
        isDeviceTrusted: false,
        isGracePeriodActive: false,
        isBlocked: false,
        riskScore: 0,
        riskLevel: 'low',
      },
      ...overrides,
    };
  };

  it('should evaluate emailVerificationPending rule', () => {
    const context = createMockContext();
    context.computed.isEmailVerificationRequired = true;
    expect(Rules.emailVerificationPending(context)).toBe(true);

    const context2 = createMockContext();
    context2.computed.isEmailVerificationRequired = false;
    expect(Rules.emailVerificationPending(context2)).toBe(false);
  });

  it('should evaluate phoneVerificationPending rule', () => {
    const context = createMockContext();
    context.computed.isPhoneVerificationRequired = true;
    expect(Rules.phoneVerificationPending(context)).toBe(true);
  });

  it('should evaluate phoneCollectionNeeded rule', () => {
    const context = createMockContext();
    context.computed.isPhoneCollectionNeeded = true;
    expect(Rules.phoneCollectionNeeded(context)).toBe(true);
  });

  it('should evaluate mfaVerificationRequired rule', () => {
    const context = createMockContext();
    context.computed.isMFAVerificationRequired = true;
    expect(Rules.mfaVerificationRequired(context)).toBe(true);
  });

  it('should evaluate mfaSetupRequired rule', () => {
    const context = createMockContext();
    context.computed.isMFASetupRequired = true;
    expect(Rules.mfaSetupRequired(context)).toBe(true);
  });

  it('should evaluate mustChangePassword rule', () => {
    const userWithMustChange = {
      id: 1,
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      mustChangePassword: true,
    } as IUser;
    const context = createMockContext({
      user: userWithMustChange,
    });
    expect(Rules.mustChangePassword(context)).toBe(true);
  });

  it('should evaluate isBlocked rule', () => {
    const context = createMockContext();
    context.computed.isBlocked = true;
    expect(Rules.isBlocked(context)).toBe(true);
  });

  it('should evaluate authenticated rule', () => {
    const context = createMockContext();
    expect(Rules.authenticated(context)).toBe(true);
  });
});
