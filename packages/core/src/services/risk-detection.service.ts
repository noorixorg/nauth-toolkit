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
    private readonly trustedDeviceService?: {
      isDeviceTrusted: (deviceToken: string, userId: number) => Promise<boolean>;
    }, // TrustedDeviceService - optional, only available when rememberDevices is enabled
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

      this.logger?.debug?.(
        `Risk detection started for user ${user.sub}: enabled_triggers=[${enabledTriggers.join(', ')}], has_device_token=${!!clientInfo.deviceToken}, ip=${clientInfo.ipAddress}, location=${clientInfo.ipCity}, ${clientInfo.ipCountry}`,
      );

      // ============================================================================
      // Device Risk Detection
      // ============================================================================
      // Check new_device
      if (enabledTriggers.includes(RiskFactor.NEW_DEVICE)) {
        if (clientInfo.deviceToken) {
          // Device has a token - check if it's been seen before
          // This is the most reliable method (cookie-based or header-based token)
          const isNew = await this.isNewDevice(user.id, clientInfo.deviceToken);
          if (isNew) {
            factors.push(RiskFactor.NEW_DEVICE);
            this.logger?.debug?.(
              `New device detected: user=${user.sub}, deviceToken=${clientInfo.deviceToken.substring(0, 8)}...`,
            );
          }
        } else {
          // No deviceToken (incognito mode, cleared cookies, first login, etc.)
          // Check if user has logged in before - if yes, missing token is suspicious
          // This prevents false positives for legitimate first-time logins
          const hasPreviousSessions = await this.hasUserLoggedInBefore(user.id);
          if (hasPreviousSessions) {
            // User has logged in before but no deviceToken - treat as new/unknown device
            // This covers incognito mode, cleared cookies, and other scenarios where
            // device identification is not available
            factors.push(RiskFactor.NEW_DEVICE);
            this.logger?.debug?.(
              `Missing deviceToken for user ${user.sub} with previous sessions - treating as new_device`,
            );
          }
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
          this.logger?.debug?.(`New country detected for user ${user.sub}: ${clientInfo.ipCountry}`);
        }
      }

      // Check impossible_travel (now works with country-only data too)
      // This also indicates location change (city/country), so skip new_ip if detected
      let impossibleTravelDetected = false;
      if (enabledTriggers.includes(RiskFactor.IMPOSSIBLE_TRAVEL) && clientInfo.ipCountry) {
        const isImpossible = await this.detectImpossibleTravel(user.id, clientInfo);
        if (isImpossible) {
          factors.push(RiskFactor.IMPOSSIBLE_TRAVEL);
          impossibleTravelDetected = true;
          this.logger?.debug?.(
            `Impossible travel detected for user ${user.sub}: ${clientInfo.ipCity ?? 'unknown'}, ${clientInfo.ipCountry}`,
          );
        }
      }

      // ============================================================================
      // Location Data Completeness Check
      // ============================================================================
      // Add risk factor if location data is incomplete (missing city or coordinates) when country exists
      // AND user has previous logins (only relevant for returning users)
      // This reduces confidence in risk assessment and warrants extra caution
      // Only check if location-related triggers are enabled
      const locationTriggersEnabled =
        enabledTriggers.includes(RiskFactor.NEW_COUNTRY) || enabledTriggers.includes(RiskFactor.IMPOSSIBLE_TRAVEL);
      if (
        locationTriggersEnabled &&
        clientInfo.ipCountry &&
        (!clientInfo.ipCity || !clientInfo.ipLatitude || !clientInfo.ipLongitude) &&
        (await this.hasUserLoggedInBefore(user.id))
      ) {
        factors.push(RiskFactor.INCOMPLETE_LOCATION_DATA);
        this.logger?.warn?.(
          `Incomplete location data for user ${user.sub}: country=${clientInfo.ipCountry}, ` +
            `city=${clientInfo.ipCity ?? 'missing'}, coordinates=${clientInfo.ipLatitude && clientInfo.ipLongitude ? 'available' : 'missing'}. ` +
            `Adding INCOMPLETE_LOCATION_DATA risk factor (+20 points) for reduced confidence in risk assessment.`,
        );
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
        // Normalize IP address (remove port if present, e.g., "192.168.1.1:8080" -> "192.168.1.1")
        const normalizedIp = this.normalizeIpAddress(clientInfo.ipAddress);
        const isNew = await this.isNewIp(user.id, normalizedIp);
        if (isNew) {
          factors.push(RiskFactor.NEW_IP);
          this.logger?.debug?.(
            `New IP detected for user ${user.sub}: ${normalizedIp} (original: ${clientInfo.ipAddress})`,
          );
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
          this.logger?.debug?.(`Suspicious activity detected for user ${user.sub}`);
        }
      }

      // ============================================================================
      // Summary
      // ============================================================================
      if (factors.length > 0) {
        this.logger?.debug?.(
          `Risk detection complete for user ${user.sub}: ${factors.length} factor(s) detected [${factors.join(', ')}]`,
        );
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
   * Check if user has logged in before (has any previous sessions)
   *
   * Used to determine if missing deviceToken should be treated as suspicious.
   * If user has never logged in before, missing token is expected (first login).
   * If user has logged in before, missing token is suspicious (incognito, cleared cookies, etc.).
   *
   * @param userId - Internal user ID (integer)
   * @returns True if user has at least one previous session
   * @private
   */
  private async hasUserLoggedInBefore(userId: number): Promise<boolean> {
    try {
      // Check if any session exists for this user (short-circuit existence check)
      const exists = await this.sessionRepository.findOne({
        select: ['id'],
        where: { userId },
      });

      return !!exists;
    } catch (error) {
      // Non-blocking: Log and assume user has logged in before (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check user login history: ${errorMessage}`, { error, userId });
      return true; // Assume user has logged in before on error (safer for security)
    }
  }

  /**
   * Normalize IP address for consistent comparison
   *
   * Removes port numbers and normalizes IPv6 addresses.
   * This ensures IPs like "192.168.1.1:8080" and "192.168.1.1" are treated as the same.
   *
   * @param ipAddress - IP address to normalize
   * @returns Normalized IP address
   * @private
   */
  private normalizeIpAddress(ipAddress: string): string {
    // Remove port if present (e.g., "192.168.1.1:8080" -> "192.168.1.1")
    // Handle both IPv4 and IPv6 formats
    if (ipAddress.includes(':')) {
      // Could be IPv6 or IPv4 with port
      if (ipAddress.startsWith('[')) {
        // IPv6 with port: "[::1]:8080" -> "::1"
        const match = ipAddress.match(/^\[(.+)\]:\d+$/);
        if (match) {
          return match[1];
        }
      } else {
        // IPv4 with port: "192.168.1.1:8080" -> "192.168.1.1"
        const parts = ipAddress.split(':');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
          // Second part is a port number
          return parts[0];
        }
        // Otherwise it's likely IPv6 without brackets, return as-is
      }
    }
    return ipAddress;
  }

  /**
   * Check if IP address has been seen before
   *
   * Queries sessions table first (faster), then audit table for older data.
   * Uses normalized IP addresses for consistent comparison.
   *
   * @param userId - Internal user ID (integer)
   * @param ipAddress - IP address to check (should already be normalized)
   * @returns True if IP is new (never seen before)
   * @private
   */
  private async isNewIp(userId: number, ipAddress: string): Promise<boolean> {
    try {
      // Normalize IP address before checking (in case it wasn't normalized upstream)
      const normalizedIp = this.normalizeIpAddress(ipAddress);

      // Check sessions first (faster, more recent data) - existence only
      // Note: We check both normalized and original IP to handle cases where
      // old records might have stored IPs with ports
      const seenInSessions =
        (await this.sessionRepository.findOne({
          select: ['id'],
          where: { userId, ipAddress: normalizedIp },
        })) ||
        (normalizedIp !== ipAddress &&
          (await this.sessionRepository.findOne({
            select: ['id'],
            where: { userId, ipAddress },
          })));

      if (seenInSessions) {
        return false; // IP seen in sessions
      }

      // Check audit trail for older data (only if not found in sessions)
      const seenInAudit =
        (await this.auditRepository.findOne({
          select: ['id'],
          where: { userId, ipAddress: normalizedIp },
        })) ||
        (normalizedIp !== ipAddress &&
          (await this.auditRepository.findOne({
            select: ['id'],
            where: { userId, ipAddress },
          })));

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
   * 1. Get last login location (ipCountry, ipCity, coordinates) and createdAt
   * 2. Calculate distance using coordinates (Haversine) or heuristics (fallback)
   * 3. Calculate max possible speed (distance / time)
   * 4. If speed > threshold (default 900 km/h), flag as impossible
   *
   * **Edge Cases Handled:**
   * - No previous location data → false (benefit of doubt)
   * - Same location → false (not travel)
   * - Missing city but country changed → true (suspicious, different country in short time)
   * - Missing coordinates → use heuristic distance estimates
   *
   * @param userId - Internal user ID (integer)
   * @param currentInfo - Current client info with location
   * @returns True if travel is impossible
   * @private
   */
  private async detectImpossibleTravel(userId: number, currentInfo: ClientInfo): Promise<boolean> {
    // Require at least country data to perform any checks
    if (!currentInfo.ipCountry) {
      this.logger?.debug?.(`Skipping impossible_travel check for user ${userId}: no country data available`);
      return false;
    }

    try {
      // ============================================================================
      // Find last known location from most recent login
      // ============================================================================
      // CRITICAL: We need the location from the PREVIOUS login, not token refreshes
      // Check BOTH sessions and audit trail to ensure we get the most recent location:
      // - Sessions: might be cleaned up or expired
      // - Audit: permanent record of all logins
      // Use the more recent of the two

      // ============================================================================
      // Find previous login location (exclude current login to avoid race conditions)
      // ============================================================================
      // SIMPLIFIED LOGIC: Just get the most recent login from EITHER sessions OR audits
      // The current login hasn't been committed yet (we're in risk detection before session creation)
      // So the "most recent" we find IS the previous login

      // Check sessions (use createdAt for login-to-login comparison, not lastActivityAt)
      const lastSession = (await this.sessionRepository.findOne({
        where: {
          userId,
          ipCountry: Not(IsNull()),
        },
        order: {
          createdAt: 'DESC', // Most recent first
        },
      })) as ISession | null;

      // Check audit trail for most recent login with location data
      const lastAuditLogin = (await this.auditRepository.findOne({
        where: {
          userId,
          eventType: AuthAuditEventType.LOGIN_SUCCESS,
          ipCountry: Not(IsNull()),
        },
        order: {
          createdAt: 'DESC',
        },
      })) as
        | (BaseAuthAudit & {
            ipCountry: string;
            ipCity: string | null;
            ipLatitude: number | null;
            ipLongitude: number | null;
            createdAt: Date;
          })
        | null;

      // ============================================================================
      // Debug Dumps (optional)
      // ============================================================================
      // WHY: These queries are expensive and should only run when a real NAuthLogger
      // instance is wired (consumer provided a logger). Unit tests frequently use
      // plain object mocks that do NOT implement `isEnabled()`.
      const loggerEnabled =
        typeof (this.logger as unknown as { isEnabled?: () => boolean }).isEnabled === 'function'
          ? (this.logger as unknown as { isEnabled: () => boolean }).isEnabled()
          : false;

      if (loggerEnabled && lastSession) {
        const allRecentSessions = (await this.sessionRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 5,
          select: ['id', 'ipCity', 'ipCountry', 'createdAt', 'ipAddress'],
        })) as Array<{
          id: number;
          ipCity: string | null;
          ipCountry: string | null;
          createdAt: Date;
          ipAddress: string | null;
        }>;

        this.logger?.debug?.(
          `Last 5 sessions for user ${userId}: ${JSON.stringify(
            allRecentSessions.map((s) => ({
              id: s.id,
              location: `${s.ipCity}, ${s.ipCountry}`,
              ip: s.ipAddress,
              created: s.createdAt.toISOString(),
              ageMinutes: ((Date.now() - s.createdAt.getTime()) / (1000 * 60)).toFixed(1),
            })),
          )}`,
        );
      }

      if (loggerEnabled && lastAuditLogin) {
        const allRecentAudits = (await this.auditRepository.find({
          where: { userId, eventType: AuthAuditEventType.LOGIN_SUCCESS },
          order: { createdAt: 'DESC' },
          take: 5,
          select: ['id', 'ipCity', 'ipCountry', 'createdAt', 'ipAddress'],
        })) as Array<{
          id: number;
          ipCity: string | null;
          ipCountry: string | null;
          createdAt: Date;
          ipAddress: string | null;
        }>;

        this.logger?.debug?.(
          `Last 5 LOGIN_SUCCESS audits for user ${userId}: ${JSON.stringify(
            allRecentAudits.map((a) => ({
              id: a.id,
              location: `${a.ipCity}, ${a.ipCountry}`,
              ip: a.ipAddress,
              created: a.createdAt.toISOString(),
              ageMinutes: ((Date.now() - a.createdAt.getTime()) / (1000 * 60)).toFixed(1),
            })),
          )}`,
        );
      }

      // Determine which record is more recent and extract location data with coordinates
      let lastLocation: {
        country: string;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        time: Date;
        source: 'session' | 'audit';
      } | null = null;

      if (lastSession && lastAuditLogin) {
        // Both exist - use the more recent one as the previous login
        const sessionTime = lastSession.createdAt;
        const auditTime = lastAuditLogin.createdAt;

        if (sessionTime > auditTime) {
          lastLocation = {
            country: lastSession.ipCountry!,
            city: lastSession.ipCity ?? null,
            latitude: (lastSession as any).ipLatitude ?? null,
            longitude: (lastSession as any).ipLongitude ?? null,
            time: sessionTime,
            source: 'session',
          };
        } else {
          lastLocation = {
            country: lastAuditLogin.ipCountry!,
            city: lastAuditLogin.ipCity ?? null,
            latitude: lastAuditLogin.ipLatitude ?? null,
            longitude: lastAuditLogin.ipLongitude ?? null,
            time: auditTime,
            source: 'audit',
          };
        }
      } else if (lastSession) {
        lastLocation = {
          country: lastSession.ipCountry!,
          city: lastSession.ipCity ?? null,
          latitude: (lastSession as any).ipLatitude ?? null,
          longitude: (lastSession as any).ipLongitude ?? null,
          time: lastSession.createdAt,
          source: 'session',
        };
      } else if (lastAuditLogin) {
        lastLocation = {
          country: lastAuditLogin.ipCountry!,
          city: lastAuditLogin.ipCity ?? null,
          latitude: lastAuditLogin.ipLatitude ?? null,
          longitude: lastAuditLogin.ipLongitude ?? null,
          time: lastAuditLogin.createdAt,
          source: 'audit',
        };
      }

      if (!lastLocation) {
        this.logger?.debug?.(`No previous location data found for user ${userId} (no sessions or audit records)`);
        return false; // No previous location data (benefit of doubt)
      }

      // Debug logging to help diagnose issues
      const hasCoordinates = !!(
        lastLocation.latitude &&
        lastLocation.longitude &&
        currentInfo.ipLatitude &&
        currentInfo.ipLongitude
      );

      this.logger?.debug?.(
        `Impossible travel check: user=${userId}, source=${lastLocation.source}, ` +
          `last=[${lastLocation.city ?? 'unknown'}, ${lastLocation.country} @ ${lastLocation.time.toISOString()}], ` +
          `current=[${currentInfo.ipCity ?? 'unknown'}, ${currentInfo.ipCountry}], ` +
          `coordinates=${hasCoordinates ? 'available' : 'missing'}`,
      );

      // Same location → not travel (only if we have city data to compare)
      if (
        lastLocation.city &&
        currentInfo.ipCity &&
        lastLocation.country === currentInfo.ipCountry &&
        lastLocation.city === currentInfo.ipCity
      ) {
        this.logger?.debug?.(
          `Same location detected - no travel: user=${userId}, location=[${currentInfo.ipCity}, ${currentInfo.ipCountry}]`,
        );
        return false;
      }

      // Calculate time difference (hours)
      // Risk detection runs BEFORE session creation, so we compare current time to previous login
      // All times are in UTC (database stores timestamps in UTC)
      const now = new Date();
      const hoursSinceLastSeen = (now.getTime() - lastLocation.time.getTime()) / (1000 * 60 * 60);

      this.logger?.debug?.(
        `Time since last location: ${hoursSinceLastSeen.toFixed(2)} hours (${(hoursSinceLastSeen * 60).toFixed(1)} minutes). ` +
          `Previous login: ${lastLocation.time.toISOString()} (UTC), Current: ${now.toISOString()} (UTC)`,
      );

      // ============================================================================
      // SPECIAL CASE: Country change with missing city data
      // ============================================================================
      // If city data is missing for either location but countries differ,
      // apply conservative threshold for country-level changes
      if (lastLocation.country !== currentInfo.ipCountry) {
        if (!lastLocation.city || !currentInfo.ipCity) {
          // Missing city data - use conservative threshold for country changes
          // If country changed in < threshold hours, flag as suspicious (can't verify exact locations)
          const countryChangeThresholdHours = this.config.mfa?.adaptive?.countryChangeThreshold || 2;

          if (hoursSinceLastSeen < countryChangeThresholdHours) {
            this.logger?.warn?.(
              `Impossible travel detected (country change without city data): ` +
                `${lastLocation.country} → ${currentInfo.ipCountry} in ${(hoursSinceLastSeen * 60).toFixed(1)} minutes ` +
                `(threshold: ${countryChangeThresholdHours}h). Missing city: last=${!lastLocation.city}, current=${!currentInfo.ipCity}. ` +
                `Conservative detection applied due to incomplete location data.`,
            );
            return true;
          }

          this.logger?.debug?.(
            `Country change acceptable: ${lastLocation.country} → ${currentInfo.ipCountry} ` +
              `in ${hoursSinceLastSeen.toFixed(2)}h (> ${countryChangeThresholdHours}h threshold). ` +
              `City data missing but time allows travel.`,
          );
          return false;
        }
      }

      // ============================================================================
      // NORMAL CASE: Calculate distance using coordinates or heuristics
      // ============================================================================
      let distance: number;
      let distanceMethod: 'haversine' | 'heuristic' = 'heuristic';

      // Try to use actual coordinates for precise distance calculation
      if (hasCoordinates) {
        distance = this.calculateHaversineDistance(
          lastLocation.latitude!,
          lastLocation.longitude!,
          currentInfo.ipLatitude!,
          currentInfo.ipLongitude!,
        );
        distanceMethod = 'haversine';

        this.logger?.debug?.(
          `Using Haversine formula with coordinates: distance=${distance.toFixed(0)}km ` +
            `(${lastLocation.latitude},${lastLocation.longitude} → ${currentInfo.ipLatitude},${currentInfo.ipLongitude})`,
        );
      } else {
        // Fallback to heuristic distance estimation
        distance = await this.calculateDistance(
          lastLocation.city,
          lastLocation.country,
          currentInfo.ipCity ?? null,
          currentInfo.ipCountry,
        );

        this.logger?.debug?.(`Using heuristic distance estimation (coordinates unavailable): distance=${distance}km`);
      }

      if (distance === 0) {
        return false; // Same location (shouldn't happen, but safety check)
      }

      // Max realistic speed: 900 km/h (commercial airliner speed)
      const maxTravelSpeed = this.config.mfa?.adaptive?.maxTravelSpeed || 900;
      const requiredSpeed = distance / hoursSinceLastSeen;

      this.logger?.debug?.(
        `Travel speed calculation (${distanceMethod}): distance=${distance.toFixed(0)}km, ` +
          `time=${hoursSinceLastSeen.toFixed(2)}h, required_speed=${requiredSpeed.toFixed(0)}km/h, ` +
          `max_allowed=${maxTravelSpeed}km/h`,
      );

      const isImpossible = requiredSpeed > maxTravelSpeed;
      if (isImpossible) {
        this.logger?.warn?.(
          `Impossible travel detected: ${requiredSpeed.toFixed(0)}km/h > ${maxTravelSpeed}km/h ` +
            `(${lastLocation.city ?? lastLocation.country}, ${lastLocation.country} → ` +
            `${currentInfo.ipCity ?? currentInfo.ipCountry}, ${currentInfo.ipCountry})`,
        );
      } else {
        this.logger?.debug?.(
          `Travel is possible: ${requiredSpeed.toFixed(0)}km/h <= ${maxTravelSpeed}km/h ` +
            `(${lastLocation.city ?? lastLocation.country}, ${lastLocation.country} → ` +
            `${currentInfo.ipCity ?? currentInfo.ipCountry}, ${currentInfo.ipCountry})`,
        );
      }

      return isImpossible;
    } catch (error) {
      // Non-blocking: Log and assume not impossible travel (safer default)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to detect impossible travel: ${errorMessage}`, { error, userId });
      return false; // Assume not impossible travel on error
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   *
   * Accurate distance calculation using geographic coordinates (latitude/longitude).
   * This is the preferred method when coordinates are available.
   *
   * **Haversine Formula:**
   * - Accounts for Earth's spherical shape
   * - Returns great-circle distance in kilometers
   * - Accuracy: ~0.5% for most distances
   *
   * @param lat1 - Latitude of first point (degrees)
   * @param lon1 - Longitude of first point (degrees)
   * @param lat2 - Latitude of second point (degrees)
   * @param lon2 - Longitude of second point (degrees)
   * @returns Distance in kilometers (accurate)
   * @private
   */
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Convert degrees to radians
   *
   * @param degrees - Angle in degrees
   * @returns Angle in radians
   * @private
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate distance between two cities (heuristic fallback)
   *
   * Heuristic-based implementation for estimating travel distance when
   * precise coordinates are not available. Uses continent and regional
   * groupings for realistic estimates.
   *
   * **Fallback approach:**
   * - Same city: 0 km
   * - Same country, different city: 500 km (average domestic travel)
   * - Different country, same continent: 1,500 km (regional travel)
   * - Different continent (intercontinental): 8,000 km (long-haul flight)
   * - Missing city data: use country-level comparison
   *
   * @param city1 - First city name (nullable)
   * @param country1 - First country code (ISO 2-letter)
   * @param city2 - Second city name (nullable)
   * @param country2 - Second country code (ISO 2-letter)
   * @returns Distance in kilometers (estimated)
   * @private
   */
  private async calculateDistance(
    city1: string | null,
    country1: string,
    city2: string | null,
    country2: string,
  ): Promise<number> {
    // Same city and country → 0 km (only if both cities are known)
    if (city1 && city2 && city1 === city2 && country1 === country2) {
      return 0;
    }

    // Same country → estimate 500 km (average domestic travel)
    if (country1 === country2) {
      return 500;
    }

    // Different country - determine if same continent or intercontinental
    const continent1 = this.getContinent(country1);
    const continent2 = this.getContinent(country2);

    if (continent1 === continent2 && continent1 !== 'unknown') {
      // Same continent, different country → estimate 1,500 km (regional travel)
      // Examples: Paris-Berlin (880km), London-Rome (1,400km), Sydney-Auckland (2,160km)
      return 1500;
    }

    // Different continent → estimate 8,000 km (intercontinental long-haul)
    // Examples: NYC-London (5,570km), Tokyo-Sydney (7,800km), Auckland-Karachi (9,700km)
    // Using 8,000km as realistic average for transcontinental flights
    return 8000;
  }

  /**
   * Get continent for a country code
   *
   * Maps ISO 2-letter country codes to continents for distance estimation.
   * This is used to differentiate between regional and intercontinental travel.
   *
   * @param countryCode - ISO 2-letter country code
   * @returns Continent name
   * @private
   */
  private getContinent(countryCode: string): string {
    const continentMap: Record<string, string> = {
      // North America
      US: 'north_america',
      CA: 'north_america',
      MX: 'north_america',
      // Europe
      GB: 'europe',
      FR: 'europe',
      DE: 'europe',
      IT: 'europe',
      ES: 'europe',
      NL: 'europe',
      BE: 'europe',
      CH: 'europe',
      AT: 'europe',
      PT: 'europe',
      SE: 'europe',
      NO: 'europe',
      DK: 'europe',
      FI: 'europe',
      PL: 'europe',
      CZ: 'europe',
      GR: 'europe',
      IE: 'europe',
      RO: 'europe',
      HU: 'europe',
      BG: 'europe',
      SK: 'europe',
      HR: 'europe',
      SI: 'europe',
      LT: 'europe',
      LV: 'europe',
      EE: 'europe',
      // Asia
      CN: 'asia',
      JP: 'asia',
      IN: 'asia',
      KR: 'asia',
      TH: 'asia',
      VN: 'asia',
      PH: 'asia',
      MY: 'asia',
      SG: 'asia',
      ID: 'asia',
      PK: 'asia',
      BD: 'asia',
      TR: 'asia',
      SA: 'asia',
      AE: 'asia',
      IL: 'asia',
      HK: 'asia',
      TW: 'asia',
      // Oceania
      AU: 'oceania',
      NZ: 'oceania',
      // South America
      BR: 'south_america',
      AR: 'south_america',
      CL: 'south_america',
      CO: 'south_america',
      PE: 'south_america',
      VE: 'south_america',
      // Africa
      ZA: 'africa',
      EG: 'africa',
      NG: 'africa',
      KE: 'africa',
      MA: 'africa',
      ET: 'africa',
    };

    return continentMap[countryCode.toUpperCase()] || 'unknown';
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
