import { Routes } from '@angular/router';
import { authGuard, socialRedirectCallbackGuard } from '@nauth-toolkit/client-angular/standalone';
import { challengeRouteGuard } from './guards/challenge-route.guard';

/**
 * Application routes
 *
 * Defines all routes including protected dashboard route.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'forgot-password/confirm',
    loadComponent: () =>
      import('./forgot-password/confirm-forgot-password.component').then(
        (m) => m.ConfirmForgotPasswordComponent,
      ),
  },
  {
    path: 'admin-reset-password',
    loadComponent: () =>
      import('./admin-reset-password/admin-reset-password.component').then(
        (m) => m.AdminResetPasswordComponent,
      ),
  },
  {
    path: 'auth/callback',
    canActivate: [socialRedirectCallbackGuard],
    // Guard-only callback route. The guard handles exchanging `exchangeToken` (json/hybrid)
    // and then redirects to `redirects.loginSuccess` (dashboard).
    children: [],
  },
  {
    path: 'auth/challenge/force-change-password',
    loadComponent: () =>
      import('./challenge/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'auth/challenge/mfa-setup-required',
    loadComponent: () => import('./challenge/mfa-setup.component').then((m) => m.MfaSetupComponent),
  },
  // MFA setup OTP verification route (for SMS/Email setup during signup)
  {
    path: 'auth/challenge/mfa-setup-required/verify',
    loadComponent: () =>
      import('./challenge/otp-verify.component').then((m) => m.OtpVerifyComponent),
  },
  // MFA method selector route (for choosing from existing methods during login)
  {
    path: 'auth/challenge/mfa-selector',
    loadComponent: () =>
      import('./challenge/mfa-selector.component').then((m) => m.MfaSelectorComponent),
  },
  // Passkey verification route (MFA_REQUIRED with passkey method)
  // Passkey component handles both setup and verification
  {
    path: 'auth/challenge/mfa-required/passkey',
    loadComponent: () =>
      import('./challenge/passkey-setup.component').then((m) => m.PasskeySetupComponent),
  },
  // MFA verification route with guard to prevent component flash
  {
    path: 'auth/challenge/mfa-required',
    canActivate: [challengeRouteGuard],
    loadComponent: () =>
      import('./challenge/otp-verify.component').then((m) => m.OtpVerifyComponent),
  },
  // Generic OTP verification route for all other OTP-based challenges
  {
    path: 'auth/challenge/:challengeType',
    loadComponent: () =>
      import('./challenge/otp-verify.component').then((m) => m.OtpVerifyComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard()],
  },
  {
    path: 'dashboard/mfa/enroll',
    loadComponent: () => import('./challenge/mfa-setup.component').then((m) => m.MfaSetupComponent),
    canActivate: [authGuard()],
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
