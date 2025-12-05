"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScoringService = void 0;
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
var RiskScoringService = /** @class */ (function () {
    function RiskScoringService(config, logger) {
        this.config = config;
        this.logger = logger;
        /**
         * Default risk factor weights
         *
         * Conservative defaults aligned with security best practices:
         * - `new_device`: 25 points (medium risk - always requires MFA on first login)
         * - `new_ip`: 15 points (lower - common occurrence)
         * - `new_country`: 25 points (higher - significant geographic change)
         * - `impossible_travel`: 40 points (critical - strong indicator of account compromise)
         * - `suspicious_activity`: 30 points (high - recent security events)
         *
         * **Note:** `new_device` weight is set to 25 to ensure it always triggers medium risk
         * (21-50 range) and requires MFA, which is important for first-time logins.
         */
        this.defaultWeights = {
            new_device: 25,
            new_ip: 15,
            new_country: 25,
            impossible_travel: 40,
            suspicious_activity: 30,
        };
    }
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
     * // Returns: 45 (20 + 25)
     * ```
     */
    RiskScoringService.prototype.calculateRiskScore = function (riskFactors) {
        var _a, _b, _c, _d;
        // Get weights from config or use defaults
        var weights = ((_b = (_a = this.config.mfa) === null || _a === void 0 ? void 0 : _a.adaptive) === null || _b === void 0 ? void 0 : _b.riskWeights) || this.defaultWeights;
        var score = 0;
        for (var _i = 0, riskFactors_1 = riskFactors; _i < riskFactors_1.length; _i++) {
            var factor = riskFactors_1[_i];
            var weight = weights[factor];
            if (weight !== undefined) {
                score += weight;
            }
            else {
                // Unknown factor - log warning but don't fail
                (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, "Unknown risk factor: ".concat(factor, ", ignoring in score calculation"));
            }
        }
        // Cap at 100 (maximum risk)
        return Math.min(score, 100);
    };
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
    RiskScoringService.prototype.getRiskLevel = function (score) {
        if (score <= 20) {
            return 'low';
        }
        if (score <= 50) {
            return 'medium';
        }
        return 'high';
    };
    return RiskScoringService;
}());
exports.RiskScoringService = RiskScoringService;
