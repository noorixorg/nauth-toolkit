import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AdminService, AdminSignupRequest } from '../../services/admin.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Phone number validator
 *
 * Validates E.164 format: +[country code][number]
 */
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Let required validator handle empty values
  }
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(control.value)) {
    return { phoneFormat: { message: 'Phone must be in E.164 format (e.g., +14155552671)' } };
  }
  return null;
}

/**
 * Password match validator
 *
 * Validates that confirmPassword matches password
 */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  const confirmPassword = control.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

/**
 * Admin Component
 *
 * Administrative user management interface with capabilities to:
 * - Create user accounts with override options
 * - Pre-verify email/phone
 * - Auto-generate passwords
 * - Force password change on first login
 *
 * Future features:
 * - Reset password for any user
 * - User account management
 * - Bulk operations
 *
 * @example
 * ```typescript
 * // Used within dashboard component
 * <app-admin />
 * ```
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    InputMaskModule,
    PasswordModule,
    CheckboxModule,
    DialogModule,
    MessageModule,
    TooltipModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  /**
   * Admin service for API calls
   */
  private readonly adminService = inject(AdminService);

  /**
   * Form builder for reactive forms
   */
  private readonly fb = inject(FormBuilder);

  /**
   * Message service for toast notifications
   */
  private readonly messageService = inject(MessageService);

  /**
   * Create user form group
   */
  createUserForm!: FormGroup;

  /**
   * Dialog visibility state
   */
  showDialog = signal(false);

  /**
   * Loading state for form submission
   */
  loading = signal(false);

  /**
   * Error message
   */
  error = signal<string | null>(null);

  /**
   * Success message
   */
  success = signal<string | null>(null);

  /**
   * Generated password from last user creation
   */
  generatedPassword = signal<string | null>(null);

  /**
   * Show generated password dialog
   */
  showPasswordDialog = signal(false);

  /**
   * Initialize component
   */
  ngOnInit(): void {
    this.initializeForm();
  }

  /**
   * Initialize create user form
   */
  private initializeForm(): void {
    this.createUserForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.minLength(8), Validators.maxLength(128)]],
      username: [
        '',
        [
          Validators.minLength(3),
          Validators.maxLength(255),
          Validators.pattern(/^[a-zA-Z0-9_-]+$/),
        ],
      ],
      firstName: [
        '',
        [
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      phone: ['', [phoneValidator, Validators.maxLength(20)]],
      isEmailVerified: [false],
      isPhoneVerified: [false],
      mustChangePassword: [false],
      generatePassword: [false],
    });

    // Update password validators when generatePassword changes
    this.createUserForm.get('generatePassword')?.valueChanges.subscribe((generatePassword) => {
      const passwordControl = this.createUserForm.get('password');
      if (generatePassword) {
        passwordControl?.clearValidators();
      } else {
        passwordControl?.setValidators([Validators.required, Validators.minLength(8), Validators.maxLength(128)]);
      }
      passwordControl?.updateValueAndValidity();
    });
  }

  /**
   * Open create user dialog
   */
  openCreateUserDialog(): void {
    this.createUserForm.reset({
      isEmailVerified: false,
      isPhoneVerified: false,
      mustChangePassword: false,
      generatePassword: false,
    });
    this.error.set(null);
    this.success.set(null);
    this.generatedPassword.set(null);
    this.showDialog.set(true);
  }

  /**
   * Close create user dialog
   */
  closeDialog(): void {
    this.showDialog.set(false);
    this.error.set(null);
    this.success.set(null);
  }

  /**
   * Handle form submission
   *
   * Creates a new user account with admin privileges.
   */
  onSubmit(): void {
    if (this.createUserForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.createUserForm.controls).forEach((key) => {
        this.createUserForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.generatedPassword.set(null);

    const formValue = this.createUserForm.value;
    const dto: AdminSignupRequest = {
      email: formValue.email.trim().toLowerCase(),
      username: formValue.username?.trim() || undefined,
      firstName: formValue.firstName?.trim() || undefined,
      lastName: formValue.lastName?.trim() || undefined,
      phone: formValue.phone?.replace(/\s/g, '') || undefined,
      isEmailVerified: formValue.isEmailVerified || false,
      isPhoneVerified: formValue.isPhoneVerified || false,
      mustChangePassword: formValue.mustChangePassword || false,
      generatePassword: formValue.generatePassword || false,
    };

    // Only include password if not generating
    if (!dto.generatePassword && formValue.password) {
      dto.password = formValue.password;
    }

    this.adminService
      .createUser(dto)
      .then((response) => {
        this.loading.set(false);
        this.success.set(`User ${response.user.email} created successfully`);
        this.createUserForm.reset({
          isEmailVerified: false,
          isPhoneVerified: false,
          mustChangePassword: false,
          generatePassword: false,
        });

        // Show generated password dialog if password was generated
        if (response.generatedPassword) {
          this.generatedPassword.set(response.generatedPassword);
          this.showPasswordDialog.set(true);
        } else {
          // Close dialog after short delay
          setTimeout(() => {
            this.closeDialog();
          }, 2000);
        }

        this.messageService.add({
          severity: 'success',
          summary: 'User Created',
          detail: `User ${response.user.email} has been created successfully`,
        });
      })
      .catch((err: unknown) => {
        this.loading.set(false);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
        this.error.set(errorMessage);
        this.messageService.add({
          severity: 'error',
          summary: 'Create User Failed',
          detail: errorMessage,
        });
      });
  }

  /**
   * Close password dialog and copy password to clipboard
   */
  async copyPasswordAndClose(): Promise<void> {
    const password = this.generatedPassword();
    if (password) {
      try {
        await navigator.clipboard.writeText(password);
        this.messageService.add({
          severity: 'success',
          summary: 'Password Copied',
          detail: 'Generated password has been copied to clipboard',
        });
      } catch {
        // Clipboard API not available - just close dialog
      }
    }
    this.showPasswordDialog.set(false);
    this.generatedPassword.set(null);
    this.closeDialog();
  }

  /**
   * Close password dialog without copying
   */
  closePasswordDialog(): void {
    this.showPasswordDialog.set(false);
    this.generatedPassword.set(null);
    this.closeDialog();
  }
}

