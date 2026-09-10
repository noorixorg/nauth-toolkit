import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { RiskFactor } from '../enums/risk-factor.enum';

/**
 * Risk Scoring Service
 *
 * Calculates risk scores (0-100) based on detected risk factors.
 * Uses configurable weights for each risk factor to determine overall risk.
 *
 * **Default Weights (aligned with NIST 800-63B recommendations):**
 * - new_device: 25 points (medium risk - ensures MFA on first login)
 * - new_ip: 15 points (only used if country/city unchanged - see RiskDetectionService)
 * - new_country: 25 points (higher - significant geographic change)
 * - impossible_travel: 40 points (critical - strong indicator of account compromise)
 * - suspicious_activity: 30 points (high - recent security events)
 * - incomplete_location_data: 20 points (medium-high - reduced confidence in risk assessment)
 * - recent_password_reset: 40 points (critical - account recovery activity)
 *
 * **Note:** `new_ip` is automatically excluded when `new_country` or `impossible_travel`
 * is detected to prevent double-counting (IP is the source of location data).
 *
 * **Risk Levels:**
 * - 0-20: Low (no MFA required for ADAPTIVE)
 * - 21-50: Medium (MFA recommended)
 * - 51-100: High (MFA required)
 *
 * **Design Notes:**
 * - Weights are additive (sum all factor weights)
 * - Score is capped at 100 (maximum risk)
 * - Default weights are conservative and security-focused
 * - Configurable per installation via adaptive.riskWeights
 *
 * @example
 * ```typescript
 * const score = riskScoringService.calculateRiskScore(['new_device', 'new_country']);
 * // Returns: 45 (20 + 25)
 *
 * const level = riskScoringService.getRiskLevel(45);
 * // Returns: 'medium'
 * ```
 */
export class RiskScoringService {
  /**
   * Default risk factor weights
   *
   * Conservative defaults aligned with security best practices:
   * - `new_device`: 25 points (medium risk - always requires MFA on first login)
   * - `new_ip`: 15 points (lower - common occurrence)
   * - `new_country`: 25 points (higher - significant geographic change)
   * - `impossible_travel`: 40 points (critical - strong indicator of account compromise)
   * - `suspicious_activity`: 30 points (high - recent security events)
   * - `incomplete_location_data`: 20 points (medium-high - reduced confidence in risk assessment)
   *
   * **Note:** `new_device` weight is set to 25 to ensure it always triggers medium risk
   * (21-50 range) and requires MFA, which is important for first-time logins.
   */
  private readonly defaultWeights: Record<string, number> = {
    new_device: 25,
    new_ip: 15,
    new_country: 25,
    impossible_travel: 40,
    suspicious_activity: 30,
    incomplete_location_data: 20,
    recent_password_reset: 40,
  };

  constructor(
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
  ) {}

  /**
   * Calculate risk score from detected factors
   *
   * Sums the weights of all detected risk factors and caps at 100.
   * Uses configured risk weights if available, otherwise uses defaults.
   *
   * @param riskFactors - Array of detected risk factor strings
   * @returns Risk score (0-100, capped at 100)
   *
   * @example
   * ```typescript
   * const score = riskScoringService.calculateRiskScore(['new_device', 'new_country']);
   * // Returns: 50 (25 + 25)
   * ```
   */
  calculateRiskScore(riskFactors: RiskFactor[]): number {
    // Merge over the defaults rather than replacing them.
    //
    // Replacing meant a config that tuned one weight silently dropped every other
    // factor to zero - they resolved to undefined, logged as "unknown", and stopped
    // contributing. Someone lowering `new_device` would have turned off
    // impossible_travel detection without any indication. `riskLevels` already merges
    // per key; this now matches.
    const weights = { ...this.defaultWeights, ...(this.config.mfa?.adaptive?.riskWeights ?? {}) };

    let score = 0;
    for (const factor of riskFactors) {
      const weight = weights[factor];
      if (weight !== undefined) {
        score += weight;
      } else {
        // Unknown factor - log warning but don't fail
        this.logger?.warn?.(`Unknown risk factor: ${factor}, ignoring in score calculation`);
      }
    }

    // Cap at 100 (maximum risk)
    return Math.min(score, 100);
  }

  /**
   * Get risk level classification
   *
   * Classifies risk score into one of three levels:
   * - low: 0-20 (no MFA required for ADAPTIVE)
   * - medium: 21-50 (MFA recommended)
   * - high: 51-100 (MFA required)
   *
   * @param score - Risk score (0-100)
   * @returns Risk level classification
   *
   * @example
   * ```typescript
   * const level = riskScoringService.getRiskLevel(45);
   * // Returns: 'medium'
   * ```
   */
  getRiskLevel(score: number): 'low' | 'medium' | 'high' {
    // Read the same configured thresholds the decision service applies. Hardcoding
    // 20/50 here meant a consumer who moved the bands got a level from this method that
    // disagreed with the action actually taken.
    const riskLevels = this.config.mfa?.adaptive?.riskLevels;

    if (score <= (riskLevels?.low?.maxScore ?? 20)) {
      return 'low';
    }
    if (score <= (riskLevels?.medium?.maxScore ?? 50)) {
      return 'medium';
    }
    return 'high';
  }
}
