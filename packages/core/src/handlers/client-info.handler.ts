/**
 * Client Info Handler
 *
 * Extracts client information (IP, user agent, device info) from NAuthRequest
 * and stores in AsyncLocalStorage context.
 *
 * **Platform-Agnostic:**
 * This handler operates purely on NAuthRequest interface.
 * Context initialization is handled by the adapter, not this handler.
 */

import { ContextStorage, ClientInfoService, IClientInfo, NAuthLogger, getDeviceTokenCookieName } from '../index';
import { GeoLocationService } from '../internal';
import { NAuthRequest, NAuthResponse } from '../platform/interfaces';

/**
 * ClientInfoHandler
 *
 * First handler in the chain. Extracts client information and stores it
 * in the context for downstream handlers and services.
 */
export class ClientInfoHandler {
  constructor(
    private clientInfoService: ClientInfoService,
    private geoLocationService?: GeoLocationService,
    private logger?: NAuthLogger,
  ) {}

  /**
   * Handle request - extract and store client info
   *
   * Context initialization is handled by the adapter.
   * This handler assumes context is already available.
   */
  public async handle(req: NAuthRequest, res: NAuthResponse, next: () => Promise<void> | void): Promise<void> {
    try {
      await this.extractAndStore(req, res);
    } catch (error) {
      this.logger?.error?.('Error extracting client info:', error);
    }

    await next();
  }

  /**
   * Extract client information and store in context
   */
  private async extractAndStore(req: NAuthRequest, res: NAuthResponse): Promise<void> {
    // Extract user agent
    const userAgent = req.getHeader('user-agent') || 'unknown';

    // Parse user agent for device/browser info
    const parsedUA = this.clientInfoService.parseUserAgent(userAgent);

    // Extract device token from cookie or header
    // Use default cookie name (nauth_device_token) if config not available
    const deviceTokenCookieName = getDeviceTokenCookieName();
    const deviceToken = req.cookies[deviceTokenCookieName] || req.getHeader('x-device-token');

    // Build client info object
    const clientInfo: IClientInfo = {
      ipAddress: req.ip,
      userAgent,
      deviceToken,
      deviceName: (req.body.deviceName as string) || parsedUA.deviceName || undefined,
      deviceType: ((req.body.deviceType as string) || parsedUA.deviceType || undefined) as IClientInfo['deviceType'],
      platform: parsedUA.platform || undefined,
      browser: parsedUA.browser || undefined,
      sessionId: undefined, // Set later by AuthHandler
      userId: undefined, // Set later by AuthHandler
      ipCountry: undefined,
      ipCity: undefined,
      ipLatitude: undefined,
      ipLongitude: undefined,
    };

    // Populate geolocation if service available
    if (this.geoLocationService && clientInfo.ipAddress && clientInfo.ipAddress !== '0.0.0.0') {
      try {
        const geo = await this.geoLocationService.getIpGeolocation(clientInfo.ipAddress);
        clientInfo.ipCountry = geo.country;
        clientInfo.ipCity = geo.city;
        clientInfo.ipLatitude = geo.latitude;
        clientInfo.ipLongitude = geo.longitude;
      } catch (error) {
        // Log error instead of silently failing
        this.logger?.error?.(
          `Geolocation lookup failed for IP ${clientInfo.ipAddress}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }

    // Store in context
    ContextStorage.set('CLIENT_INFO', clientInfo);
    ContextStorage.set('HTTP_RESPONSE', res.raw);

    // Also attach to request attributes for handler access
    req.attributes.clientInfo = clientInfo;
  }
}
