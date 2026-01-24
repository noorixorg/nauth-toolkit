import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client-angular/standalone';
import {
  NAuthClientConfig,
  NAuthClientError,
  MFAStatus,
  MFADevice,
  MFADeviceMethod,
} from '@nauth-toolkit/client';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { MenuModule, Menu } from 'primeng/menu';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { Subject } from 'rxjs';

/**
 * MFA Management Component
 *
 * Provides comprehensive MFA device management:
 * - View all enrolled MFA devices
 * - See preferred device
 * - Set preferred device
 * - Delete MFA devices
 * - Enroll new MFA devices
 *
 * Uses existing MFA setup components for enrollment flow.
 *
 * @example
 * ```typescript
 * // Used in dashboard
 * <app-mfa />
 * ```
 */
@Component({
  selector: 'app-mfa',
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    MenuModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './mfa.component.html',
  styleUrl: './mfa.component.css',
})
export class MfaComponent implements OnInit, OnDestroy {
  /**
   * MFA status including enabled state, configured methods, and exemptions
   */
  protected readonly mfaStatus = signal<MFAStatus | null>(null);

  /**
   * List of enrolled MFA devices (in original order from backend)
   */
  protected readonly devices = signal<MFADevice[]>([]);

  /**
   * Loading state
   */
  protected readonly loading = signal(true);

  /**
   * Currently selected device for menu actions
   */
  private selectedDevice: MFADevice | null = null;

  /**
   * Menu items for the currently selected device
   */
  protected readonly deviceMenuItems = signal<MenuItem[]>([]);

  /**
   * Menu reference
   */
  @ViewChild('deviceMenu') deviceMenu!: Menu;

  /**
   * Error message
   */
  protected readonly error = signal<string | null>(null);

  /**
   * Loading state for device trust operation
   */
  protected readonly trustingDevice = signal(false);

  /**
   * Whether current device is trusted
   */
  protected readonly isDeviceTrusted = signal(false);

  /**
   * Whether MFA is enabled
   */
  protected readonly mfaEnabled = computed(() => this.mfaStatus()?.enabled ?? false);

  /**
   * Preferred MFA method (method-level)
   */
  protected readonly preferredMethod = computed(() => this.mfaStatus()?.preferredMethod);

  /**
   * Available methods that can be enrolled
   */
  protected readonly availableMethods = computed(() => {
    const status = this.mfaStatus();
    if (!status) return [];
    // Filter out already configured methods
    const configuredTypes = this.devices().map((d) => d.type);
    return status.availableMethods.filter(
      (m) =>
        m !== 'backup' &&
        (!configuredTypes.includes(m as MFADeviceMethod) ||
          // Allow multiple devices for these methods
          m === 'totp' ||
          m === 'passkey'),
    );
  });

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly config = inject<NAuthClientConfig>(NAUTH_CLIENT_CONFIG);
  private readonly destroy$ = new Subject<void>();

  /**
   * Initialize component
   *
   * Loads MFA status and devices from backend.
   */
  ngOnInit(): void {
    this.loadMfaData();
    // Check device trust status on component load
    this.checkDeviceTrustStatus().catch((error) => {
      // Error already handled in method, just log if needed
      if (this.config.debug) {
        console.warn('Failed to check device trust status on init:', error);
      }
    });
  }

  /**
   * Load MFA status and devices
   */
  async loadMfaData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const client = this.auth.getClient();

      // Load MFA status and devices in parallel
      const [status, devicesResponse] = await Promise.all([
        client.getMfaStatus(),
        client.getMfaDevices(),
      ]);

      this.mfaStatus.set(status);

      // Extract devices array from response (backend returns { devices: MFADevice[] })
      const devicesData: MFADevice[] = Array.isArray(devicesResponse)
        ? (devicesResponse as MFADevice[])
        : ((devicesResponse as { devices?: MFADevice[] })?.devices ?? []);

      // Deduplicate devices by ID (in case backend returns duplicates)
      const uniqueDevices = Array.from(new Map(devicesData.map((d: MFADevice) => [d.id, d])).values());

