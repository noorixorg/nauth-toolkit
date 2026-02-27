import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@nauth-toolkit/client-angular/standalone';
import { ButtonModule } from 'primeng/button';
import { SplitButtonModule } from 'primeng/splitbutton';
import { CardModule } from 'primeng/card';
import { MenuItem, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProfileComponent } from './profile/profile.component';
import { AuditComponent } from './audit/audit.component';
import { MfaComponent } from './mfa/mfa.component';
import { AdminComponent } from './admin/admin.component';

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
    AdminComponent,
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
   * Last OAuth state (temporary for testing)
   */
  lastOauthState = signal<string | null>(null);

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
  async onLogout(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } catch (_err: unknown) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sign Out',
        detail: 'Signed out locally. Session may have already expired.',
      });
      await this.router.navigate(['/login']);
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  /**
   * Handle logout with forget device
   *
   * Logs out and removes device trust token.
   */
  async onLogoutForgetDevice(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    try {
      await this.auth.logout(true);
      await this.router.navigate(['/login']);
    } catch (_err: unknown) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sign Out',
        detail: 'Signed out locally. Device trust may not have been revoked.',
      });
      await this.router.navigate(['/login']);
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  /**
   * Handle global logout
   *
   * Revokes all sessions for the user.
   */
  async onLogoutAll(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    try {
      await this.auth.logoutAll();
      await this.router.navigate(['/login']);
    } catch (_err: unknown) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Global Sign Out',
        detail: 'Signed out locally. Some sessions may not have been revoked.',
      });
      await this.router.navigate(['/login']);
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  /**
   * Get last OAuth state (temporary for testing).
   *
   * Retrieves and displays the appState from the most recent social login redirect.
   */
  async showLastOauthState(): Promise<void> {
    try {
      const state = await this.auth.getLastOauthState();
      this.lastOauthState.set(state);

      if (state) {
        this.messageService.add({
          severity: 'info',
          summary: 'Last OAuth State',
          detail: `appState: ${state}`,
          life: 5000,
        });
      } else {
        this.messageService.add({
          severity: 'info',
          summary: 'Last OAuth State',
          detail: 'No OAuth state found (null)',
          life: 3000,
        });
      }
    } catch (err: unknown) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err instanceof Error ? err.message : 'Failed to get OAuth state',
      });
    }
  }
}
