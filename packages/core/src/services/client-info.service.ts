import { ClientInfo } from '../interfaces/client-info.interface';
import { ContextStorage } from '../utils/context-storage';
import {
  GetClientInfoResponseDTO,
  GetIpAddressResponseDTO,
  GetUserAgentResponseDTO,
  GetDeviceTokenResponseDTO,
  GetSessionIdResponseDTO,
} from '../dto';

/**
 * Client Info Service
 *
 * Provides transparent access to client information (IP address, user agent, device info)
 * from the current request context using async local storage.
 *
 * This service eliminates the need to pass IP addresses and user agents as parameters
 * to authentication methods. The library handles this automatically, just like AWS Cognito.
 *
 * **Key Features:**
 * - Transparent access to client metadata
 * - No parameters needed in service methods
 * - Works across async boundaries
 * - Type-safe with TypeScript
 * - Thread-safe with async local storage
 * - Platform-agnostic (no framework dependencies)
 *
 * **Usage:**
 * ```typescript
 * export class AuthService {
 *   constructor(private clientInfoService: ClientInfoService) {}
 *
 *   async login(dto: LoginDTO) {
 *     // Get client info from context (no parameters needed!)
 *     const clientInfo = this.clientInfoService.get();
 *
 *     // Use it
 *     logger.debug('IP Address:', clientInfo.ipAddress);
 *     logger.debug('User Agent:', clientInfo.userAgent);
 *   }
 * }
 * ```
 *
 * **Note:**
 * This service must be called within the context of an HTTP request.
 * If called outside a request context (e.g., cron jobs, CLI), it will
 * return a default ClientInfo object with 'unknown' values.
 */
export class ClientInfoService {
  constructor() {
    // No dependencies - uses static ContextStorage
  }

  /**
   * Get client information from the current request context
   *
   * This method retrieves client metadata that was automatically extracted
   * by ClientInfoInterceptor and stored in async local storage.
   *
   * @returns Response DTO with client information
   *
   * @example
   * ```typescript
   * const result = this.clientInfoService.get();
   * logger.debug('IP Address:', result.ipAddress);  // 192.168.1.100
   * logger.debug('User Agent:', result.userAgent);  // Mozilla/5.0 ...
   * ```
   *
   * @example
   * ```typescript
   * // If called outside request context (e.g., cron job)
   * const result = this.clientInfoService.get();
   * logger.debug('IP Address:', result.ipAddress);  // 'unknown'
   * ```
   */
  get(): GetClientInfoResponseDTO {
    const clientInfo = ContextStorage.get<ClientInfo>('CLIENT_INFO');

    // If no client info in context (e.g., cron job, CLI), return default
    if (!clientInfo) {
      return {
        ipAddress: 'unknown',
        userAgent: 'unknown',
      } as GetClientInfoResponseDTO;
    }

    return clientInfo as GetClientInfoResponseDTO;
  }

  /**
   * Get IP address from the current request context
   *
   * Convenience method to get just the IP address without the full ClientInfo object.
   *
   * @returns Response DTO with IP address
   *
   * @example
   * ```typescript
   * const result = this.clientInfoService.getIpAddress();
   * logger.debug('IP Address:', result.ipAddress);  // 192.168.1.100
   * ```
   */
  getIpAddress(): GetIpAddressResponseDTO {
    return {
      ipAddress: this.get().ipAddress,
    };
  }

  /**
   * Get user agent from the current request context
   *
   * Convenience method to get just the user agent without the full ClientInfo object.
   *
   * @returns Response DTO with user agent
   *
   * @example
   * ```typescript
   * const result = this.clientInfoService.getUserAgent();
   * logger.debug('User Agent:', result.userAgent);  // Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
   * ```
   */
  getUserAgent(): GetUserAgentResponseDTO {
    return {
      userAgent: this.get().userAgent,
    };
  }

  /**
   * Get device token from the current request context
   *
   * Convenience method to get just the device token (for trusted device feature).
   *
   * @returns Response DTO with device token
   *
   * @example
   * ```typescript
   * const result = this.clientInfoService.getDeviceToken();
   * if (result.deviceToken) {
   *   logger.debug('Device token:', result.deviceToken);
   * }
   * ```
   */
  getDeviceToken(): GetDeviceTokenResponseDTO {
    return {
      deviceToken: this.get().deviceToken,
    };
  }

  /**
   * Get session ID from the current request context
   *
   * Convenience method to get just the session ID (extracted from JWT token after authentication).
   *
   * @returns Response DTO with session ID
   *
   * @example
   * ```typescript
   * const result = this.clientInfoService.getSessionId();
   * if (result.sessionId) {
   *   logger.debug('Session ID:', result.sessionId);
   * }
   * ```
   */
  getSessionId(): GetSessionIdResponseDTO {
    return {
      sessionId: this.get().sessionId,
    };
  }

  /**
   * Get response object from the current request context
   *
   * Returns the HTTP response object that was stored by the framework interceptor.
   * Used internally by services to perform response operations like clearing cookies.
   *
   * @returns Response object with cookie manipulation methods, or null if not available
   * @internal - Used by core services, not by application code
   *
   * @example
   * ```typescript
   * const response = this.clientInfoService.getResponse();
   * if (response?.clearCookie) {
   *   response.clearCookie('my_cookie');
   * }
   * ```
   */
  getResponse(): { clearCookie?: (name: string, options?: unknown) => void } | null {
    return ContextStorage.get<{ clearCookie?: (name: string, options?: unknown) => void }>('HTTP_RESPONSE') || null;
  }

