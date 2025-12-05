import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

/**
 * SMS Verification Component
 *
 * Reusable component for SMS code verification.
 * Used in phone verification, MFA setup, and MFA verification flows.
 *
 * @example
 * ```html
 * <app-sms-verification
 *   [maskedPhone]="maskedPhone"
 *   [isLoading]="isLoading"
 *   [errorMessage]="errorMessage"
 *   (verify)="onVerify($event)"
 *   (resend)="onResend()"
 * />
 * ```
 */
@Component({
  selector: 'app-sms-verification',
  templateUrl: './sms-verification.component.html',
  styleUrls: ['./sms-verification.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
})
export class SMSVerificationComponent implements OnInit, OnDestroy, OnChanges {
  @Input() maskedPhone: string = 'your phone';
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';
  @Input() successMessage: string = '';
  @Input() showBackButton: boolean = false;
  @Input() title: string = 'Verify Your Phone Number';
  @Input() instruction: string = '';
  @Input() resendCooldown: number = 0;

  private _instruction: string = '';

  @Output() verify = new EventEmitter<string>();
  @Output() resend = new EventEmitter<void>();
  @Output() goBack = new EventEmitter<void>();

  verificationForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnInit(): void {
    this.updateInstruction();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update instruction when maskedPhone changes or when instruction input is provided
    if (changes['maskedPhone'] || changes['instruction']) {
      this.updateInstruction();
    }
  }

  /**
   * Update instruction text based on maskedPhone or provided instruction
   */
  private updateInstruction(): void {
    // Use provided instruction if available, otherwise generate from maskedPhone
    if (this.instruction && this.instruction.trim() !== '') {
      this._instruction = this.instruction;
    } else {
      const phoneDisplay = this.maskedPhone || 'your phone';
      this._instruction = `We've sent a 6-digit verification code to ${phoneDisplay}. Please enter it below.`;
    }
  }

  /**
   * Get the instruction text to display
   */
  get displayInstruction(): string {
    return this._instruction || `We've sent a 6-digit verification code to ${this.maskedPhone || 'your phone'}. Please enter it below.`;
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.verificationForm.valid && !this.isLoading) {
      const code = this.verificationForm.get('code')?.value;
      this.verify.emit(code);
    }
  }

  /**
   * Handle resend button click
   */
  onResend(): void {
    if (!this.isLoading && this.resendCooldown === 0) {
      this.resend.emit();
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
    return this.verificationForm.get('code');
  }
}
