import { InjectionToken } from '@angular/core';
import { NAuthClientConfig } from '@nauth-toolkit/client';

/**
 * Injection token for providing NAuthClientConfig in Angular apps.
 */
export const NAUTH_CLIENT_CONFIG = new InjectionToken<NAuthClientConfig>('NAUTH_CLIENT_CONFIG');