  /**
   * Parse user-agent string to extract browser, platform, and device information
   *
   * This method is used internally by interceptors to populate ClientInfo.
   * Services should use ClientInfoService.get() to access parsed information.
   *
   * @param userAgent - User-agent string from HTTP request
   * @returns Parsed user-agent information
   * @internal - Used by interceptors, not by application code
   */
  parseUserAgent(userAgent?: string | null): {
    browser: string | null;
    platform: string | null;
    deviceType: 'desktop' | 'mobile' | 'tablet' | null;
    deviceName: string | null;
  } {
    if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
      return {
        browser: null,
        platform: null,
        deviceType: null,
        deviceName: null,
      };
    }

    const ua = userAgent.toLowerCase();

    // ============================================================================
    // Detect Device Type
    // ============================================================================
    let deviceType: 'desktop' | 'mobile' | 'tablet' | null = null;

    // Mobile devices
    if (/mobile|android|iphone|ipod|blackberry|opera|mini|windows\s+phone|palm|iemobile/i.test(ua)) {
      // Tablets
      if (/tablet|ipad|playbook|silk|kindle/i.test(ua)) {
        deviceType = 'tablet';
      } else {
        deviceType = 'mobile';
      }
    } else {
      deviceType = 'desktop';
    }

    // ============================================================================
    // Detect Platform/OS
    // ============================================================================
    let platform: string | null = null;

    if (/windows/i.test(ua)) {
      if (/windows nt 10/i.test(ua)) {
        platform = 'Windows 10';
      } else if (/windows nt 11/i.test(ua)) {
        platform = 'Windows 11';
      } else if (/windows nt 6.3/i.test(ua)) {
        platform = 'Windows 8.1';
      } else if (/windows nt 6.2/i.test(ua)) {
        platform = 'Windows 8';
      } else if (/windows nt 6.1/i.test(ua)) {
        platform = 'Windows 7';
      } else {
        platform = 'Windows';
      }
    } else if (/macintosh|mac os x/i.test(ua)) {
      const match = ua.match(/mac os x (\d+)[._](\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        // Convert to macOS version names (approximate)
        if (major >= 13) {
          platform = 'macOS Ventura+';
        } else if (major >= 12) {
          platform = 'macOS Monterey';
        } else if (major >= 11) {
          platform = 'macOS Big Sur';
        } else {
          platform = 'macOS';
        }
      } else {
        platform = 'macOS';
      }
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      const match = ua.match(/os (\d+)[._](\d+)/);
      if (match) {
        platform = `iOS ${match[1]}.${match[2]}`;
      } else {
        platform = 'iOS';
      }
    } else if (/android/i.test(ua)) {
      const match = ua.match(/android (\d+)[._](\d+)/);
      if (match) {
        platform = `Android ${match[1]}.${match[2]}`;
      } else {
        platform = 'Android';
      }
    } else if (/linux/i.test(ua)) {
      platform = 'Linux';
    } else if (/ubuntu/i.test(ua)) {
      platform = 'Ubuntu';
    } else if (/fedora/i.test(ua)) {
      platform = 'Fedora';
    } else {
      platform = null;
    }

    // ============================================================================
    // Detect Browser
    // ============================================================================
    let browser: string | null = null;

    if (/edg/i.test(ua)) {
      browser = 'Edge';
    } else if (/chrome/i.test(ua) && !/edg/i.test(ua)) {
      const match = ua.match(/chrome\/(\d+)/);
      browser = match ? `Chrome ${match[1]}` : 'Chrome';
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      const match = ua.match(/version\/(\d+)/);
      browser = match ? `Safari ${match[1]}` : 'Safari';
    } else if (/firefox/i.test(ua)) {
      const match = ua.match(/firefox\/(\d+)/);
      browser = match ? `Firefox ${match[1]}` : 'Firefox';
    } else if (/opera|opr/i.test(ua)) {
      browser = 'Opera';
    } else if (/msie|trident/i.test(ua)) {
      browser = 'Internet Explorer';
    } else if (/brave/i.test(ua)) {
      browser = 'Brave';
    } else {
      browser = null;
    }

    // ============================================================================
    // Generate Device Name
    // ============================================================================
    let deviceName: string | null = null;

    if (browser && platform) {
      deviceName = `${browser} on ${platform}`;
    } else if (browser) {
      deviceName = browser;
    } else if (platform) {
      deviceName = platform;
    }

    // Special cases for mobile devices
    if (deviceType === 'mobile' || deviceType === 'tablet') {
      if (/iphone/i.test(ua)) {
        const modelMatch = ua.match(/iphone(\d+),?(\d+)?/);
        if (modelMatch) {
          deviceName = `iPhone ${modelMatch[1]}${modelMatch[2] ? ` ${modelMatch[2]}` : ''} on ${platform || 'iOS'}`;
        } else {
          deviceName = `iPhone on ${platform || 'iOS'}`;
        }
      } else if (/ipad/i.test(ua)) {
        deviceName = `iPad on ${platform || 'iOS'}`;
      } else if (/android/i.test(ua)) {
        deviceName = `${browser || 'Android'} on ${platform || 'Android'}`;
      }
    }

    return {
      browser,
      platform,
      deviceType,
      deviceName,
    };
  }
}
