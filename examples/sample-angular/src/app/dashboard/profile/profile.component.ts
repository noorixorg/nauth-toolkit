import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, AuthUser } from '@nauth-toolkit/client/angular';
import { NAuthClientError, NAuthErrorCode, SocialProvider } from '@nauth-toolkit/client';
import { CardModule } from 'primeng/card';
import { InplaceModule } from 'primeng/inplace';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { ConfirmationService } from 'primeng/api';

/**
 * Profile Component
 *
 * Displays user profile information with in-place editing capabilities.
 * Shows email/phone verification status, social account information,
 * and allows updating profile fields. Prevents email changes for social accounts.
 *
 * @example
 * ```typescript
 * // Used within dashboard component
 * <app-profile />
 * ```
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    InplaceModule,
    InputTextModule,
    ButtonModule,
    BadgeModule,
    TagModule,
    AvatarModule,
    MessageModule,
    ConfirmDialogModule,
    TooltipModule,
    DialogModule,
    PasswordModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  /**
   * Auth service for profile operations
   */
  private readonly auth = inject(AuthService);

  /**
   * Form builder for reactive forms
   */
  private readonly fb = inject(FormBuilder);

  /**
   * Confirmation service for dialogs
   */
  private readonly confirmationService = inject(ConfirmationService);

  /**
   * Current user profile data
   */
  user = signal<AuthUser | null>(null);

  /**
   * Loading state
   */
  loading = signal(true);

  /**
   * Update loading state
   */
  updating = signal(false);

  /**
   * Error message
   */
  error = signal<string | null>(null);

  /**
   * Success message
   */
  success = signal<string | null>(null);

  /**
   * Edit mode state
   */
  editMode = signal(false);

  /**
   * Profile form group
   */
  profileForm: FormGroup;

  /**
   * User initials for avatar
   */
  userInitials = computed(() => {
    const currentUser = this.user();
    if (!currentUser) return 'U';
    if (currentUser.firstName && currentUser.lastName) {
      return `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`.toUpperCase();
    }
    if (currentUser.email) {
      return currentUser.email.charAt(0).toUpperCase();
    }
    return 'U';
  });

  /**
   * Linked social accounts
   */
  linkedAccounts = signal<SocialProvider[]>([]);

  /**
   * Loading linked accounts state
   */
  loadingAccounts = signal(false);

  /**
   * Unlinking account state
   */
  unlinking = signal<string | null>(null);

  /**
   * Change password dialog visibility
   */
  showChangePasswordDialog = signal(false);

  /**
   * Changing password state
   */
  changingPassword = signal(false);

  /**
   * Change password form group
   */
  changePasswordForm: FormGroup;

  /**
   * Check if account is pure social (no password)
   * Pure social means: no password AND has social providers
   * Determined by: hasPasswordHash is false
   */
  isPureSocialAccount = computed((): boolean => {
    const currentUser = this.user();
    if (!currentUser) return false;
    // IMPORTANT:
    // - `username` may legitimately be null for password users (username is optional)
    // - `hasPasswordHash` is the canonical capability flag
    const hasNoPassword = currentUser.hasPasswordHash === false;
    const hasSocial = this.hasSocialProviders();
    return hasNoPassword && hasSocial;
  });

  /**
   * Check if account has password (is password-based)
   *
   * Returns false for pure social accounts (no password set).
   * Returns true if account has a password (password-based or hybrid).
   */
  hasPassword = computed((): boolean => {
    const currentUser = this.user();
    if (!currentUser) return false;

    return currentUser.hasPasswordHash === true;
  });

  /**
   * Check if a provider can be unlinked
   * Can unlink if: account has password AND provider is not in primary social providers
   * Cannot unlink if: pure social account (no password) OR provider is primary
   *
   * @param provider - Social provider to check
   * @returns True if provider can be unlinked
   */
  canUnlinkProvider(provider: SocialProvider): boolean {
    // Cannot unlink if pure social account
    if (this.isPureSocialAccount()) {
      return false;
    }
    // Can unlink if account has password and provider is not primary
    // Primary providers are in user.socialProviders, linked ones are in linkedAccounts()
    const isPrimary = this.getSocialProviders().includes(provider);
    return this.hasPassword() && !isPrimary;
  }

  /**
   * Check if account has linked social accounts
   */
  hasLinkedAccounts = computed((): boolean => {
    return this.linkedAccounts().length > 0;
  });

  /**
   * Check if user has social providers from profile
   */
  hasSocialProviders = computed((): boolean => {
    const currentUser = this.user();
    return !!(currentUser?.socialProviders && currentUser.socialProviders.length > 0);
  });

  /**
   * Check if email editing should be disabled
   * Disabled if account is pure social or has linked social accounts
   */
  isEmailDisabled = computed((): boolean => {
    return this.isPureSocialAccount() || this.hasLinkedAccounts() || this.hasSocialProviders();
  });

  /**
   * Get social providers from user profile
   */
  getSocialProviders = computed((): SocialProvider[] => {
    const currentUser = this.user();
    if (!currentUser?.socialProviders) return [];
    return currentUser.socialProviders.filter((p): p is SocialProvider => {
      return p === 'google' || p === 'apple' || p === 'facebook';
    });
  });

  /**
   * Get provider display name
   *
   * @param provider - Social provider identifier
   * @returns Display name for provider
   */
  getProviderName(provider: SocialProvider): string {
    const names: Record<SocialProvider, string> = {
      google: 'Google',
      apple: 'Apple',
      facebook: 'Facebook',
    };
    return names[provider] || provider;
  }

  /**
   * Get provider icon class
   *
   * @param provider - Social provider identifier
   * @returns Icon class for provider
   */
  getProviderIcon(provider: SocialProvider): string {
    const icons: Record<SocialProvider, string> = {
      google: 'pi pi-google',
      apple: 'pi pi-apple',
      facebook: 'pi pi-facebook',
    };
    return icons[provider] || 'pi pi-link';
  }

  constructor() {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.maxLength(100)]],
      lastName: ['', [Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.maxLength(20)]],
    });

    this.changePasswordForm = this.fb.group({
      oldPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required]],
    });

    // Add custom validator for password match
    this.changePasswordForm.get('confirmPassword')?.addValidators((control) => {
      const newPassword = this.changePasswordForm.get('newPassword')?.value;
      const confirmPassword = control.value;
      if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        return { passwordMismatch: true };
      }
      return null;
    });

    // Re-validate confirm password when new password changes
    this.changePasswordForm.get('newPassword')?.valueChanges.subscribe(() => {
      this.changePasswordForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  /**
   * Component initialization
   *
   * Fetches user profile data and linked social accounts
   */
  ngOnInit(): void {
    this.loadProfile();
    this.loadLinkedAccounts();
  }

  /**
   * Load user profile from API
   */
  private loadProfile(): void {
    this.loading.set(true);
    this.error.set(null);

    this.auth
      .getClient()
      .getProfile()
      .then((user: AuthUser) => {
        this.user.set(user);
        this.populateForm(user);
        this.loading.set(false);
      })
      .catch((err: unknown) => {
        this.loading.set(false);
        if (err instanceof NAuthClientError) {
          this.error.set(err.message);
        } else if (err instanceof Error) {
          this.error.set(err.message || 'Failed to load profile');
        } else {
          this.error.set('Failed to load profile');
        }
      });
  }

  /**
   * Populate form with user data
   *
   * @param user - User data to populate
   */
  private populateForm(user: AuthUser): void {
    this.profileForm.patchValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
    });

    // Disable email field if social account, has social providers, or has linked accounts
    if (this.isEmailDisabled()) {
      this.profileForm.get('email')?.disable();
    } else {
      this.profileForm.get('email')?.enable();
    }
  }

  /**
   * Load linked social accounts from API
   */
  private loadLinkedAccounts(): void {
    this.loadingAccounts.set(true);

    this.auth
      .getClient()
      .getLinkedAccounts()
      .then((response) => {
        this.linkedAccounts.set(response.providers || []);
        this.loadingAccounts.set(false);

        // Update email field state after loading accounts
        const currentUser = this.user();
        if (currentUser) {
          this.populateForm(currentUser);
        }
      })
      .catch((err: unknown) => {
        this.loadingAccounts.set(false);
        // Silently fail - social accounts might not be configured
        if (err instanceof NAuthClientError && err.code !== NAuthErrorCode.RESOURCE_NOT_FOUND) {
          // Only log non-404 errors
        }
      });
  }

  /**
   * Enable edit mode
   */
  enableEdit(): void {
    this.editMode.set(true);
    this.success.set(null);
    this.error.set(null);
  }

  /**
   * Cancel edit mode
   */
  cancelEdit(): void {
    this.editMode.set(false);
    const currentUser = this.user();
    if (currentUser) {
      this.populateForm(currentUser);
    }
    this.error.set(null);
  }

  /**
   * Save profile changes
   */
  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      Object.keys(this.profileForm.controls).forEach((key) => {
        this.profileForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.updating.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      // Get form value and re-enable disabled fields for submission
      const formValue = { ...this.profileForm.value };
      if (this.profileForm.get('email')?.disabled) {
        // Don't include email if it's disabled (social account)
        delete formValue.email;
      }

      const updatedUser = await this.auth.getClient().updateProfile(formValue);
      this.user.set(updatedUser);
      this.populateForm(updatedUser);
      this.editMode.set(false);
      this.success.set('Profile updated successfully');
      this.updating.set(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        this.success.set(null);
      }, 3000);
    } catch (err: unknown) {
      this.updating.set(false);
      if (err instanceof NAuthClientError) {
        this.error.set(err.message);
      } else if (err instanceof Error) {
        this.error.set(err.message || 'Failed to update profile');
      } else {
        this.error.set('Failed to update profile');
      }
    }
  }

  /**
   * Unlink social account
   *
   * @param provider - Social provider to unlink
   */
  async unlinkAccount(provider: SocialProvider): Promise<void> {
    this.confirmationService.confirm({
      message: `Are you sure you want to unlink your ${this.getProviderName(provider)} account?`,
      header: 'Unlink Social Account',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        this.unlinking.set(provider);
        this.error.set(null);

        try {
          await this.auth.getClient().unlinkSocialAccount(provider);

          // Remove from linked accounts list
          this.linkedAccounts.set(this.linkedAccounts().filter((p) => p !== provider));

          // Reload user profile to get updated socialProviders
          await this.loadProfile();

          // Reload linked accounts to ensure consistency
          await this.loadLinkedAccounts();

          this.success.set(`${this.getProviderName(provider)} account unlinked successfully`);
          this.unlinking.set(null);

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.success.set(null);
          }, 3000);
        } catch (err: unknown) {
          this.unlinking.set(null);
          if (err instanceof NAuthClientError) {
            this.error.set(err.message);
          } else if (err instanceof Error) {
            this.error.set(err.message || 'Failed to unlink account');
          } else {
            this.error.set('Failed to unlink account');
          }
        }
      },
    });
  }

  /**
   * Open change password dialog
   *
   * Prevents opening for pure social accounts (no password set).
   */
  openChangePasswordDialog(): void {
    // Prevent opening dialog for pure social accounts
    if (this.isPureSocialAccount() || !this.hasPassword()) {
      this.error.set('Password change is not available for social-only accounts.');
      return;
    }

    this.changePasswordForm.reset();
    this.error.set(null);
    this.success.set(null);
    this.showChangePasswordDialog.set(true);
  }

  /**
   * Close change password dialog
   */
  closeChangePasswordDialog(): void {
    this.showChangePasswordDialog.set(false);
    this.changePasswordForm.reset();
    this.error.set(null);
  }

  /**
   * Change user password
   */
  async changePassword(): Promise<void> {
    if (this.changePasswordForm.invalid) {
      Object.keys(this.changePasswordForm.controls).forEach((key) => {
        this.changePasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.changingPassword.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const { oldPassword, newPassword } = this.changePasswordForm.value;
      this.auth.changePassword(oldPassword, newPassword).subscribe({
        next: () => {
          this.changingPassword.set(false);
          this.success.set('Password changed successfully');
          this.closeChangePasswordDialog();

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.success.set(null);
          }, 3000);
        },
        error: (err: unknown) => {
          this.changingPassword.set(false);
          if (err instanceof NAuthClientError) {
            this.error.set(err.message);
          } else if (err instanceof Error) {
            this.error.set(err.message || 'Failed to change password');
          } else {
            this.error.set('Failed to change password');
          }
        },
      });
    } catch (err: unknown) {
      this.changingPassword.set(false);
      if (err instanceof NAuthClientError) {
        this.error.set(err.message);
      } else if (err instanceof Error) {
        this.error.set(err.message || 'Failed to change password');
      } else {
        this.error.set('Failed to change password');
      }
    }
  }
}
