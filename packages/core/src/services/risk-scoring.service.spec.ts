import { RiskScoringService } from './risk-scoring.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { RiskFactor } from '../enums/risk-factor.enum';

/**
 * Risk Scoring Service Unit Tests
 *
 * Covers:
 * - Risk score calculation with default weights
 * - Risk score calculation with custom weights
 * - Risk level classification
 * - Score capping at 100
 * - Unknown risk factor handling
 */
describe('RiskScoringService', () => {
  let service: RiskScoringService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
    };

    service = new RiskScoringService(mockConfig, mockLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateRiskScore()', () => {
    it('should calculate score with default weights', () => {
      const factors = [RiskFactor.NEW_DEVICE, RiskFactor.NEW_COUNTRY];
      const score = service.calculateRiskScore(factors);

      // new_device: 25 + new_country: 25 = 50
      expect(score).toBe(50);
    });

    it('should calculate score with single factor', () => {
      const factors = [RiskFactor.NEW_DEVICE];
      const score = service.calculateRiskScore(factors);

      expect(score).toBe(25);
    });

    it('should calculate score with all factors', () => {
      const factors = [
        RiskFactor.NEW_DEVICE,
        RiskFactor.NEW_IP,
        RiskFactor.NEW_COUNTRY,
        RiskFactor.IMPOSSIBLE_TRAVEL,
        RiskFactor.SUSPICIOUS_ACTIVITY,
      ];
      const score = service.calculateRiskScore(factors);

      // 25 + 15 + 25 + 40 + 30 = 135, capped at 100
      expect(score).toBe(100);
    });

    it('should cap score at 100', () => {
      const factors = [RiskFactor.IMPOSSIBLE_TRAVEL, RiskFactor.IMPOSSIBLE_TRAVEL, RiskFactor.IMPOSSIBLE_TRAVEL];
      // This won't happen in practice (factors are unique), but tests cap behavior
      // Simulate by using custom weights
      mockConfig.mfa = {
        adaptive: {
          riskWeights: {
            impossible_travel: 50, // High weight to test capping
            suspicious_activity: 60,
          },
        },
      };
      service = new RiskScoringService(mockConfig, mockLogger);

      const factors2 = [RiskFactor.IMPOSSIBLE_TRAVEL, RiskFactor.SUSPICIOUS_ACTIVITY];
      const score = service.calculateRiskScore(factors2);

      // 50 + 60 = 110, should cap at 100
      expect(score).toBe(100);
    });

    it('should use custom weights from config', () => {
      mockConfig.mfa = {
        adaptive: {
          riskWeights: {
            new_device: 30,
            new_country: 35,
          },
        },
      };
      service = new RiskScoringService(mockConfig, mockLogger);

      const factors = [RiskFactor.NEW_DEVICE, RiskFactor.NEW_COUNTRY];
      const score = service.calculateRiskScore(factors);

      // Custom weights: 30 + 35 = 65
      expect(score).toBe(65);
    });

    it('should handle unknown risk factors gracefully', () => {
      const factors = [RiskFactor.NEW_DEVICE, 'unknown_factor' as any];
      const score = service.calculateRiskScore(factors);

      // Only new_device counted: 25
      expect(score).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unknown risk factor: unknown_factor, ignoring in score calculation',
      );
    });

    it('should return 0 for empty factors array', () => {
      const score = service.calculateRiskScore([]);
      expect(score).toBe(0);
    });

    it('should handle mixed known and unknown factors', () => {
      const factors = [RiskFactor.NEW_DEVICE, 'unknown1' as any, RiskFactor.NEW_COUNTRY, 'unknown2' as any];
      const score = service.calculateRiskScore(factors);

      // Only known factors counted: 25 + 25 = 50
      expect(score).toBe(50);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRiskLevel()', () => {
    it('should classify score as low (0-20)', () => {
      expect(service.getRiskLevel(0)).toBe('low');
      expect(service.getRiskLevel(10)).toBe('low');
      expect(service.getRiskLevel(20)).toBe('low');
    });

    it('should classify score as medium (21-50)', () => {
      expect(service.getRiskLevel(21)).toBe('medium');
      expect(service.getRiskLevel(35)).toBe('medium');
      expect(service.getRiskLevel(50)).toBe('medium');
    });

    it('should classify score as high (51-100)', () => {
      expect(service.getRiskLevel(51)).toBe('high');
      expect(service.getRiskLevel(75)).toBe('high');
      expect(service.getRiskLevel(100)).toBe('high');
    });

    it('should handle edge cases correctly', () => {
      expect(service.getRiskLevel(20)).toBe('low');
      expect(service.getRiskLevel(21)).toBe('medium');
      expect(service.getRiskLevel(50)).toBe('medium');
      expect(service.getRiskLevel(51)).toBe('high');
    });
  });

  describe('Integration scenarios', () => {
    it('should correctly score typical new device scenario', () => {
      const factors = [RiskFactor.NEW_DEVICE];
      const score = service.calculateRiskScore(factors);
      const level = service.getRiskLevel(score);

      expect(score).toBe(25);
      expect(level).toBe('medium');
    });

    it('should correctly score travel scenario', () => {
      const factors = [RiskFactor.NEW_COUNTRY];
      const score = service.calculateRiskScore(factors);
      const level = service.getRiskLevel(score);

      expect(score).toBe(25);
      expect(level).toBe('medium');
    });

    it('should correctly score high-risk scenario', () => {
      const factors = [RiskFactor.NEW_DEVICE, RiskFactor.NEW_COUNTRY, RiskFactor.IMPOSSIBLE_TRAVEL];
      const score = service.calculateRiskScore(factors);
      const level = service.getRiskLevel(score);

      // 25 + 25 + 40 = 90
      expect(score).toBe(90);
      expect(level).toBe('high');
    });

    it('should correctly score suspicious activity scenario', () => {
      const factors = [RiskFactor.SUSPICIOUS_ACTIVITY];
      const score = service.calculateRiskScore(factors);
      const level = service.getRiskLevel(score);

      expect(score).toBe(30);
      expect(level).toBe('medium');
    });
  });
});
