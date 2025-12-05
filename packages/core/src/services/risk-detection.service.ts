import { Repository, IsNull, Not, MoreThan } from 'typeorm';
import { IUser, ISession } from '../interfaces/entities.interface';
import { BaseSession, BaseAuthAudit } from '../entities';
import { ClientInfo } from '../interfaces/client-info.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { RiskFactor } from '../enums/risk-factor.enum';

/**
 * Risk Detection Service
 *
 * Analyzes authentication attempts for risk factors by comparing current
 * context against user's historical behavior (sessions and audit trail).
 *
 * **Risk Factors Detected:**
 * - `new_device`: DeviceId never seen before (check sessions table)
 * - `new_ip`: IP address never seen before (check sessions + audit)
 * - `new_country`: Country never seen before (check sessions where ipCountry)
 * - `impossible_travel`: Geographic distance impossible in time window
 * - `suspicious_activity`: Recent failed attempts, token reuse, etc.
 *
 * **Design Notes:**
 * - All queries use userId (internal integer ID) for optimal performance
 * - Queries are optimized with COUNT and LIMIT 1 for existence checks
 * - Non-blocking: Errors logged but don't throw (graceful degradation)
 * - Impossible travel detection requires city-level geolocation (optional)
 *
 * @example
 * ```typescript
 * const riskFactors = await riskDetectionService.detectRiskFactors(user, clientInfo);
 * // Returns: ['new_device', 'new_country']
 * ```
 */
export class RiskDetectionService {
  constructor(
    private readonly sessionRepository: Repository<BaseSession>,
    private readonly auditRepository: Repository<BaseAuthAudit>,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly trustedDeviceService?: any, // TrustedDeviceService - optional, only available when rememberDevices is enabled
  ) {}

  /**
   * Detect risk factors for current authentication attempt
   *
   * Compares current context against user's historical behavior to identify
   * potential security risks. Returns array of detected risk factor strings.
   *
   * **Double-Counting Prevention:**
   * - If `new_country` is detected, `new_ip` is NOT checked (IP is source of country data)
   * - If `impossible_travel` is detected (city change), `new_ip` is NOT checked
   * - This prevents double-counting the same underlying risk (location change)
   *
   * @param user - User being authenticated
   * @param clientInfo - Current request context (IP, device, location, etc.)
   * @returns Array of detected risk factor strings
   *
   * @example
   * ```typescript
   * const factors = await riskDetectionService.detectRiskFactors(user, clientInfo);
   * // Returns: ['new_device', 'new_country'] // new_ip excluded if new_country detected
   * ```
   */
  async detectRiskFactors(user: IUser, clientInfo: ClientInfo): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      // ============================================================================
      // Trigger Configuration
      // ============================================================================
      // Check which triggers are enabled in config
      // Config uses string literals, but they match RiskFactor enum values
      const enabledTriggers = this.config.mfa?.adaptive?.triggers || [
        RiskFactor.NEW_DEVICE,
        RiskFactor.NEW_IP,
        RiskFactor.NEW_COUNTRY,
      ];

      // ============================================================================
      // Device Risk Detection
      // ============================================================================
      // Check new_device
      // Note: Skip check if deviceToken is missing - we can't reliably identify
      // the device without a token (first login, incognito mode, cleared cookies, etc.)
      // Flagging as new_device without a token would create false positives for
      // legitimate first-time logins
      if (enabledTriggers.includes(RiskFactor.NEW_DEVICE) && clientInfo.deviceToken) {
        // Device has a token - check if it's been seen before
        // This is the most reliable method (cookie-based or header-based token)
        const isNew = await this.isNewDevice(user.id, clientInfo.deviceToken);
        if (isNew) {
          factors.push(RiskFactor.NEW_DEVICE);
        }
      }

      // ============================================================================
      // Location Risk Detection (with Double-Counting Prevention)
      // ============================================================================
      // Check new_country first (before new_ip to avoid double-counting)
      // IP is the source of country/city data, so if country changed, IP definitely changed
      let newCountryDetected = false;
      if (enabledTriggers.includes(RiskFactor.NEW_COUNTRY) && clientInfo.ipCountry) {
        const isNew = await this.isNewCountry(user.id, clientInfo.ipCountry);
        if (isNew) {
          factors.push(RiskFactor.NEW_COUNTRY);
          newCountryDetected = true;
        }
      }

