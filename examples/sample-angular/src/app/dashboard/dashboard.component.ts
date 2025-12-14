import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@nauth-toolkit/client/angular';
import { ButtonModule } from 'primeng/button';
import { SplitButtonModule } from 'primeng/splitbutton';
import { CardModule } from 'primeng/card';
import { MenuItem, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProfileComponent } from './profile/profile.component';
import { AuditComponent } from './audit/audit.component';
import { MfaComponent } from './mfa/mfa.component';

/**
 * Dashboard component
 *
 * Protected component that displays user management interface with three sections:
 * - Profile: User information with in-place editing
 * - MFA: Multi-factor authentication device management (coming soon)
 * - Audit Trail: Authentication and security event history (coming soon)
 *
 * Requires authentication via authGuard.
 *
 * @example
 * ```typescript
 * // Route configuration
 * {
 *   path: 'dashboard',
 *   component: DashboardComponent,
 *   canActivate: [authGuard],
 * }
 * ```
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    SplitButtonModule,
    CardModule,
    ToastModule,
    ProfileComponent,
    AuditComponent,
    MfaComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  /**
   * Auth service for logout
   */
  private readonly auth = inject(AuthService);

  /**
   * Router for navigation
   */
  private readonly router = inject(Router);

  /**
   * Message service for toast notifications
   */
  private readonly messageService = inject(MessageService);

  /**
   * Loading state for logout operations
   */
  isLoggingOut = signal<boolean>(false);

  /**
   * Logout menu items for split button
   * Using computed signal to ensure reactivity
   */
  logoutMenuItems = computed<MenuItem[]>(() => {
    const disabled = this.isLoggingOut();
    return [
      {
        label: 'Sign Out & Forget Device',
        icon: 'pi pi-ban',
        disabled,
        command: () => {
          this.onLogoutForgetDevice();
        },
      },
      {
        label: 'Global Sign Out',
        icon: 'pi pi-power-off',
        disabled,
        command: () => {
          this.onLogoutAll();
        },
      },
    ];
  });

  /**
   * Handle normal logout
   *
   * Logs out the user and navigates to login page.
   */
  onLogout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (_err: unknown) => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sign Out',
          detail: 'Signed out locally. Session may have already expired.',
        });
        this.router.navigate(['/login']);
      },
      complete: () => {
        this.isLoggingOut.set(false);
      },
    });
  }

  /**
   * Handle logout with forget device
   *
   * Logs out and removes device trust token.
   */
  onLogoutForgetDevice(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.auth.logout(true).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (_err: unknown) => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sign Out',
          detail: 'Signed out locally. Device trust may not have been revoked.',
        });
        this.router.navigate(['/login']);
      },
      complete: () => {
        this.isLoggingOut.set(false);
      },
    });
  }

  /**
   * Handle global logout
   *
   * Revokes all sessions for the user.
   */
  onLogoutAll(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.auth.logoutAll().subscribe({
      next: (_result) => {
        this.router.navigate(['/login']);
      },
      error: (_err: unknown) => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Global Sign Out',
          detail: 'Signed out locally. Some sessions may not have been revoked.',
        });
        this.router.navigate(['/login']);
      },
      complete: () => {
        this.isLoggingOut.set(false);
      },
    });
  }
}
