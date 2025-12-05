import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  startRegistration,
  type RegistrationResponseJSON,
  WebAuthnError,
} from '@simplewebauthn/browser';

/**
 * Passkey Setup Component
 *
 * Reusable component for Passkey (WebAuthn) setup using SimpleWebAuthn browser library.
 * Handles WebAuthn credential creation and device naming.
 *
 * @example
 * ```html
 * <app-passkey-setup
 *   [setupOptions]="passkeySetupOptions"
 *   [isLoading]="isLoading"
 *   [errorMessage]="errorMessage"
 *   [showBackButton]="true"
 *   (verify)="onVerify($event)"
 *   (goBack)="onGoBack()"
 * />
 * ```
 */
@Component({
  selector: 'app-passkey-setup',
  templateUrl: './passkey-setup.component.html',
  styleUrls: ['./passkey-setup.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
})
export class PasskeySetupComponent implements OnInit {
  @Input() setupOptions: Record<string, unknown> | null = null;
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';
  @Input() showBackButton: boolean = false;

  @Output() verify = new EventEmitter<{
    credential: RegistrationResponseJSON;
    deviceName: string;
    expectedChallenge: string;
    transports?: string[];
  }>();
  @Output() goBack = new EventEmitter<void>();

  passkeySetupForm: FormGroup;
  isWebAuthnSupported: boolean = false;
  isCreatingCredential: boolean = false;

  constructor(private fb: FormBuilder) {
    this.passkeySetupForm = this.fb.group({
      deviceName: ['My Passkey', [Validators.required]],
    });
  }

  ngOnInit(): void {
    // Check if WebAuthn is supported
    this.isWebAuthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;
  }

  /**
   * Start passkey registration using SimpleWebAuthn browser library
   */
  async startPasskeyRegistration(): Promise<void> {
    if (!this.setupOptions || this.isCreatingCredential || this.isLoading) {
      return;
    }

    this.isCreatingCredential = true;
    this.errorMessage = '';

    try {
      // Extract challenge from options for verification later
      const expectedChallenge = (this.setupOptions['challenge'] as string) || '';

      // Use SimpleWebAuthn browser library for registration
      // This handles all the complex credential conversion and transport extraction
      const attResp = await startRegistration({
        optionsJSON: this.setupOptions as any,
      });

      // Extract transports from the response if available
      let transports: string[] = [];
      if (
        attResp.response &&
        typeof attResp.response === 'object' &&
        'transports' in attResp.response
      ) {
        const transportsValue = (attResp.response as any).transports;
        if (Array.isArray(transportsValue)) {
          transports = transportsValue;
        }
      }

      const deviceName = this.passkeySetupForm.get('deviceName')?.value || 'My Passkey';

      // Emit the SimpleWebAuthn registration response directly
      // The backend will use @simplewebauthn/server to verify it
      this.verify.emit({
        credential: attResp,
        deviceName,
        expectedChallenge,
        transports: transports.length > 0 ? transports : undefined,
      });

      // Reset creating state - parent will handle loading
      this.isCreatingCredential = false;
    } catch (error: unknown) {
      this.isCreatingCredential = false;

      if (error instanceof WebAuthnError) {
        // SimpleWebAuthn provides better error messages
        if (error.name === 'InvalidStateError') {
          this.errorMessage =
            'This authenticator was probably already registered. Please try a different device.';
        } else {
          this.errorMessage = `Registration failed: ${error.message}`;
        }
      } else {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create passkey. Please try again.';
        this.errorMessage = errorMessage;
      }
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
  get deviceNameControl() {
    return this.passkeySetupForm.get('deviceName');
  }
}
