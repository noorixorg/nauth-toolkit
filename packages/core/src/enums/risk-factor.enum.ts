/**
 * Risk Factor Enum
 *
 * Defines all possible risk factors that can be detected during authentication
 * and security events. Used for type safety in risk scoring and audit logging.
 *
 * **Standard Risk Factors (from RiskDetectionService):**
 * - `new_device`: First login from unknown device
 * - `new_ip`: Login from new IP address
 * - `new_country`: Login from different country
 * - `impossible_travel`: Geographic distance/time anomaly
 * - `suspicious_activity`: Unusual behavior patterns
 *
 * **Security Event Risk Factors:**
 * - `token_theft_attempt`: Token theft detected
 * - `refresh_token_reuse_different_session`: Refresh token reused from different session
 * - `token_reuse_attempt`: Token reuse attempt detected
 * - `tampered_device_token`: Device token tampering detected
 * - `mfa_bypass_attempt`: MFA bypass attempt detected
 *
 * @example
 * ```typescript
 * // Type-safe risk factors
 * const riskFactors: RiskFactor[] = [
 *   RiskFactor.NEW_DEVICE,
 *   RiskFactor.NEW_COUNTRY
 * ];
 *
 * // Pass to audit service
 * await auditService.recordEvent({
 *   riskFactors: [RiskFactor.NEW_DEVICE, RiskFactor.TOKEN_REUSE_ATTEMPT],
 * });
 * ```
 */
export enum RiskFactor {
  // ============================================================================
  // Standard Risk Factors (from RiskDetectionService)
  // ============================================================================

  /**
   * First login from unknown device
   * Weight: 25 points (default)
   */
  NEW_DEVICE = 'new_device',

  /**
   * Login from new IP address
   * Weight: 15 points (default)
   * Note: Automatically excluded if new_country or impossible_travel is detected
   */
  NEW_IP = 'new_ip',

  /**
   * Login from different country
   * Weight: 25 points (default)
   */
  NEW_COUNTRY = 'new_country',

  /**
   * Geographic distance/time anomaly (impossible travel)
   * Weight: 40 points (default)
   */
  IMPOSSIBLE_TRAVEL = 'impossible_travel',

  /**
   * Unusual behavior patterns (suspicious activity)
   * Weight: 30 points (default)
   */
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',

  /**
   * Incomplete location data (missing city/coordinates)
   * Weight: 20 points (default)
   * Added when location detection is impaired, reducing confidence in risk assessment
   */
  INCOMPLETE_LOCATION_DATA = 'incomplete_location_data',

  // ============================================================================
  // Security Event Risk Factors
  // ============================================================================

  /**
   * Token theft detected
   * Used when refresh token reuse is detected from different session
   */
  TOKEN_THEFT_ATTEMPT = 'token_theft_attempt',

  /**
   * Refresh token reused from different session
   * Indicates potential token theft or session hijacking
   */
  REFRESH_TOKEN_REUSE_DIFFERENT_SESSION = 'refresh_token_reuse_different_session',

  /**
   * Token reuse attempt detected
   * Used when token reuse is blocked via atomic operations
   */
  TOKEN_REUSE_ATTEMPT = 'token_reuse_attempt',

  /**
   * Device token tampering detected
   * Used when device token is provided but not found in trusted devices
   */
  TAMPERED_DEVICE_TOKEN = 'tampered_device_token',

  /**
   * MFA bypass attempt detected
   * Used when invalid/tampered device token is provided during MFA verification
   */
  MFA_BYPASS_ATTEMPT = 'mfa_bypass_attempt',
}