      this.devices.set(uniqueDevices);
    } catch {
      this.error.set('Failed to load MFA data. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get display name for MFA method type
   *
   * @param type - MFA device method type
   * @returns Human-readable name
   */
  getMethodName(type: MFADeviceMethod): string {
    const names: Record<MFADeviceMethod, string> = {
      totp: 'Authenticator App',
      sms: 'SMS',
      email: 'Email',
      passkey: 'Passkey',
    };
    return names[type] || type.toUpperCase();
  }

  /**
   * Get icon for MFA method type
   *
   * @param type - MFA device method type
   * @returns PrimeNG icon class
   */
  getMethodIcon(type: MFADeviceMethod): string {
    const icons: Record<MFADeviceMethod, string> = {
      totp: 'pi pi-qrcode',
      sms: 'pi pi-mobile',
      email: 'pi pi-envelope',
      passkey: 'pi pi-key',
    };
    return icons[type] || 'pi pi-shield';
  }

  /**
   * Get formatted date string
   *
   * @param date - Date to format
   * @returns Formatted date string
   */
  formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }


  /**
   * Check if device is preferred (primary)
   *
   * @param device - MFA device
   * @returns True if device is marked as preferred
   */
  isPreferred(device: MFADevice): boolean {
    return device.isPrimary === true;
  }

  /**
   * Open device menu and set selected device
   *
   * @param event - Click event
   * @param device - MFA device
   */
  openDeviceMenu(event: Event, device: MFADevice): void {
    this.selectedDevice = device;
    this.deviceMenuItems.set(this.buildMenuItems(device));
    this.deviceMenu.toggle(event);
  }

  /**
   * Build menu items for a device
   *
   * @param device - MFA device
   * @returns Array of menu items
   */
  private buildMenuItems(device: MFADevice): MenuItem[] {
    const items: MenuItem[] = [];

    // Set as preferred (if not already)
    if (!device.isPrimary) {
      items.push({
        label: 'Set as Preferred',
        icon: 'pi pi-star',
        command: () => {
          // PrimeNG menu closes automatically when command executes
          this.setPreferred(device);
        },
      });
    }

    // Delete device
    items.push({
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        // PrimeNG menu closes automatically when command executes
        this.deleteDevice(device);
      },
      styleClass: 'text-red-500',
    });

    return items;
  }

  /**
   * Set device as preferred MFA device
   *
   * @param device - MFA device to set as preferred
   */
  async setPreferred(device: MFADevice): Promise<void> {
    // Prevent multiple simultaneous calls
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    try {
      const client = this.auth.getClient();
      await client.setPreferredMfaDevice(device.id);

      // Reload data to reflect changes
      await this.loadMfaData();
    } catch (err) {
      let errorMessage = 'Failed to set preferred device';
      if (err instanceof NAuthClientError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      }

      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: errorMessage,
        life: 5000,
      });
    } finally {
      this.loading.set(false);
    }
  }


  /**
   * Delete MFA device
   *
   * @param device - MFA device to delete
   */
  async deleteDevice(device: MFADevice): Promise<void> {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${device.name}? This action cannot be undone.`,
      header: 'Delete MFA Device',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          const client = this.auth.getClient();
          await client.removeMfaDeviceById(device.id);

          // Reload data to reflect changes
          await this.loadMfaData();
        } catch (err) {
          let errorMessage = 'Failed to delete device';
          if (err instanceof NAuthClientError) {
            errorMessage = err.message;
          } else if (err instanceof Error) {
            errorMessage = err.message || errorMessage;
          }

          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: errorMessage,
            life: 5000,
          });
        }
      },
    });
  }

  /**
   * Navigate to enroll new MFA device
   *
   * Creates a synthetic MFA_SETUP_REQUIRED challenge and navigates to MFA setup flow.
   */
  async enrollNewDevice(): Promise<void> {
    try {
      // Navigate to MFA setup route
      // The MFA setup component will handle the enrollment flow
      this.router.navigate(['/dashboard/mfa/enroll']);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to start enrollment',
        life: 5000,
      });
    }
  }

  /**
   * Check device trust status
   *
   * Checks if the current device is trusted using the SDK.
   * This performs a server-side validation of the device token.
   */
  private async checkDeviceTrustStatus(): Promise<void> {
    try {
      const client = this.auth.getClient();
      const result = await client.isTrustedDevice();
      this.isDeviceTrusted.set(result.trusted);
    } catch (error) {
      // Silently fail - device is not trusted if check fails
      // This can happen if user is not authenticated or feature is disabled
      this.isDeviceTrusted.set(false);
      // Log error in development for debugging
      if (this.config.debug) {
        console.warn('Failed to check device trust status:', error);
      }
    }
  }

  /**
   * Trust the current device
   *
   * Marks the current device as trusted, allowing MFA to be skipped for future logins.
   */
  async trustDevice(): Promise<void> {
    if (this.trustingDevice()) {
      return;
    }

    this.trustingDevice.set(true);
    try {
      const client = this.auth.getClient();
      await client.trustDevice();

      // Update device trust status
      await this.checkDeviceTrustStatus();

      // Reload MFA data to reflect changes
      await this.loadMfaData();
    } catch (err) {
      let errorMessage = 'Failed to trust device';
      if (err instanceof NAuthClientError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      }

      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: errorMessage,
        life: 5000,
      });
    } finally {
      this.trustingDevice.set(false);
    }
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
