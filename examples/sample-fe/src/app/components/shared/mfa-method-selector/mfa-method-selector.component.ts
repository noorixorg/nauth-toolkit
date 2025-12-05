import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MFADeviceMethod, MFAVerificationMethod } from '../../../types/mfa.types';

/**
 * MFA Method Selector Component
 *
 * Reusable component for selecting an MFA method (SMS, TOTP, Passkey).
 * Used in MFA setup flows.
 *
 * @example
 * ```html
 * <app-mfa-method-selector
 *   [allowedMethods]="['sms', 'totp']"
 *   [isLoading]="isLoading"
 *   [userPhone]="user?.phone"
 *   (methodSelected)="onMethodSelected($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-mfa-method-selector',
  templateUrl: './mfa-method-selector.component.html',
  styleUrls: ['./mfa-method-selector.component.scss'],
  imports: [CommonModule],
  standalone: true,
})
export class MFAMethodSelectorComponent {
  @Input() allowedMethods: Array<MFAVerificationMethod> = [];
  @Input() isLoading: boolean = false;
  @Input() userPhone?: string;

  @Output() methodSelected = new EventEmitter<MFAVerificationMethod>();

  /**
   * Handle method selection
   */
  onMethodSelected(method: MFAVerificationMethod): void {
    this.methodSelected.emit(method);
  }

  /**
   * Mask phone number for display
   */
  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 4) {
      return `***-***-${digits.slice(-4)}`;
    }
    return phone;
  }
}

