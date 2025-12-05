import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

/**
 * TOTP Setup Component
 *
 * Reusable component for TOTP (Authenticator App) setup.
 * Displays QR code, manual entry key, and verification form.
 *
 * @example
 * ```html
 * <app-totp-setup
 *   [setupData]="totpSetupData"
 *   [isLoading]="isLoading"
 *   [errorMessage]="errorMessage"
 *   [showBackButton]="true"
 *   (verify)="onVerify($event)"
 *   (goBack)="onGoBack()"
 * />
 * ```
 */
@Component({
  selector: 'app-totp-setup',
  templateUrl: './totp-setup.component.html',
  styleUrls: ['./totp-setup.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
})
export class TOTPSetupComponent implements OnInit {
  @Input() setupData: {
    secret: string;
    qrCode: string;
    manualEntryKey: string;
    issuer: string;
    accountName: string;
  } | null = null;
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';
  @Input() showBackButton: boolean = false;

  @Output() verify = new EventEmitter<{ code: string; deviceName: string }>();
  @Output() goBack = new EventEmitter<void>();

  totpVerificationForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.totpVerificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      deviceName: ['Authenticator App', [Validators.required]],
    });
  }

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.totpVerificationForm.valid && !this.isLoading) {
      const code = this.totpVerificationForm.get('code')?.value;
      const deviceName = this.totpVerificationForm.get('deviceName')?.value;
      this.verify.emit({ code, deviceName });
    }
  }

  /**
   * Handle back button click
   */
  onGoBack(): void {
    this.goBack.emit();
  }

  /**
   * Get form controls for template
   */
  get codeControl() {
    return this.totpVerificationForm.get('code');
  }

  get deviceNameControl() {
    return this.totpVerificationForm.get('deviceName');
  }
}

