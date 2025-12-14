import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client/angular';
import { MFAMethod } from '@nauth-toolkit/client';
import { ChallengeOrchestratorService } from '../services/challenge-orchestrator.service';

/**
 * Challenge Route Guard
 *
 * Prevents component flash by determining correct route before component loads.
 * Handles MFA routing decisions (passkey vs OTP vs selector).
 *
 * Used on MFA routes to ensure users land on the correct component based on:
 * - Backend's preferred MFA method
 * - User's method selection (from query params)
 * - Available methods
 *
 * @example
 * ```typescript
 * // app.routes.ts
 * {
 *   path: 'auth/challenge/mfa-required',
 *   canActivate: [challengeRouteGuard],
 *   loadComponent: () => import('./challenge/otp-verify.component'),
 * }
 * ```
 */
export const challengeRouteGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const orchestrator = inject(ChallengeOrchestratorService);

  // Get current challenge
  const challenge = auth.getCurrentChallenge();
  if (!challenge?.challengeName) {
    // No challenge - redirect to login
    return router.createUrlTree(['/login']);
  }

  // Check if user manually selected a method (from query params)
  const selectedMethod = route.queryParams['method'] as MFAMethod | undefined;

  // Get current path (from route segments)
  const currentPath = `/${route.url.map((segment) => segment.path).join('/')}`;

  // Check if current route is correct for the challenge
  if (orchestrator.isCorrectRouteForChallenge(currentPath, selectedMethod)) {
    // Correct route - allow component to load
    return true;
  }

  // Wrong route - redirect to correct one
  const correctRoute = orchestrator.getChallengeRoute(selectedMethod);
  if (!correctRoute) {
    return router.createUrlTree(['/login']);
  }

  // Create UrlTree with query params if method is selected
  const urlTree = router.createUrlTree([correctRoute]);
  if (selectedMethod) {
    urlTree.queryParams = { method: selectedMethod };
  }

  return urlTree;
};