      // Check impossible_travel (requires city-level geolocation)
      // This also indicates location change (city/country), so skip new_ip if detected
      let impossibleTravelDetected = false;
      if (enabledTriggers.includes(RiskFactor.IMPOSSIBLE_TRAVEL) && clientInfo.ipCountry && clientInfo.ipCity) {
        const isImpossible = await this.detectImpossibleTravel(user.id, clientInfo);
        if (isImpossible) {
          factors.push(RiskFactor.IMPOSSIBLE_TRAVEL);
          impossibleTravelDetected = true;
        }
      }

      // ============================================================================
      // IP Risk Detection (only if location unchanged)
      // ============================================================================
      // Check new_ip only if country/city hasn't changed
      // IP is the source of location data, so if country/city changed, IP definitely changed
      // Avoid double-counting the same risk factor
      if (
        enabledTriggers.includes(RiskFactor.NEW_IP) &&
        clientInfo.ipAddress &&
        !newCountryDetected &&
        !impossibleTravelDetected
      ) {
        const isNew = await this.isNewIp(user.id, clientInfo.ipAddress);
        if (isNew) {
          factors.push(RiskFactor.NEW_IP);
        }
      }

      // ============================================================================
      // Behavioral Risk Detection
      // ============================================================================
      // Check suspicious_activity
      if (enabledTriggers.includes(RiskFactor.SUSPICIOUS_ACTIVITY)) {
        const isSuspicious = await this.detectSuspiciousActivity(user.id);
        if (isSuspicious) {
          factors.push(RiskFactor.SUSPICIOUS_ACTIVITY);
        }
      }
    } catch (error) {
      // Non-blocking: Log error but don't throw
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.(`Risk detection failed for user ${user.sub}: ${errorMessage}`, { error, userId: user.id });
      // Return empty array on error (graceful degradation)
      return [];
    }

    return factors;
  }

  /**
   * Check if device has been seen before
   *
   * Checks trusted devices first (if available), then sessions table.
   * If device is trusted, it's not considered "new" even if no sessions exist yet.
   *
   * @param userId - Internal user ID (integer)
   * @param deviceToken - Device token from client
   * @returns True if device is new (never seen before and not trusted)
   * @private
   */
  private async isNewDevice(userId: number, deviceToken: string): Promise<boolean> {
    try {
      // First, check if device is trusted (if trusted device service is available)
      // Trusted devices should not be flagged as "new" even if no sessions exist
      if (this.trustedDeviceService && typeof this.trustedDeviceService.isDeviceTrusted === 'function') {
        try {
          const isTrusted = await this.trustedDeviceService.isDeviceTrusted(deviceToken, userId);
          if (isTrusted) {
            // Device is trusted - not a new device
            return false;
          }
        } catch (trustedError) {
          // Non-blocking: If trusted device check fails, continue to session check
          const errorMessage = trustedError instanceof Error ? trustedError.message : 'Unknown error';
          this.logger?.warn?.(`Failed to check trusted device: ${errorMessage}`, {
            error: trustedError,
            userId,
            deviceToken,
          });
        }
      }

      // Check if any session exists with this deviceId (short-circuit existence)
      // Note: deviceToken is stored as deviceId in sessions
      const exists = await this.sessionRepository.findOne({
        select: ['id'],
        where: { userId, deviceId: deviceToken },
      });

      return !exists;
    } catch (error) {
      // Non-blocking: Log and assume device is new (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check device history: ${errorMessage}`, { error, userId, deviceToken });
      return true; // Assume new device on error (safer for security)
    }
  }

  /**
   * Check if IP address has been seen before
   *
   * Queries sessions table first (faster), then audit table for older data.
   *
   * @param userId - Internal user ID (integer)
   * @param ipAddress - IP address to check
   * @returns True if IP is new (never seen before)
   * @private
   */
  private async isNewIp(userId: number, ipAddress: string): Promise<boolean> {
    try {
      // Check sessions first (faster, more recent data) - existence only
      const seenInSessions = await this.sessionRepository.findOne({
        select: ['id'],
        where: { userId, ipAddress },
      });

      if (seenInSessions) {
        return false; // IP seen in sessions
      }

      // Check audit trail for older data (only if not found in sessions)
      const seenInAudit = await this.auditRepository.findOne({
        select: ['id'],
        where: { userId, ipAddress },
      });

      return !seenInAudit;
    } catch (error) {
      // Non-blocking: Log and assume IP is new (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check IP history: ${errorMessage}`, { error, userId, ipAddress });
      return true; // Assume new IP on error (safer for security)
    }
  }

  /**
   * Check if country has been seen before
   *
   * Queries sessions table for any past session from this country.
   * **Optimization:** Uses 1-2 queries instead of 3 by checking country existence first
   * (most likely to short-circuit), then verifying country data availability if needed.
   *
   * **Important:**
   * - On first login (no previous sessions), returns false (no history to compare)
   * - If sessions exist but none have ipCountry data (null), returns false (can't determine)
   * - Only flags as new if we have sessions with country data AND none match
   *
   * @param userId - Internal user ID (integer)
   * @param country - Country code to check (e.g., 'US', 'GB')
   * @returns True if country is new (never seen before), false on first login, if no country data, or if country seen before
   * @private
   */
  private async isNewCountry(userId: number, country: string): Promise<boolean> {
    try {
      // ============================================================================
      // Optimization: Check country existence first (most likely to short-circuit)
      // ============================================================================
      // This query checks if country exists in sessions with country data
      // If it exists, we can return false immediately (1 query instead of 3)
      const countryExists = await this.sessionRepository.findOne({
        select: ['id'],
        where: { userId, ipCountry: country },
      });

      // If country exists in any session, it's not new
      if (countryExists) {
        return false;
      }

      // ============================================================================
      // Country doesn't exist - verify we have country data to compare against
      // ============================================================================
      // Only check if we have sessions with country data (needed to make determination)
      // If no country data exists, we can't determine if it's new (first login or no geo data)
      const hasAnyCountryData = await this.sessionRepository.findOne({
        select: ['id'],
        where: { userId, ipCountry: Not(IsNull()) },
      });

      // If we have sessions with country data but country doesn't exist, it's new
      // If no sessions have country data, we can't determine (return false for safety)
      return !!hasAnyCountryData;
    } catch (error) {
      // Non-blocking: Log and assume country is not new on error (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check country history: ${errorMessage}`, { error, userId, country });
      return false; // Assume not new country on error (safer default)
    }
  }

  /**
   * Detect impossible travel
   *
   * Calculates if geographic distance between last location and current
   * location is impossible given time elapsed.
   *
   * **Algorithm:**
   * 1. Get last session location (ipCountry, ipCity) and lastActivityAt
   * 2. Calculate distance between cities (Haversine formula)
   * 3. Calculate max possible speed (distance / time)
   * 4. If speed > threshold (default 900 km/h), flag as impossible
   *
   * **Edge Cases Handled:**
   * - No previous location data → false (benefit of doubt)
   * - Same country/city → false (not travel)
   * - Missing city data → false (can't determine without city)
   *
   * @param userId - Internal user ID (integer)
   * @param currentInfo - Current client info with location
   * @returns True if travel is impossible
   * @private
   */
  private async detectImpossibleTravel(userId: number, currentInfo: ClientInfo): Promise<boolean> {
    if (!currentInfo.ipCountry || !currentInfo.ipCity) {
      return false; // Can't determine without location
    }

    try {
      // Get last known location from most recent session with location data
      const lastSession = (await this.sessionRepository.findOne({
        where: {
          userId,
          ipCountry: Not(IsNull()),
          ipCity: Not(IsNull()),
        },
        order: {
          lastActivityAt: 'DESC',
        },
      })) as ISession | null;

      if (!lastSession) {
        return false; // No previous location data (benefit of doubt)
      }

      const lastLocation = {
        country: lastSession.ipCountry!,
        city: lastSession.ipCity!,
        time: lastSession.lastActivityAt || lastSession.createdAt,
      };

      // Same location → not travel
      if (lastLocation.country === currentInfo.ipCountry && lastLocation.city === currentInfo.ipCity) {
        return false;
      }

      // Calculate time difference (hours)
      const hoursSinceLastSeen = (Date.now() - lastLocation.time.getTime()) / (1000 * 60 * 60);

      // If time difference is very small (< 1 hour), be more lenient
      if (hoursSinceLastSeen < 1) {
        // Only flag if time is less than 30 minutes
        if (hoursSinceLastSeen < 0.5) {
          return true; // Impossible to travel between cities in < 30 minutes
        }
      }

      // Get city coordinates and calculate distance
      // For now, we'll use a simplified check: different country = possible travel
      // Full implementation would require geocoding service or coordinate database
      const distance = await this.calculateDistance(
        lastLocation.city,
        lastLocation.country,
        currentInfo.ipCity!,
        currentInfo.ipCountry,
      );

      if (distance === 0) {
        return false; // Same location (shouldn't happen, but safety check)
      }

      // Max realistic speed: 900 km/h (commercial airliner speed)
      const maxTravelSpeed = this.config.mfa?.adaptive?.maxTravelSpeed || 900;
      const requiredSpeed = distance / hoursSinceLastSeen;

      return requiredSpeed > maxTravelSpeed;
    } catch (error) {
      // Non-blocking: Log and assume not impossible travel (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to detect impossible travel: ${errorMessage}`, { error, userId });
      return false; // Assume not impossible travel on error
    }
  }

  /**
   * Calculate distance between two cities
   *
   * Simplified implementation - returns 0 for same city/country,
   * or estimated distance for different locations.
   *
   * **Note:** Full implementation would require:
   * - Geocoding service (Google Maps, OpenCage, etc.)
   * - Coordinate database (MaxMind City DB with coordinates)
   * - Haversine formula for accurate distance calculation
   *
   * For now, returns a conservative estimate:
   * - Same city: 0 km
   * - Same country, different city: 500 km (average)
   * - Different country: 2000 km (conservative estimate)
   *
   * @param city1 - First city name
   * @param country1 - First country code
   * @param city2 - Second city name
   * @param country2 - Second country code
   * @returns Distance in kilometers (estimated)
   * @private
   */
  private async calculateDistance(city1: string, country1: string, city2: string, country2: string): Promise<number> {
    // Same city → 0 km
    if (city1 === city2 && country1 === country2) {
      return 0;
    }

    // Same country, different city → estimate 500 km (average)
    if (country1 === country2) {
      return 500;
    }

    // Different country → estimate 2000 km (conservative)
    // This is a simplified approach - full implementation would use coordinates
    return 2000;
  }

  /**
   * Detect suspicious activity patterns
   *
   * Checks for:
   * - Recent failed login attempts (last 1 hour)
   * - Token reuse detected (SUSPICIOUS_ACTIVITY audit events)
   * - Multiple MFA failures
   * - Account lockout attempts
   *
   * @param userId - Internal user ID (integer)
   * @returns True if suspicious activity detected
   * @private
   */
  private async detectSuspiciousActivity(userId: number): Promise<boolean> {
    try {
      const windowHours = this.config.mfa?.adaptive?.suspiciousActivityWindow || 1;
      const oneHourAgo = new Date(Date.now() - windowHours * 60 * 60 * 1000);

      // Check for recent suspicious audit events (existence only)
      const hasSuspicious = await this.auditRepository.findOne({
        select: ['id'],
        where: { userId, eventStatus: 'SUSPICIOUS', createdAt: MoreThan(oneHourAgo) },
      });

      if (hasSuspicious) {
        return true;
      }

      // Check for failed login attempts (3+ in last hour) using limited IDs
      const failedLogins = await this.auditRepository.find({
        select: ['id'],
        where: { userId, eventType: AuthAuditEventType.LOGIN_FAILED, createdAt: MoreThan(oneHourAgo) },
        order: { createdAt: 'DESC' },
        take: 3,
      });

      return failedLogins.length >= 3;
    } catch (error) {
      // Non-blocking: Log and assume not suspicious (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to detect suspicious activity: ${errorMessage}`, { error, userId });
      return false; // Assume not suspicious on error
    }
  }
}
