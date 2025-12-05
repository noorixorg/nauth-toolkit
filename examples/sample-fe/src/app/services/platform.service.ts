import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Platform Detection Service
 *
 * Determines if the app is running in a web browser (cookies) or in a
 * Capacitor native environment (Bearer tokens).
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly native: boolean;

  constructor() {
    this.native = Capacitor.isNativePlatform();
  }

  /**
   * Returns true when running as a native Capacitor app (iOS/Android)
   */
  isNativePlatform(): boolean {
    return this.native;
  }

  /**
   * Returns true when running in a web browser
   */
  isWebPlatform(): boolean {
    return !this.native;
  }

  /**
   * Returns the platform identifier ('web' | 'ios' | 'android')
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }
}


