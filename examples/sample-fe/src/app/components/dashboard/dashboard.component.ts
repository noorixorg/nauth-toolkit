import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/auth.models';
import { MFASetupContentComponent } from '../shared/mfa-setup-content/mfa-setup-content.component';
import { AuditEventsComponent } from '../shared/audit-events/audit-events.component';
import { environment } from '../../../environments/environment';
import { MFADeviceMethod, MFAVerificationMethod } from '../../types/mfa.types';

/**
 * Dashboard Component
 *
 * Main dashboard showing user profile and account management
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [CommonModule, RouterModule, DatePipe, MFASetupContentComponent, AuditEventsComponent],
  standalone: true,
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('logoutDropdown', { static: false }) logoutDropdown?: ElementRef;

  user: User | null = null;
  socialAccounts: string[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  currentTokens: any = null;
  mfaStatus: {
    enabled: boolean;
    required: boolean;
    configuredMethods: Array<MFADeviceMethod>;
    availableMethods: Array<MFAVerificationMethod>;
    hasBackupCodes: boolean;
    preferredMethod?: MFADeviceMethod;
    mfaExempt: boolean;
    mfaExemptReason: string | null;
    mfaExemptGrantedAt: Date | null;
    mfaExemptGrantedBy: string | null;
  } | null = null;
  isLoadingMFA = false;
  // MFA Devices
  mfaDevices: Array<{
    id: number;
    type: string;
    name: string;
    isPrimary: boolean;
    isActive: boolean;
    createdAt: Date;
  }> = [];
  isLoadingDevices = false;
  // MFA Setup Dialog
  showMFASetupDialog = false;
  preselectedMFAMethod: MFADeviceMethod | undefined;
  // Backup Codes (for generating from dashboard)
  backupCodes: string[] = [];
  showBackupCodes = false;
  private updateTimer: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadMFAStatus();
    this.loadMFADevices();
    this.subscribeToTokens();
    this.startTokenUpdateTimer();
  }

  ngOnDestroy(): void {
    this.stopTokenUpdateTimer();
  }

  /**
   * Load user data and social accounts
   */
  loadUserData(): void {
    this.user = this.authService.getCurrentUser();
    this.currentTokens = this.authService.getTokens();

    if (this.user) {
      // Reload fresh user profile from backend to get hasPasswordHash field
      this.authService.loadUserProfile().subscribe({
        next: (user) => {
          this.user = user;
          this.loadSocialAccounts();
        },
        error: () => {
          // If profile load fails, just use cached user
          this.loadSocialAccounts();
        },
      });
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Subscribe to tokens observable for real-time updates
   */
  private subscribeToTokens(): void {
    this.authService.tokens$.subscribe((tokens) => {
      this.currentTokens = tokens;
    });
  }

  /**
   * Load linked social accounts
   */
  loadSocialAccounts(): void {
    // Add a small delay to ensure tokens are properly updated
    setTimeout(() => {
      this.authService.getLinkedAccounts().subscribe({
        next: (response) => {
          this.socialAccounts = response.providers;
        },
        error: () => {
          // Don't show error to user, just fail silently
        },
      });
    }, 100);
  }

  /**
   * Load MFA status from backend
   */
  loadMFAStatus(): void {
    this.isLoadingMFA = true;
    this.authService.getMFAStatus().subscribe({
      next: (status) => {
        // Map backend response to full MFA status
        this.mfaStatus = {
          enabled: status.enabled,
          required: status.required,
          configuredMethods: status.methods as any,
          availableMethods: status.availableMethods as any,
          hasBackupCodes: status.hasBackupCodes,
          preferredMethod: status.preferredMethod as MFADeviceMethod | undefined,
          mfaExempt: status.mfaExempt,
          mfaExemptReason: status.mfaExemptReason,
          mfaExemptGrantedAt: status.mfaExemptGrantedAt,
          mfaExemptGrantedBy: null, // Not returned by backend for security
        };
        this.isLoadingMFA = false;
      },
      error: () => {
        // MFA might not be enabled or user might not have access
        this.mfaStatus = null;
        this.isLoadingMFA = false;
      },
    });
  }

  /**
   * Load MFA devices from backend
   */
  loadMFADevices(): void {
    this.isLoadingDevices = true;
    this.authService.getMFADevices().subscribe({
      next: (devices) => {
        this.mfaDevices = devices;
        this.isLoadingDevices = false;
      },
      error: () => {
        this.mfaDevices = [];
        this.isLoadingDevices = false;
      },
    });
  }

  /**
   * Get passkey devices
   */
  getPasskeyDevices(): Array<{
    id: number;
    type: string;
    name: string;
    isPrimary: boolean;
    isActive: boolean;
    createdAt: Date;
  }> {
    return this.mfaDevices.filter((d) => d.type === 'passkey' && d.isActive);
  }

  /**
   * Get TOTP devices
   */
  getTOTPDevices(): Array<{
    id: number;
    type: string;
    name: string;
    isPrimary: boolean;
    isActive: boolean;
    createdAt: Date;
  }> {
    return this.mfaDevices.filter((d) => d.type === 'totp' && d.isActive);
  }

  /**
   * Get SMS devices
   */
  getSMSDevices(): Array<{
    id: number;
    type: string;
    name: string;
    isPrimary: boolean;
    isActive: boolean;
    createdAt: Date;
  }> {
    return this.mfaDevices.filter((d) => d.type === 'sms' && d.isActive);
  }

  /**
   * Get MFA method display name
   */
  getMFAMethodDisplayName(method: MFAVerificationMethod): string {
    switch (method) {
      case 'totp':
        return 'Authenticator App (TOTP)';
      case 'sms':
        return 'SMS';
      case 'email':
        return 'Email';
      case 'passkey':
        return 'Passkey';
      case 'backup':
        return 'Backup Codes';
      default:
        return method;
    }
  }

  /**
   * Get MFA method icon
   */
  getMFAMethodIcon(method: MFAVerificationMethod): string {
    switch (method) {
      case 'totp':
        return '🔐';
      case 'sms':
        return '📱';
      case 'email':
        return '📧';
      case 'passkey':
        return '🔑';
      case 'backup':
        return '📝';
      default:
        return '⚙️';
    }
  }

  /**
   * Check if MFA is required but not configured
   */
  isMFARequiredButNotConfigured(): boolean {
    return (
      this.mfaStatus?.required === true &&
      (!this.mfaStatus?.enabled || this.mfaStatus?.configuredMethods.length === 0)
    );
  }

  /**
   * Check if a method is configured (for type-safe checking)
   */
  isMethodConfigured(method: MFAVerificationMethod): boolean {
    if (!this.mfaStatus || method === 'backup') {
      return false;
    }
    return this.mfaStatus.configuredMethods.includes(method as MFADeviceMethod);
  }

  /**
   * Get user's preferred MFA method
   */
  getPreferredMFAMethod(): MFADeviceMethod | null {
    if (!this.mfaStatus?.preferredMethod) {
      return null;
    }
    return this.mfaStatus.preferredMethod;
  }

  /**
   * Get available methods that are not backup codes (for display)
   * Shows ALL methods - both configured and unconfigured
   */
  getAvailableMethodsForDisplay(): Array<MFADeviceMethod> {
    if (!this.mfaStatus) {
      return [];
    }
    // Filter out backup codes only - show all methods
    return this.mfaStatus.availableMethods.filter((m): m is MFADeviceMethod => m !== 'backup');
  }

  /**
   * Get unconfigured methods only (for dialog)
   * Note: Passkey can always be added (multiple devices supported)
   */
  getUnconfiguredMethods(): Array<MFADeviceMethod> {
    if (!this.mfaStatus) {
      return [];
    }
    // Filter out backup codes and already configured methods
    // Exception: passkey is always available for adding more devices
    const unconfigured = this.mfaStatus.availableMethods.filter(
      (m): m is MFADeviceMethod =>
        m !== 'backup' && !this.mfaStatus!.configuredMethods.includes(m as MFADeviceMethod),
    );

    // Always include passkey if it's an available method (can have multiple devices)
    if (this.mfaStatus.availableMethods.includes('passkey') && !unconfigured.includes('passkey')) {
      unconfigured.push('passkey');
    }

    return unconfigured;
  }

  /**
   * Check if there are unconfigured MFA methods available
   */
  hasUnconfiguredMethods(): boolean {
    if (!this.mfaStatus) {
      return false;
    }
    const available = this.getAvailableMethodsForDisplay();
    return available.length > 0;
  }

  /**
   * Refresh tokens manually
   * Prevents concurrent refresh requests by checking isLoading state
   *
   * In cookie mode, refresh token is sent automatically via HTTP-only cookie.
   * In JWT mode, refresh token must be provided from localStorage.
   */
  refreshTokens(): void {
    // Prevent concurrent refresh requests
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // In cookie mode, refresh token is in HTTP-only cookie, not accessible via JavaScript
    // Backend will extract it from cookie automatically
    if (environment.useCookies) {
      // Cookie mode: pass empty string, backend gets token from cookie
      this.authService.refreshToken('').subscribe({
        next: () => {
          this.successMessage = 'Tokens refreshed successfully!';
          this.isLoading = false;
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Token refresh failed';
          this.isLoading = false;
        },
      });
      return;
    }

    // JWT mode: check for refresh token in localStorage
    const tokens = this.authService.getTokens();
    if (!tokens?.refreshToken) {
      this.errorMessage = 'No refresh token available';
      this.isLoading = false;
      return;
    }

    this.authService.refreshToken(tokens.refreshToken).subscribe({
      next: () => {
        this.successMessage = 'Tokens refreshed successfully!';
        this.isLoading = false;
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Token refresh failed';
        this.isLoading = false;
      },
    });
  }

  showLogoutMenu = false;

  /**
   * Toggle logout dropdown menu
   */
  toggleLogoutMenu(): void {
    this.showLogoutMenu = !this.showLogoutMenu;
  }

  /**
   * Close logout menu when clicking outside
   */
  @HostListener('document:click', ['$event'])
  closeLogoutMenu(event: MouseEvent): void {
    if (this.logoutDropdown && !this.logoutDropdown.nativeElement.contains(event.target)) {
      this.showLogoutMenu = false;
    }
  }

  /**
   * Logout (single session)
   */
  logout(): void {
    this.isLoading = true;
    this.showLogoutMenu = false;

    this.authService.logout(false).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even if logout fails, redirect to login
        this.router.navigate(['/login']);
      },
    });
  }

  /**
   * Logout and forget device (revoke trusted device token)
   */
  logoutForgetMe(): void {
    if (confirm('This will log you out and remove this device from trusted devices. Continue?')) {
      this.isLoading = true;
      this.showLogoutMenu = false;

      this.authService.logout(true).subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: () => {
          // Even if logout fails, redirect to login
          this.router.navigate(['/login']);
        },
      });
    } else {
      this.showLogoutMenu = false;
    }
  }

  /**
   * Global logout (all sessions)
   */
  globalLogout(): void {
    if (confirm('This will log you out of all devices. Are you sure?')) {
      this.isLoading = true;
      this.showLogoutMenu = false;

      this.authService.globalLogout().subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: () => {
          // Even if logout fails, redirect to login
          this.router.navigate(['/login']);
        },
      });
    } else {
      this.showLogoutMenu = false;
    }
  }

  /**
   * Navigate to email verification
   */
  verifyEmail(): void {
    this.router.navigate(['/verify-email']);
  }

  /**
   * Navigate to profile settings
   */
  editProfile(): void {
    this.router.navigate(['/profile']);
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider: string): string {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  /**
   * Get provider icon
   */
  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'google':
        return '🔍';
      case 'apple':
        return '🍎';
      case 'facebook':
        return '📘';
      default:
        return '🔗';
    }
  }

  /**
   * Check if user has password authentication
   */
  hasPasswordAuth(): boolean {
    return this.user?.hasPasswordHash === true;
  }

  /**
   * Request password change on next login
   */
  requestPasswordChange(): void {
    if (confirm('This will force you to change your password on next login. Continue?')) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      this.authService.requestPasswordChange().subscribe({
        next: (response) => {
          this.successMessage = response.message;
          this.isLoading = false;
          setTimeout(() => (this.successMessage = ''), 5000);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to request password change';
          this.isLoading = false;
        },
      });
    }
  }

  /**
   * Get authentication methods summary
   */
  getAuthMethodsSummary(): string {
    const methods = [];

    if (this.hasPasswordAuth()) {
      methods.push('Password');
    }

    if (this.socialAccounts.length > 0) {
      methods.push(...this.socialAccounts.map((provider) => this.getProviderDisplayName(provider)));
    }

    return methods.join(', ');
  }

  /**
   * Get user display name
   */
  getUserDisplayName(): string {
    if (this.user?.firstName && this.user?.lastName) {
      return `${this.user.firstName} ${this.user.lastName}`;
    }
    return 'User';
  }

  /**
   * Get current authentication tokens
   */
  getTokens() {
    return this.authService.getTokens();
  }

  /**
   * Link social account
   */
  linkSocialAccount(provider: 'google' | 'apple' | 'facebook'): void {
    this.authService.getSocialAuthUrl({ provider }).subscribe({
      next: (response) => {
        // Redirect to social provider
        window.location.href = response.url;
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to initiate social login';
      },
    });
  }

  /**
   * Check if a social account can be unlinked
   * Cannot unlink if user has no password (pure social signup)
   * This prevents social-only users from unlinking their only authentication method
   */
  canUnlinkAccount(_provider: string): boolean {
    // If user has no password hash, they are a pure social signup - cannot unlink
    // They need at least one auth method (either password OR social account)
    return this.user?.hasPasswordHash === true;
  }

  /**
   * Unlink social account
   */
  unlinkAccount(provider: string): void {
    if (confirm(`Are you sure you want to unlink your ${provider} account?`)) {
      this.authService.unlinkSocialAccount({ provider: provider as any }).subscribe({
        next: () => {
          this.successMessage = `${provider} account unlinked successfully`;
          this.loadSocialAccounts();
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to unlink account';
        },
      });
    }
  }

  /**
   * Start timer to update token expiry display
   */
  private startTokenUpdateTimer(): void {
    this.stopTokenUpdateTimer();
    // Update every second to show current expiry time
    this.updateTimer = setInterval(() => {
      // Only update the tokens display, don't reload all data
      this.currentTokens = this.authService.getTokens();
    }, 1000);
  }

  /**
   * Stop the token update timer
   */
  private stopTokenUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Open MFA setup dialog
   */
  openMFASetupDialog(): void {
    this.preselectedMFAMethod = undefined;
    this.showMFASetupDialog = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Open MFA setup dialog for a specific method (for adding secondary methods)
   */
  openMFASetupDialogForMethod(method: MFADeviceMethod): void {
    this.preselectedMFAMethod = method;
    this.showMFASetupDialog = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Close MFA setup dialog
   */
  closeMFASetupDialog(): void {
    this.showMFASetupDialog = false;
    this.preselectedMFAMethod = undefined;
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Handle MFA setup completion from unified component
   */
  onMFASetupCompleted(event: { method: MFADeviceMethod; backupCodes?: string[] }): void {
    this.successMessage = `${event.method.toUpperCase()} MFA setup completed successfully!`;
    this.loadMFAStatus();
    this.loadMFADevices(); // Reload devices to show newly added passkey
    setTimeout(() => {
      this.closeMFASetupDialog();
    }, 2000);
  }

  /**
   * Set preferred MFA method
   */
  setPreferredMethod(method: MFADeviceMethod): void {
    if (!this.isMethodConfigured(method)) {
      this.errorMessage = 'Method must be configured first';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.setPreferredMFAMethod(method).subscribe({
      next: (response) => {
        this.successMessage = response.message;
        this.isLoading = false;
        this.loadMFAStatus();
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to set preferred method';
        this.isLoading = false;
      },
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(): void {
    if (
      confirm('This will generate new backup codes and invalidate any existing ones. Continue?')
    ) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      this.authService.generateBackupCodes().subscribe({
        next: (response) => {
          this.backupCodes = response.codes;
          this.showBackupCodes = true;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to generate backup codes';
          this.isLoading = false;
        },
      });
    }
  }

  /**
   * Remove MFA method (removes all devices of that type)
   */
  removeMFAMethod(method: MFADeviceMethod): void {
    if (!this.mfaStatus) {
      return;
    }

    // Prevent removing if it's the only configured method
    if (this.mfaStatus.configuredMethods.length === 1) {
      this.errorMessage = 'Cannot remove the last MFA method. Please add another method first.';
      return;
    }

    const methodName = this.getMFAMethodDisplayName(method);
    const deviceCount = this.mfaDevices.filter((d) => d.type === method && d.isActive).length;
    const deviceText = deviceCount > 1 ? `all ${deviceCount} ${methodName} devices` : methodName;

    if (
      confirm(
        `Are you sure you want to remove ${deviceText}? You will need to set ${methodName} up again to use it.`,
      )
    ) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      this.authService.removeMFAMethod(method).subscribe({
        next: () => {
          this.successMessage = `${methodName} removed successfully`;
          this.loadMFAStatus();
          this.loadMFADevices();
          this.isLoading = false;
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        error: (error: any) => {
          this.errorMessage = error.error?.message || `Failed to remove ${methodName}`;
          this.isLoading = false;
        },
      });
    }
  }

  /**
   * Toggle MFA exemption
   */
  toggleMFAExemption(): void {
    if (!this.mfaStatus) {
      return;
    }

    const newExemptStatus = !this.mfaStatus.mfaExempt;
    const action = newExemptStatus ? 'grant' : 'revoke';
    const reason = prompt(`Enter reason for ${action}ing MFA exemption (optional):`) || undefined;

    if (newExemptStatus && !reason) {
      // For granting, warn if no reason provided
      if (
        !confirm(
          'No reason provided. Exemption will still be granted but audit trail will be incomplete. Continue?',
        )
      ) {
        return;
      }
    } else if (!newExemptStatus) {
      // For revoking, confirm
      if (
        !confirm(
          'Are you sure you want to revoke MFA exemption? User may be required to set up MFA on next login.',
        )
      ) {
        return;
      }
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.setMFAExemption(newExemptStatus, reason).subscribe({
      next: (response) => {
        this.successMessage = response.message;
        this.loadMFAStatus();
        this.loadUserData(); // Refresh user data to get updated exemption fields
        this.isLoading = false;
        setTimeout(() => (this.successMessage = ''), 1000);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || `Failed to ${action} MFA exemption`;
        this.isLoading = false;
      },
    });
  }
}
