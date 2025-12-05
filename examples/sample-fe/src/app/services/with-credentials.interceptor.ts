import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PlatformService } from './platform.service';

/**
 * Ensures cookies are sent automatically with HTTP requests on web.
 * On Capacitor native, we keep default behavior (no withCredentials).
 */
export const withCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const platformService = inject(PlatformService);
  if (platformService.isWebPlatform()) {
    req = req.clone({ withCredentials: true });
  }
  return next(req);
};
